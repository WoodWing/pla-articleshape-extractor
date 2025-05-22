import fs from 'fs';
import path from 'path';


export class PageLayoutSettingsReader {
    #logger;
    #jsonValidator;
    #pageGrid;
    #settings;
    
    /**
     * @param {Logger} logger 
     * @param {JsonValidator} jsonValidator
     */
    constructor(logger, jsonValidator) {
        this.#logger = logger;
        this.#jsonValidator = jsonValidator;
        this.#pageGrid = null;
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
     * Provides the page layout settings. Raises error when not initialized yet.
     * @returns {Object}
     */
    _getSettings() {
        if (this.#settings === null) {
            throw new Error("Need for page layout settings before initialized.");
        }
        return this.#settings;
    }

    /**
     * @param {{columnCount: number, rowCount: number}} pageGrid 
     */
    setPageGrid(pageGrid) {
        this.#pageGrid = pageGrid;
    }

    /**
     * Provides the page grid. Raises error when not initialized yet.
     * @returns {{columnCount: number, rowCount: number}}
     */
    _getPageGrid() {
        if (this.#pageGrid === null) {
            throw new Error("Need for page grid before initialized.");
        }
        return this.#pageGrid;
    }

    /**
     * The width of one column in points. The column refers to the simple page grid configured for PLA.
     * @returns {number} Positive number.
     */
    getColumnWidth() {
        const columnCount = this._getPageGrid().columnCount;
        if (columnCount <= 0) {
            throw new Error(`The column count ${columnWidth} is invalid.`);
        }
        const gutterCount = columnCount - 1;
        const gutterWidth = this._getSettings().columns.gutter;
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
        return this._getSettings().columns.gutter;
    }

    /**
     * The width of the usable space within the page borders, in points.
     * @returns {number}
     */
    _getUsablePageWidth() {
        const pageWidth = this._getSettings().dimensions.width;
        const margins = this._getSettings().margins;
        return pageWidth - margins.inside - margins.outside;
    }

    /**
     * The border width in point of the inner margin of a page.
     * @returns {number} Right margin of a LHS page or left margin of a RHS page.
     */
    getPageMarginInside() {
        return this._getSettings().margins.inside;
    }

    /**
     * The height of one row in points. The row refers to the simple page grid configured for PLA.
     * @returns {number} Positive number.
     */
    getRowHeight() {
        const rowCount = this._getPageGrid().rowCount;
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
        const pageHeight = this._getSettings().dimensions.height;
        const margins = this._getSettings().margins;
        return pageHeight - margins.top - margins.bottom;
    }  
}