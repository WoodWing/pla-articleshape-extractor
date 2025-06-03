/**
 * Understands how to map custom element labels to the standard element labels.
 */

export class ElementLabelMapper {
    
    /** @type {ColoredLogger} */
    #logger;

    /** @type {JsonValidator} */
    #jsonValidator;

    /** @type {Object} */
    #elementMapping = {};
    
    /**
     * @param {ColoredLogger} logger 
     * @param {JsonValidator} jsonValidator 
     */
    constructor(logger, jsonValidator) {
        this.#logger = logger;
        this.#jsonValidator = jsonValidator;
    }

    /**
     * @param {Object|null} elementMapping 
     */
    init(elementMapping) {
        if (elementMapping === null) {
            throw new Error("No element label mapping configured. "
                + "Please import the PLA Config Excel file and try again.");
        }
        this.#jsonValidator.validate('element-mapping', elementMapping);
        this.#logger.info("Element label mapping is configured and valid.");
        this.#elementMapping = elementMapping;
    }

    /**
     * @param {string} customLabel 
     * @returns {string} The standard label.
     */
    mapCustomToStandardLabel(customLabel) {
        if (this.#elementMapping[customLabel]) {
            return this.#elementMapping[customLabel];
        }
        throw new Error(`No mapping found for element label "${customLabel}". Please check your settings.`);
    }
}