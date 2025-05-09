const { app } = require("indesign");
const idd = require("indesign");

/**
 * Understands how to get the settings from InDesign as shown in the Margins and Columns dialog.
 * 
 * @constructor
 * @param {Logger} logger 
 */
function LayoutDocumentSettings(logger) {
    this._logger = logger;

    this.exportSettings = async function(doc, folder) {
        const lfs = require('uxp').storage.localFileSystem;
        const docName = doc.saved ? lfs.getNativePath(await doc.fullName) : doc.name;
        this._logger.info("Exporting Document Settings for layout '{}'.", docName);
        app.scriptPreferences.measurementUnit = idd.MeasurementUnits.POINTS;
        try {
            if (doc.pages.length === 0) {
                const { NoDocumentPagesError } = require('../modules/Errors.js');
                throw new NoDocumentPagesError();
            }
            const page = doc.pages.item(0);
            const { inside, outside } = this._getInsideOutsideMargins(doc, page);
            const settings = this._composeSettings(doc, page, inside, outside);
            // TODO: Error when the settings file already exists with different settings.
            await this._saveDocumentSettingsToDisk(settings, folder);
        } catch(error) {
            this._logger.logError(error);
            alert("An error occurred: " + error.message);
        } finally {
            app.scriptPreferences.measurementUnit = idd.AutoEnum.AUTO_VALUE;
        }
    }

    /**
     * @param {DocumentTimeline} doc 
     * @param {Page} page 
     * @param {Number} inside 
     * @param {Number} outside 
     * @returns {dimensions: {width: Number, height: Number}, margins: {top: Number, bottom: Number, inside: Number, outside: Number}, columns: {gutter: Number}
     */
    this._composeSettings = function(doc, page, inside, outside) {
        return {
            dimensions: {
                width: this._roundTo3Decimals(doc.documentPreferences.pageWidth),
                height: this._roundTo3Decimals(doc.documentPreferences.pageHeight)
            },
            margins: {
                top: this._roundTo3Decimals(page.marginPreferences.top), 
                bottom: this._roundTo3Decimals(page.marginPreferences.bottom), 
                inside: this._roundTo3Decimals(inside), 
                outside: this._roundTo3Decimals(outside)
            }, 
            columns: {
                gutter: this._roundTo3Decimals(page.marginPreferences.columnGutter)
            }
        };        
    }

    /**
     * Round a given number to a precision of maximum 3 decimals.
     * @param {Number} precisionNumber 
     * @returns {Number}
     */
    this._roundTo3Decimals = function(precisionNumber) {
        return Math.round(precisionNumber * 1000) / 1000;
    }    

    /**
     * Retrieve the Inside and Outside fields.
     * @param {Document} doc 
     * @param {Page} page 
     * @returns {inside: Number, outside: Number}
     */
    this._getInsideOutsideMargins = function(doc, page) {
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
                const { UnexpectedPageSetupError } = require('../modules/Errors.js');
                const message = `Facing pages is enabled but page side ${page.side} is neither left or right.`;
                throw new UnexpectedPageSetupError(message);
            }
        } else { // single page setup
            if (page.side.equals(idd.PageSideOptions.SINGLE_SIDED)) {
                inside = page.marginPreferences.left;
                outside = page.marginPreferences.right;
            } else {
                const { UnexpectedPageSetupError } = require('../modules/Errors.js');
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
     * Save a settings object to the "document-settings.json" file in a provided folder.
     * @param {Object} settings
     * @param {Folder} folder
     */
    this._saveDocumentSettingsToDisk = async function(settings, folder) {
        const lfs = require('uxp').storage.localFileSystem;
        const settingsPath = window.path.join(folder, "document-settings.json")
        const settingsFile = await lfs.createEntryWithUrl(settingsPath, { overwrite: true });
        const settingsJson = JSON.stringify(settings, null, 4);
        const formats = require('uxp').storage.formats;
        settingsFile.write(settingsJson, {format: formats.utf8}); 
    }
}

module.exports = LayoutDocumentSettings;