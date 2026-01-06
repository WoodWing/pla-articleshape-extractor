const idd = require("indesign");
const lfs = require("uxp").storage.localFileSystem;
const formats = require("uxp").storage.formats;
const Errors = require("./Errors.cjs");

/**
 * Understands how to get the settings from InDesign as shown in the Margins and Columns dialog.
 */
class PageLayoutSettings {

    /** @type {Logger} */
    #logger;

    /** @type {FileUtils} */
    #fileUtils;

    /**
     * @param {Logger} logger
     * @param {FileUtils} fileUtils
     */
    constructor (logger, fileUtils) {
        this.#logger = logger;
        this.#fileUtils = fileUtils;
    }

    /**
     * Exports the layout settings of the given layout document to a file named
     * "_manifest/page-layout-settings.json" in the given folder. When this file
     * already exists, the settings are compared instead.
     * @param {IDD.Document} doc
     * @param {UXP.Folder} folder
     * @returns {boolean} True when the settings are matching (or new), false otherwise.
     */
    async exportSettings (doc, folder) {
        let exportedSuccessfully = false;
        const docName = doc.saved ? lfs.getNativePath(await doc.fullName) : doc.name;
        this.#logger.info("Exporting Document Settings for layout '{}'.", docName);
        idd.app.scriptPreferences.measurementUnit = idd.MeasurementUnits.POINTS;
        try {
            if (doc.pages.length === 0) {
                throw new Errors.NoDocumentPagesError();
            }
            for (let i = 0; i < doc.pages.length; i++) {
                const pag = doc.pages.item(i);
                const side = pag.side.equals(idd.PageSideOptions.LEFT_HAND) ? "left" : "right";
                this.#logger.debug(`Page: id=${pag.id}, index=${pag.index}, name=${pag.name}, side=${side}`);
            }
            const page = doc.pages.item(0);
            const baselineStart = this.#getBaselineStart(doc, page);
            const settings = this.#composeSettings(doc, page, baselineStart);
            await this.#saveOrComparePageLayoutSettings(settings, folder);
            exportedSuccessfully = true;
        }
        catch (error) {
            if (error instanceof Errors.ConfigurationError) {
                this.#logger.error(error.message);
            }
            else {
                this.#logger.logError(error);
            }
            alert("An error occurred: " + error.message);
        }
        finally {
            idd.app.scriptPreferences.measurementUnit = idd.AutoEnum.AUTO_VALUE;
        }
        return exportedSuccessfully;
    }

