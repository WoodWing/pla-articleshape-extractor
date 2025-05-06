/**
 * Understands how to map custom element labels to the standard element labels.
 * 
 * An element label tells the type of a text component. Custom labels may be freely picked 
 * by the customer. Standard labels are the factory defaults provided by the Studio product.
 * 
 * For example, the custom could use custom element labels "brood 1" and "brood 2" which
 * both represent the standard "body" label. 
 * 
 * Context: The text components are counted per type for the PLA service so that it can 
 * apply a beam kNN search to find similar article shapes. It either needs to know how many 
 * text components of a type are provided by an article (e.g. quote_count) or it needs to
 * know to sum of characters fitted into all components of a certain type (e.g. body_length).
 * In both cases, it needs to know to map custom element labels to standard element labels.
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