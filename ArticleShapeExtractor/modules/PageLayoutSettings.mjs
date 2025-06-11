const { app } = require("indesign");
const idd = require("indesign");
const lfs = require('uxp').storage.localFileSystem;
const formats = require('uxp').storage.formats;

/**
 * Understands how to get the settings from InDesign as shown in the Margins and Columns dialog.
 */
class PageLayoutSettings{

    /** @type {Logger} */
    #logger;

    /** @type {FileUtils} */
    #fileUtils;

    /**
     * @param {Logger} logger 
     * @param {FileUtils} fileUtils
     */
    constructor(logger, fileUtils) {
        this.#logger = logger;
        this.#fileUtils = fileUtils;
    }

    /**
     * Exports the layout settings of the given layout document to a file named
     * "_manifest/page-layout-settings.json" in the given folder. When this file 
     * already exists, the settings are compared instead.
     * @param {Document} doc 
     * @param {Folder} folder 
     * @returns {boolean} True when the settings are matching (or new), false otherwise.
     */
    async exportSettings(doc, folder) {
        let exportedSuccessfully = false;
        const docName = doc.saved ? lfs.getNativePath(await doc.fullName) : doc.name;
        this.#logger.info("Exporting Document Settings for layout '{}'.", docName);
        app.scriptPreferences.measurementUnit = idd.MeasurementUnits.POINTS;
        try {
            if (doc.pages.length === 0) {
                const { NoDocumentPagesError } = require('./Errors.mjs');
                throw new NoDocumentPagesError();
            }
            for (let i = 0; i < doc.pages.length; i++) {
                const pag = doc.pages.item(i);
                const side = pag.side.equals(idd.PageSideOptions.LEFT_HAND) ? "left" : "right";
                this.#logger.debug(`Page: id=${pag.id}, index=${pag.index}, name=${pag.name}, side=${side}`);
            }
            const baselineStart = this.#getBaselineStart(doc, page);
            const settings = this.#composeSettings(doc, baselineStart);
            await this.#saveOrComparePageLayoutSettings(settings, folder);
            exportedSuccessfully = true;
        } catch(error) {
            const { ConfigurationError } = require('./Errors.mjs');
            if (error instanceof ConfigurationError) {
                this.#logger.error(error.message);
            } else {
                this.#logger.logError(error);
            }
            alert("An error occurred: " + error.message);
        } finally {
            app.scriptPreferences.measurementUnit = idd.AutoEnum.AUTO_VALUE;
        }
        return exportedSuccessfully;
    }

