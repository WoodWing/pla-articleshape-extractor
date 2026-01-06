/**
 * @typedef {Object} GeoBounds
 * @property {number} topLeftX       - Smallest X coordinate of the top-left corner.
 * @property {number} topLeftY       - Smallest Y coordinate of the top-left corner.
 * @property {number} bottomRightX   - Largest X coordinate of the bottom-right corner.
 * @property {number} bottomRightY   - Largest Y coordinate of the bottom-right corner.
 */

/**
 * @typedef {Object} ArticleShapeGeoBounds
 * @property {number} x      - X coordinate (top-left).
 * @property {number} y      - Y coordinate (top-left).
 * @property {number} width  - Width of the shape.
 * @property {number} height - Height of the shape.
 */

/**
 * @typedef {Object} ArticleShapeJson
 * @property {string} brandName
 * @property {string|number} brandId
 * @property {string} sectionName
 * @property {string|number} sectionId
 * @property {string|number|null} genreId
 * @property {string} shapeTypeName
 * @property {string|number} shapeTypeId
 * @property {ArticleShapeGeoBounds} geometricBounds
 * @property {null} foldLine
 * @property {Array<Object>} textComponents
 * @property {Array<Object>} imageComponents
 */

/**
 * @typedef {Object} ArticleShapeTypeInfo
 * @property {string} id
 * @property {string} name
 */

/**
 * @typedef {Object} BrandInfo
 * @property {string} id
 * @property {string} name
 */

/**
 * @typedef {Object} SectionInfo
 * @property {string} id
 * @property {string} name
 */
