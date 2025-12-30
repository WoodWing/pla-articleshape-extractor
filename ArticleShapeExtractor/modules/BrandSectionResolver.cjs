/**
 * Understands how to resolve the Brand and Section.
 */
class BrandSectionResolver {
    /** @type {Logger} */
    #logger;

    /** @type {{id: string, name: string}} */
    #fallbackBrand;

    /** @type {{id: string, name: string}} */
    #fallbackCategory;

    /**
     * @param {Logger} logger
     * @param {{id: string, name: string}} fallbackBrand
     * @param {{id: string, name: string}} fallbackCategory
     */
    constructor(
        logger,
        fallbackBrand,
        fallbackCategory
    ) {
        this.#logger = logger;
        this.#fallbackBrand = fallbackBrand;
        this.#fallbackCategory = fallbackCategory;
    }

    /**
     * When there is a valid session and the layout is stored in Studio, take the brand and section from
     * the layout, otherwise take the brand- and section fallback settings from the config files.
     * @param {Document} doc 
     * @returns {{brand: {id: string, name: string}, section: {id: string, name: string}}}
     */
    resolve(doc) {
        let brand = null;
        let section = null;
        let source = null;
        try {
            brand = app.entSession.getPublication(
                doc.entMetaData.get("Core_Publication")
            );
            section = app.entSession.getCategory(
                doc.entMetaData.get("Core_Publication"),
                doc.entMetaData.get("Core_Section"),
                doc.entMetaData.get("Core_Issue")
            );
            source = "document";
        } catch {
            brand = this.#fallbackBrand;
            section = this.#fallbackCategory;
            source = "settings";
        }
        this.#logger.info(
            `Resolved brand '${brand.name}' (id=${brand.id}) `
            + `and category '${section.name}' (id=${section.id}) from ${source}.`
        );
        return { brand, section };
    }
}

module.exports = BrandSectionResolver;