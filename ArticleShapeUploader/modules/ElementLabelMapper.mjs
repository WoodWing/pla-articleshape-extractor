/**
 * Understands how to map custom element labels to the standard element labels.
 */

export class ElementLabelMapper {
    /**
     * @param {Object} elementLabels 
     */
    constructor(elementLabels) {
        this.labelCache = {};
        this.elementLabels = {};
        for (const [standardLabel, customLabel] of Object.entries(elementLabels)) {
            const customLabelRegEx = customLabel || "^" + standardLabel + "$";
            this.elementLabels[standardLabel] = new RegExp(customLabelRegEx, 'i');
        }
    }

    /**
     * @param {string} customLabel 
     * @returns {string} The standard label.
     */
    mapCustomToStandardLabel(customLabel) {
        if (this.labelCache[customLabel]) {
            return this.labelCache[customLabel];
        }
        for (const [standardLabel, customLabelRegExObj] of Object.entries(this.elementLabels)) {
            if (customLabelRegExObj.test(customLabel)) {
                this.labelCache[customLabel] = standardLabel;
                return standardLabel;
            }
        }
        throw new Error(`No mapping found for element label "${customLabel}". Please check your settings.`);
    }
}