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
     * @returns {number} Positive number.
     */
    getColumnWidth() {
        const columnCount = this._grid.columnCount;
        if (columnCount <= 0) {
            throw new Error(`The column count ${columnWidth} is invalid.`);
        }
        const gutterCount = columnCount - 1;
        const gutterWidth = this._settings.columns.gutter;
        const sumOfGuttersWidth = gutterWidth * gutterCount;
        const columnWidth = (this._getUsablePageWidth() - sumOfGuttersWidth) / columnCount;
        if (columnWidth <= 0) {
            throw new Error(`The column width ${columnWidth} is invalid.`);
        }
        return columnWidth;
    }

    /**
     * The gutter space (in points) between the columns.
     * @returns {number}
     */
    getColumnGutter() {
        return this._settings.columns.gutter;
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
     * The border width in point of the inner margin of a page.
     * @returns {number} Right margin of a LHS page or left margin of a RHS page.
     */
    getPageMarginInside() {
        return this._settings.margins.inside;
    }

    /**
     * The height of one row in points. The row refers to the simple page grid configured for PLA.
     * @returns {number} Positive number.
     */
    getRowHeight() {
        const rowCount = this._grid.rowCount;
        if (rowCount <= 0) {
            throw new Error(`The row count ${rowCount} is invalid.`);
        }
        const rowHeight = this._getUsablePageHeight() / rowCount;
        if (rowHeight <= 0) {
            throw new Error(`The row height ${rowHeight} is invalid.`);
        }
        return rowHeight;
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