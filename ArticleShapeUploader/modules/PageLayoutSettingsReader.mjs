import fs from 'fs';
import path from 'path';


export class PageLayoutSettingsReader {

    /** @type {ColoredLogger} */
    #logger;

    /** @type {JsonValidator} */
    #jsonValidator;

    /** @type {{columnCount: number, rowCount: number}|null} */
    #pageGrid;

    /** @type {Object|null} */
    #settings;
    
    /**
     * @param {ColoredLogger} logger 
     * @param {JsonValidator} jsonValidator
     */
    constructor(logger, jsonValidator) {
        this.#logger = logger;
        this.#jsonValidator = jsonValidator;
        this.#pageGrid = null;
        this.#settings = null;
    }

    /**
     * @param {Object} settings 
     */
    initSettings (settings) {
        this.#settings = settings;
    }

    /**
     * @param {string} folderPath 
     * @return {Object}
     */
    readSettings(folderPath) {
        const manifestFoldername = "_manifest";
        const settingsFilename = "page-layout-settings.json";
        const settingsPath = path.join(folderPath, manifestFoldername, settingsFilename);
        if (!fs.existsSync(settingsPath) || !fs.lstatSync(settingsPath).isFile()) {
            throw new Error(`The file "${settingsPath}" is not found. Run the ArticleShapeExtractor and try again.`);
        }
        try {
            this.#settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        } catch(error) {
            throw new Error(`The file "${settingsPath}" is not valid JSON - ${error.message}`);
        }
        this.#jsonValidator.validate('page-layout-settings', this.#settings);
        this.#logger.info(`The "${manifestFoldername}/${settingsFilename}" file is valid.`);

        return this.#settings;
    }


    /**
     * Provides the page layout settings. Raises error when not initialized yet.
     * @returns {Object}
     */
    #getSettings() {
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
    #getPageGrid() {
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
        const columnCount = this.#getPageGrid().columnCount;
        if (columnCount <= 0) {
            throw new Error(`The column count ${columnWidth} is invalid.`);
        }
        const gutterCount = columnCount - 1;
        const gutterWidth = this.#getSettings().columns.gutter;
        const sumOfGuttersWidth = gutterWidth * gutterCount;
        const columnWidth = (this.#getUsablePageWidth() - sumOfGuttersWidth) / columnCount;
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
        return this.#getSettings().columns.gutter;
    }

    /**
     * The width of the usable space within the page borders, in points.
     * @returns {number}
     */
    #getUsablePageWidth() {
        const pageWidth = this.#getSettings().dimensions.width;
        const margins = this.#getSettings().margins;
        return pageWidth - margins.inside - margins.outside;
    }

    /**
     * The border width in point of the inner margin of a page.
     * @returns {number} Right margin of a LHS page or left margin of a RHS page.
     */
    getPageMarginInside() {
        return this.#getSettings().margins.inside;
    }

    /**
     * The height of one row in points. The row refers to the simple page grid configured for PLA.
     * @returns {number} Positive number.
     */
    getRowHeight() {
        const rowCount = this.#getPageGrid().rowCount;
        if (rowCount <= 0) {
            throw new Error(`The row count ${rowCount} is invalid.`);
        }
        const rowHeight = this.#getUsablePageHeight() / rowCount;
        if (rowHeight <= 0) {
            throw new Error(`The row height ${rowHeight} is invalid.`);
        }
        return rowHeight;
    }

    /**
     * The height of the usable space in points. Usable space is the page area where content can be placed.
     * The height of this area is the space between the page top margin and the page bottom margin.
     * @returns {number}
     */
    #getUsablePageHeight() {
        const settings = this.#getSettings();
        return settings.dimensions.height - settings.margins.top - settings.margins.bottom;
    }  
}