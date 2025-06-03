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
            const page = doc.pages.item(0);
            const { inside, outside } = this.#getInsideOutsideMargins(doc, page);
            const settings = this.#composeSettings(doc, page, inside, outside);
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
     * @param {Page} page 
     * @param {Number} inside 
     * @param {Number} outside 
     * @returns {dimensions: {width: Number, height: Number}, margins: {top: Number, bottom: Number, inside: Number, outside: Number}, columns: {gutter: Number}
     */
    #composeSettings(doc, page, inside, outside) {
        return {
            dimensions: {
                width: this.#roundTo3Decimals(doc.documentPreferences.pageWidth),
                height: this.#roundTo3Decimals(doc.documentPreferences.pageHeight)
            },
            margins: {
                top: this.#roundTo3Decimals(page.marginPreferences.top), 
                bottom: this.#roundTo3Decimals(page.marginPreferences.bottom), 
                inside: this.#roundTo3Decimals(inside), 
                outside: this.#roundTo3Decimals(outside)
            }, 
            columns: {
                gutter: this.#roundTo3Decimals(page.marginPreferences.columnGutter)
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
     * Retrieve the Inside and Outside fields.
     * @param {Document} doc 
     * @param {Page} page 
     * @returns {inside: Number, outside: Number}
     */
    #getInsideOutsideMargins(doc, page) {
        let inside = null;
        let outside = null;
        if (doc.documentPreferences.facingPages) { // spread setup
            if (page.side.equals(idd.PageSideOptions.LEFT_HAND)) {
                inside = page.marginPreferences.right;
                outside = page.marginPreferences.left;
            } else if (page.side.equals(idd.PageSideOptions.RIGHT_HAND)) {
                inside = page.marginPreferences.left;
                outside = page.marginPreferences.right;
            } else {
                const { UnexpectedPageSetupError } = require('./Errors.mjs');
                const message = `Facing pages is enabled but page side ${page.side} is neither left or right.`;
                throw new UnexpectedPageSetupError(message);
            }
        } else { // single page setup
            if (page.side.equals(idd.PageSideOptions.SINGLE_SIDED)) {
                inside = page.marginPreferences.left;
                outside = page.marginPreferences.right;
            } else {
                const { UnexpectedPageSetupError } = require('./Errors.mjs');
                const message = `Facing pages is disabled but page side ${page.side} is not single.`;
                throw new UnexpectedPageSetupError(message);
            }
        }
        return {
            inside: outside,
            outside: outside
        }
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
                const { ConfigurationError } = require('./Errors.mjs');
                const message = "\n" 
                    + "Page layout settings of current layout differ with preceding layout, processed just before.\n"
                    + `Note that setting of preceding layout were saved in "${manifestFoldername}/${settingsFilename}".\n`
                    + "For both layouts, check settings for menu items 'Document Setup' and 'Margins and Columns'.\n"
                    + "After adjusting the settings for any of the two layouts, remove the file and try both again.";
                throw new ConfigurationError(message);
            }
        }
    }

    /**
     * Creates a subfolder under a given parent folder. Returns the subfolder if already exists.
     * @param {Folder} parentFolder
     * @param {string} subfolderName
     * @returns {{entry: Folder, created: boolean}}
     */
    async #getOrCreateSubFolder(parentFolder, subfolderName) {
        try {
            return {entry: await parentFolder.getEntry(subfolderName), created: false};
        } catch (e) {
            return {entry: await parentFolder.createFolder(subfolderName, { overwrite: false }), created: true};
        }
    }

    /**
     * Creates a file in a given folder. Returns the file if already exists.
     * @param {Folder} folder 
     * @param {string} filename 
     * @returns {{entry: File, created: boolean}}
     */
    async #getOrCreateFile(folder, filename) {
        try {
            return {entry: await folder.getEntry(filename), created: false};
        } catch (e) {
            return {entry: await folder.createFile(filename, { overwrite: false }), created: true};
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