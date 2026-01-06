/**
 * Understands how to resolve the Brand and Section.
 */
class BrandSectionResolver {
    /** @type {Logger} */
    #logger;

    /** @type {BrandInfo} */
    #fallbackBrand;

    /** @type {SectionInfo} */
    #fallbackCategory;

    /**
     * @param {Logger} logger
     * @param {BrandInfo} fallbackBrand
     * @param {SectionInfo} fallbackCategory
     */
    constructor (
        logger,
        fallbackBrand,
        fallbackCategory,
    ) {
        this.#logger = logger;
        this.#fallbackBrand = fallbackBrand;
        this.#fallbackCategory = fallbackCategory;
    }

    /**
     * When there is a valid session and the layout is stored in Studio, take the brand and section from
     * the layout, otherwise take the brand- and section fallback settings from the config files.
     * @param {IDD.Document} doc
     * @returns {{brand: BrandInfo, section: SectionInfo}}
     */
    resolve (doc) {
        let brand = null;
        let section = null;
        let source = null;
        try {
            brand = app.entSession.getPublication(
                doc.entMetaData.get("Core_Publication"),
            );
            section = app.entSession.getCategory(
                doc.entMetaData.get("Core_Publication"),
                doc.entMetaData.get("Core_Section"),
                doc.entMetaData.get("Core_Issue"),
            );
            source = "document";
        }
        catch {
            brand = this.#fallbackBrand;
            section = this.#fallbackCategory;
            source = "settings";
        }
        this.#logger.info(
            `Resolved brand '${brand.name}' (id=${brand.id}) `
            + `and category '${section.name}' (id=${section.id}) from ${source}.`,
        );
        return { brand, section };
    }
}

module.exports = BrandSectionResolver;
