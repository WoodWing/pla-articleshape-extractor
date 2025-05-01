import crypto from 'crypto';

/**
 * Composes a hash of mostly the compositional data of an article shape.
 * The hash can be used to check if a similar article shape already exists.
 * 
 * Internally it creates a sanitized extract from the article shape JSON.
 * The extract, also in JSON format, is then serialized and hashed with SHA256.
 * 
 * It is crucial to generate the very same hash when the shape information is 
 * essentially the same. For that it takes the following precautions:
 * - The geometry of the whole article on the page is irrelevant, hence removed.
 * - For id-name pairs, the name may change (the id won't), hence names are removed.
 * - Text content and derived properties are irrelevant, hence those are removed.
 * - The geometry of frames is important but too precise/sensitive, hence numbers are rounded.
 * - The sequence properties occur in the JSON is irrelevant, hence recomposed in fixed order.
 * - The sequence of components and frames in the JSON is irrelevant, hence they are sorted.
 * - Geometrical information is sorted on y, then x. Text components are sorted on type.
 * 
 * IMPORTANT: Both significant- and irrelevant properties are taken into consideration.
 * Objects in the JSON file should exactly match with the combination of both collections.
 * When a new property got officially introduced, an conscious and explicit decision has
 * to be made for this checksum feature; It should become either a significant or irrelevant 
 * property. When it turns out to be significant, it will have an impact on the hash. In that 
 * case, all existing article shapes have to be re-imported into the configuration to be able 
 * to compare. Or else, the detection on duplicate article shapes will get broken.
 */
export class ArticleShapeHasher {

    /**
     * @param {Object} articleShape 
     * @returns {string} The hash.
     */
    hash(articleShape) {
        const significantKeys = [
            "brandId", "sectionId", "genreId", "shapeTypeName", "shapeTypeId",
            "foldLine", "textComponents", "imageComponents"
            // Don't simply add properties here. See class header first.
        ];
        const irrelevantKeys = [
            "brandName", "sectionName", "shapeTypeName", "geometricBounds"
            // Don't simply add properties here. See class header first.
        ];
        this._validateKeys(articleShape, significantKeys, irrelevantKeys, "<root>");

        const sanitized = {
            brandId: articleShape.brandId,
            sectionId: articleShape.sectionId,
            genreId: articleShape.genreId,
            shapeTypeId: articleShape.shapeTypeId,
            foldLine: articleShape.foldLine === null ? null : this._roundToInteger(articleShape.foldLine),
            textComponents: this._sanitizeTextComponents(articleShape.textComponents || []),
            imageComponents: this._sanitizeImageComponents(articleShape.imageComponents || [])
        };
        const jsonString = JSON.stringify(sanitized);
        return crypto.createHash("sha256").update(jsonString).digest("hex");
    }

    /**
     * Validate properties of a given object are either significant or irrelevant.
     * @param {Object} obj 
     * @param {Array<string>} significantKeys 
     * @param {Array<string>} irrelevantKeys 
     * @param {string} path 
     */
    _validateKeys(obj, significantKeys, irrelevantKeys, path) {
        const objectKeys = Object.keys(obj);
        for (const key1 of objectKeys) {
            if (!significantKeys.includes(key1) && !irrelevantKeys.includes(key1)) {
                throw new Error(`Unexpected property '${key1}' at ${path}`);
            }
        }
        for (const key2 of significantKeys.concat(irrelevantKeys)) {
            if (!objectKeys.includes(key2)) {
                throw new Error(`Missing property '${key2}' at ${path}`);
            }
        }
    }

    /**
     * Round a precision number to the nearest integer.
     * @param {number} value 
     * @returns {number}
     */
    _roundToInteger(value) {
        return typeof value === "number" ? Math.round(value) : value;
    }

    /**
     * @param {Object} geometricBounds 
     * @param {string} path
     * @returns {Object} The sanitized geometricBounds.
     */
    _sanitizeGeometricBounds(geometricBounds, path) {
        const significantKeys = [
            "x", "y", "width", "height"
            // Don't simply add properties here. See class header first.
        ];
        const irrelevantKeys = [
            // Don't simply add properties here. See class header first.
        ];
        this._validateKeys(geometricBounds, significantKeys, irrelevantKeys, path);
        const rounded = {};
        for (const key of significantKeys) {
            rounded[key] = this._roundToInteger(geometricBounds[key]);
        }
        return rounded;
    }

    /**
     * @param {Array<Object>} textComponents 
     * @returns {Object} The sanitized textComponents.
     */
    _sanitizeTextComponents(textComponents) {
        const significantKeys = [
            "type", "firstParagraphStyle", "frames"
            // Don't simply add properties here. See class header first.
        ];
        const irrelevantKeys = [
            "words", "characters"
            // Don't simply add properties here. See class header first.
        ];
        return textComponents.map((textComponent, componentIndex) => {
            const componentPath = `textComponents[${componentIndex}]`;
            this._validateKeys(textComponent, significantKeys, irrelevantKeys, componentPath);
            const sanitizedFrames = textComponent.frames.map((frame, frameIndex) => {
                const frameSignificantKeys = [
                    "geometricBounds", "columns", "textWrapMode"
                    // Don't simply add properties here. See class header first.
                ];
                const frameIrrelevantKeys = [
                    "words", "characters", "totalLineHeight", "text"
                    // Don't simply add properties here. See class header first.
                ];
                const framePath = componentPath +`frames[${frameIndex}]`;
                this._validateKeys(frame, frameSignificantKeys, frameIrrelevantKeys, framePath);
                return {
                    geometricBounds: this._sanitizeGeometricBounds(frame.geometricBounds, framePath + "geometricBounds"),
                    columns: frame.columns,
                    textWrapMode: frame.textWrapMode
                };
            }).sort((a, b) => {
                const ay = a.geometricBounds.y, by = b.geometricBounds.y;
                const ax = a.geometricBounds.x, bx = b.geometricBounds.x;
                return ay !== by ? ay - by : ax - bx;
            });

            return {
                type: textComponent.type,
                firstParagraphStyle: textComponent.firstParagraphStyle,
                frames: sanitizedFrames
            };
        })
            .sort((a, b) => a.type.localeCompare(b.type));
    }

    /**
     * @param {Array<Object>} imageComponents 
     * @returns {Object} The sanitized imageComponents.
     */
    _sanitizeImageComponents(imageComponents) {
        const significantKeys = [
            "geometricBounds", "textWrapMode"
            // Don't simply add properties here. See class header first.
        ];
        const irrelevantKeys = [
            // Don't simply add properties here. See class header first.
        ];
        return imageComponents.map((imageComponent, componentIndex) => {
            const path = `imageComponents[${componentIndex}]`;
            this._validateKeys(imageComponent, significantKeys, irrelevantKeys, path);
            return {
                geometricBounds: this._sanitizeGeometricBounds(imageComponent.geometricBounds, path + "geometricBounds"),
                textWrapMode: imageComponent.textWrapMode
            };
        }).sort((a, b) => {
            const ay = a.geometricBounds.y, by = b.geometricBounds.y;
            const ax = a.geometricBounds.x, bx = b.geometricBounds.x;
            return ay !== by ? ay - by : ax - bx;
        });
    }
}