    /**
     * @param {IDD.Document} doc
     * @param {Page} page
     * @param {number} baselineStart
     * @returns {{dimensions: {width: number, height: number}, margins: {top: number, bottom: number, inside: number, outside: number}, columns: {gutter: number}}
     */
    #composeSettings (doc, page, baselineStart) {
        return {
            dimensions: {
                width: this.#roundTo3Decimals(doc.documentPreferences.pageWidth),
                height: this.#roundTo3Decimals(doc.documentPreferences.pageHeight),
            },
            margins: {
                top: this.#roundTo3Decimals(page.marginPreferences.top),
                bottom: this.#roundTo3Decimals(page.marginPreferences.bottom),
                inside: this.#roundTo3Decimals(page.marginPreferences.left),
                outside: this.#roundTo3Decimals(page.marginPreferences.right),
            },
            columns: {
                gutter: this.#roundTo3Decimals(page.marginPreferences.columnGutter),
            },
            "baseline-grid": {
                start: this.#roundTo3Decimals(baselineStart),
                increment: this.#roundTo3Decimals(doc.gridPreferences.baselineDivision),
            },
        };
    }

    /**
     * Round a given number to a precision of maximum 3 decimals.
     * @param {number} precisionNumber
     * @returns {number}
     */
    #roundTo3Decimals (precisionNumber) {
        return Math.round(precisionNumber * 1000) / 1000;
    }

    /**
     * Retrieve the baseline start field when set relative to top of page.
     * When set relative to top of margin, the returned value is normalized to top of page.
     * @param {IDD.Document} doc
     * @param {IDD.Page} page
     * @returns number Baseline start (always relative to top of page).
     */
    #getBaselineStart (doc, page) {
        let baselineStart = doc.gridPreferences.baselineStart;
        const isGridRelativeToPageMargins = doc.gridPreferences.baselineGridRelativeOption.equals(
            idd.BaselineGridRelativeOption.TOP_OF_MARGIN_OF_BASELINE_GRID_RELATIVE_OPTION);
        if (isGridRelativeToPageMargins) {
            baselineStart += page.marginPreferences.top;
            this.#logger.debug(
                "Baseline start is configured as relative to top margin, but exported as relative to top of page: "
                + `${doc.gridPreferences.baselineStart} (=start) + ${page.marginPreferences.top} (=top margin) = ${baselineStart}`,
            );
        }
        else {
            this.#logger.debug(`Baseline start is configured and exported as relative to top of page: ${baselineStart}`);
        }
        return baselineStart;
    }

    /**
     * Saves page layout settings object to the "_manifest/page-layout-settings.json" file in a provided export folder.
     * If the file already exists, it reads the file instead and validates those settings against the provided ones.
     *
     * Raises an error when the InDesign page layout grid is not tally. It compares the gutter and baseline grid increment
     * settings taken from the current layout and the ones read from the manifest folder.
     * This is about InDesign measurements (in points), not to be confused with the PLA page grid (in column/row counts).
     *
     * In practice, it turned out unworkable to compare all page layout settings (LA-187), and most settings actually
     * rather unimportant to be the same across all layouts of the section. Reason is that an article taken from source
     * layout A will perfectly be placed on target layout B while their margins/dimensions are not exactly matching.
     *
     * @param {{dimensions: {width: number, height: number}, margins: {top: number, bottom: number, inside: number, outside: number}, columns: {gutter: number}} settings
     * @param {UXP.Folder} exportFolder
     */
    async #saveOrComparePageLayoutSettings (settings, exportFolder) {
        const manifestFoldername = "_manifest";
        const settingsFilename = "page-layout-settings.json";
        const { entry: settingsFolder } = await this.#fileUtils.getOrCreateSubFolder(exportFolder, manifestFoldername);
        const { entry: settingsFile, created } = await this.#fileUtils.getOrCreateFile(settingsFolder, settingsFilename);
        if (created) {
            const settingsJson = JSON.stringify(settings, null, 4);
            const byteCount = await settingsFile.write(settingsJson, { format: formats.utf8 });
            if (!byteCount) {
                const message = `Could not write into file "${manifestFoldername}/${settingsFilename}".\nPlease check access rights.`;
                throw new Errors.ConfigurationError(message);
            }
        }
        else {
            const settingsOfPrecedingLayout = JSON.parse(await settingsFile.read({ format: formats.utf8 }));
            const diff = this.#diffInDesignPageLayoutGrid(settings, settingsOfPrecedingLayout);
            if (diff != null) {
                const message = "\n"
                    + "A page setting for the current layout differs from the preceding layout, processed before.\n"
                    + `The '${diff.propertyPath}' setting for the current layout is '${diff.lhsValue}' but for the preceding layout is '${diff.rhsValue}'.\n`
                    + `Settings of the preceding layout were saved in '${manifestFoldername}/${settingsFilename}'.\n`
                    + "For both layouts, check settings for menu items 'Document Setup' and 'Margins and Columns'.\n"
                    + "After adjusting the settings for any of the two layouts, remove the file and try both again.";
                throw new Errors.ConfigurationError(message);
            }
        }
    }

    /**
     * Compares the columns gutter and baseline grid increments properties of the page layout settings.
     * @param {PageLayoutSettings} lhsSettings
     * @param {PageLayoutSettings} rhsSettings
     * @returns {{propertyPath: string, lhsValue: Any, rhsValue: Any}|null} A property that differs, null otherwise.
     */
    #diffInDesignPageLayoutGrid (lhsSettings, rhsSettings) {
        const pathsToCompare = [
            "columns.gutter",
            "baseline-grid.increment",
            // Keep this list in sync with the diffInDesignPageLayoutGrid function in ArticleShapeUploader/modules/PageLayoutSettings.cjs
        ];
        for (const path of pathsToCompare) {
            const thisValue = this.#getPropertyValueByPath(lhsSettings, path);
            const thatValue = this.#getPropertyValueByPath(rhsSettings, path);
            if (thisValue != thatValue) {
                return { "propertyPath": path, "lhsValue": thisValue, "rhsValue": thatValue };
            }
        }
        return null;
    }

    /**
     * Resolves the value of a property (path) in a deeply nested DTO (obj).
     * @param {PageLayoutSettings} obj
     * @param {string} path
     * @returns {Any}
     */
    #getPropertyValueByPath (obj, path) {
        return path.split(".").reduce((acc, key) => acc?.[key], obj);
    }
}

module.exports = PageLayoutSettings;