    /**
     * @param {Document} doc 
     * @param {Number} baselineStart 
     * @returns {dimensions: {width: Number, height: Number}, margins: {top: Number, bottom: Number, inside: Number, outside: Number}, columns: {gutter: Number}
     */
    #composeSettings(doc, baselineStart) {
        return {
            dimensions: {
                width: this.#roundTo3Decimals(doc.documentPreferences.pageWidth),
                height: this.#roundTo3Decimals(doc.documentPreferences.pageHeight)
            },
            margins: {
                top: this.#roundTo3Decimals(doc.marginPreferences.top), 
                bottom: this.#roundTo3Decimals(doc.marginPreferences.bottom), 
                inside: this.#roundTo3Decimals(doc.marginPreferences.left), 
                outside: this.#roundTo3Decimals(doc.marginPreferences.right)
            }, 
            columns: {
                gutter: this.#roundTo3Decimals(doc.marginPreferences.columnGutter)
            },
            "baseline-grid": {
                start: this.#roundTo3Decimals(baselineStart),
                increment: this.#roundTo3Decimals(doc.gridPreferences.baselineDivision)
            }
        };        
    }

    /**
     * Round a given number to a precision of maximum 3 decimals.
     * @param {Number} precisionNumber 
     * @returns {Number}
     */
    #roundTo3Decimals(precisionNumber) {
        return Math.round(precisionNumber * 1000) / 1000;
    }    

    /**
     * Retrieve the baseline start field when set relative to top of page. 
     * When set relative to top of margin, the returned value is normalized to top of page.
     * @param {Document} doc 
     * @param {Page} page 
     * @returns number Baseline start (always relative to top of page).
     */    
    #getBaselineStart(doc, page) {
        const baselineStart = doc.gridPreferences.baselineStart;
        const isGridRelativeToPageMargins = doc.gridPreferences.baselineGridRelativeOption.equals(
            idd.BaselineGridRelativeOption.TOP_OF_MARGIN_OF_BASELINE_GRID_RELATIVE_OPTION);
        if (isGridRelativeToPageMargins) {
            baselineStart += page.marginPreferences.top;
            this.#logger.debug(
                `Baseline start is configured as relative to top margin, but exported as relative to top of page: `
                + `${doc.gridPreferences.baselineStart} (=start) + ${page.marginPreferences.top} (=top margin) = ${baselineStart}`
            );
        } else {
            this.#logger.debug(`Baseline start is configured and exported as relative to top of page: ${baselineStart}`);
        }
        return baselineStart;
    }

    /**
     * Save a settings object to the "_manifest/page-layout-settings.json" file in a provided export folder.
     * If the file already exists, it compares whether the given settings are equal with settings from the file.
     * @param {Object} settings
     * @param {Folder} exportFolder
     */
    async #saveOrComparePageLayoutSettings(settings, exportFolder) {
        const manifestFoldername = "_manifest";
        const settingsFilename = "page-layout-settings.json";
        const { entry: settingsFolder, _ } = await this.#fileUtils.getOrCreateSubFolder(exportFolder, manifestFoldername);
        const { entry: settingsFile, created } = await this.#fileUtils.getOrCreateFile(settingsFolder, settingsFilename);
        if (created) {
            const settingsJson = JSON.stringify(settings, null, 4);
            const byteCount = await settingsFile.write(settingsJson, {format: formats.utf8}); 
            if (!byteCount ) {
                const { ConfigurationError } = require('./Errors.mjs');
                const message = `Could not write into file "${manifestFoldername}/${settingsFilename}".\nPlease check access rights.`;
                throw new ConfigurationError(message);
            }
        } else {
            const settingsOfPrecedingLayout = JSON.parse(await settingsFile.read({format: formats.utf8}));
            if (!this.#isDeepEqual(settings, settingsOfPrecedingLayout)) {
                this.#logger.error("Detected differences in settings:\n"
                    + `1) current layout: ${JSON.stringify(settings, null, 4)}\n`
                    + `2) page-layout-settings.json:\n${JSON.stringify(settingsOfPrecedingLayout, null, 4)}\n`
                );
                const { ConfigurationError } = require('./Errors.mjs');
                const message = "\n" 
                    + "Page layout settings of current layout differ with preceding layout, processed just before.\n"
                    + `Note that setting of preceding layout were saved in "${manifestFoldername}/${settingsFilename}".\n`
                    + "For both layouts, check settings for menu items 'Document Setup' and 'Margins and Columns'.\n"
                    + "After adjusting the settings for any of the two layouts, remove the file and try both again.\n"
                    + "See also logging for the differences found.";
                throw new ConfigurationError(message);
            }
        }
    }

    /**
     * Compares two items, such as two objects and all their properties.
     * @param {any} lhs 
     * @param {any} rhs 
     * @returns {boolean}
     */
    #isDeepEqual(lhs, rhs) {
        const objectKeys = Object.keys;
        if (lhs && rhs && (typeof lhs) === 'object' && (typeof rhs) === 'object') {
            return objectKeys(lhs).length === objectKeys(rhs).length &&
                objectKeys(lhs).every(
                    key => this.#isDeepEqual(lhs[key], rhs[key])
                )
        }
        return lhs === rhs;
    }
}

module.exports = PageLayoutSettings;