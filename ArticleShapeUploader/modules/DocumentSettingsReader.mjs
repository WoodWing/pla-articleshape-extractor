import fs from 'fs';
import path from 'path';


export class DocumentSettingsReader {
    /**
     * @param {Logger} logger 
     * @param {columnCount: number, rowCount: number} grid 
     */
    constructor(logger, grid) {
        this._logger = logger;
        this._grid = grid;
        this._settings = null;
    }

    /**
     * Name of the layout document settings JSON file.
     * @returns {string}
     */
    getFilename() {
        return "document-settings.json";
    }

    /**
     * @param {string} folderPath 
     */
    readSettings(folderPath) {
        const settingsPath = path.join(folderPath, this.getFilename());
        try {
            this._settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        } catch(error) {
            throw new Error(`The file "${settingsPath}" is not valid JSON - ${error.message}`);
        }    
    }

    /**
     * The width of one column in points. The column refers to the simple page grid configured for PLA.
     * @returns {number}
     */
    getColumnWidth() {
        const columnCount = this._grid.columnCount;
        const gutterCount = columnCount - 1;
        const gutterWidth = this._settings.columns.gutter;
        const sumOfGuttersWidth = gutterWidth * gutterCount;
        return (this._getUsablePageWidth() - sumOfGuttersWidth) / columnCount;
    }

    /**
     * The width of the usable space within the page borders, in points.
     * @returns {number}
     */
    _getUsablePageWidth() {
        const pageWidth = this._settings.dimensions.width;
        const margins = this._settings.margins;
        return pageWidth - margins.inside - margins.outside;
    }

    /**
     * The height of one row in points. The row refers to the simple page grid configured for PLA.
     * @returns {number}
     */
    getRowHeight() {
        const rowCount = this._grid.rowCount;
        return this._getUsablePageHeight() / rowCount;
    }

    /**
     * The height of the usable space within the page borders, in points.
     * @returns {number}
     */
    _getUsablePageHeight() {
        const pageHeight = this._settings.dimensions.height;
        const margins = this._settings.margins;
        return pageHeight - margins.top - margins.bottom;
    }  
}