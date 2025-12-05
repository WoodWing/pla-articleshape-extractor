export class PageLayoutSettings {

    /** @type {{columnCount: number, rowCount: number}} */
    #pageGrid;

    /** @type {Object} */
    #settings;
    
    /**
     * 
     * @param {Object} settings 
     * @param {{columnCount: number, rowCount: number}} pageGrid 
     */
    constructor(settings, pageGrid) {
        this.#pageGrid = pageGrid;
        this.#settings = settings;
    }

    /**
     * The width of one column in points. The column refers to the simple page grid configured for PLA.
     * @returns {number} Positive number.
     */
    getColumnWidth() {
        const columnCount = this.#pageGrid.columnCount;
        if (columnCount <= 0) {
            throw new Error(`The column count ${columnCount} is invalid.`);
        }
        const gutterCount = columnCount - 1;
        const gutterWidth = this.#settings.columns.gutter;
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
        return this.#settings.columns.gutter;
    }

    /**
     * Compares the columns gutter and baseline grid increments properties of the page layout settings.
     * @param {PageLayoutSettings} that The other page settings to compare with.
     * @returns {{propertyPath: string, lhsValue: Any, rhsValue: Any}|null} A property that differs, null otherwise.
     */
    diffInDesignPageLayoutGrid(that) {
        const pathsToCompare = [
            "columns.gutter",
            "baseline-grid.increment"
        ];
        for (const path of pathsToCompare) {
            const thisValue = this.#getPropertyValueByPath(this.#settings, path);
            const thatValue = this.#getPropertyValueByPath(that.#settings, path);
            if (thisValue != thatValue) {
                return {"propertyPath": path, "lhsValue": thisValue, "rhsValue": thatValue};
            }
        }
        return null;
    }

    /**
     * Resolves the value of a property (path) in a deeply nested DTO (obj).
     * @param {Object} obj 
     * @param {string} path 
     * @returns {Any}
     */
    #getPropertyValueByPath(obj, path) {
        return path.split('.').reduce((acc, key) => acc?.[key], obj);
    }

    /**
     * The width of the usable space within the page borders, in points.
     * @returns {number}
     */
    #getUsablePageWidth() {
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
        const rowCount = this.#pageGrid.rowCount;
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
        const settings = this.#settings;
        return settings.dimensions.height - settings.margins.top - settings.margins.bottom;
    }  
}