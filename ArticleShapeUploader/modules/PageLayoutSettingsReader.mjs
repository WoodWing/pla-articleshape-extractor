import fs from 'fs';
import path from 'path';


export class PageLayoutSettingsReader {
    #logger;
    #jsonValidator;
    #grid;
    #settings;
    
    /**
     * @param {Logger} logger 
     * @param {JsonValidator} jsonValidator
     * @param {columnCount: number, rowCount: number} grid 
     */
    constructor(logger, jsonValidator, grid) {
        this.#logger = logger;
        this.#jsonValidator = jsonValidator;
        this.#grid = grid;
        this.#settings = null;
    }

    /**
     * Name of the page layout settings JSON file.
     * @returns {string}
     */
    getFilename() {
        return "page-layout-settings.json";
    }

    /**
     * @param {string} folderPath 
     * @return {Object}
     */
    readSettings(folderPath) {
        const settingsPath = path.join(folderPath, this.getFilename());
        try {
            this.#settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        } catch(error) {
            throw new Error(`The file "${settingsPath}" is not valid JSON - ${error.message}`);
        }
        this.#jsonValidator.validate('page-layout-settings', this.#settings);
        this.#logger.info(`The ${this.getFilename()} file is valid.`);
        return this.#settings;
    }

    /**
     * The width of one column in points. The column refers to the simple page grid configured for PLA.
     * @returns {number} Positive number.
     */
    getColumnWidth() {
        const columnCount = this.#grid.columnCount;
        if (columnCount <= 0) {
            throw new Error(`The column count ${columnWidth} is invalid.`);
        }
        const gutterCount = columnCount - 1;
        const gutterWidth = this.#settings.columns.gutter;
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
        return this.#settings.columns.gutter;
    }

    /**
     * The width of the usable space within the page borders, in points.
     * @returns {number}
     */
    _getUsablePageWidth() {
        const pageWidth = this.#settings.dimensions.width;
        const margins = this.#settings.margins;
        return pageWidth - margins.inside - margins.outside;
    }

    /**
     * The border width in point of the inner margin of a page.
     * @returns {number} Right margin of a LHS page or left margin of a RHS page.
     */
    getPageMarginInside() {
        return this.#settings.margins.inside;
    }

    /**
     * The height of one row in points. The row refers to the simple page grid configured for PLA.
     * @returns {number} Positive number.
     */
    getRowHeight() {
        const rowCount = this.#grid.rowCount;
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
        const pageHeight = this.#settings.dimensions.height;
        const margins = this.#settings.margins;
        return pageHeight - margins.top - margins.bottom;
    }  
}