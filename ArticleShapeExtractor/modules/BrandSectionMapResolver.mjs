/**
 * Understands how to obtain the id/name info for all brands and their categories
 * and how to provides that information in the _manifest subfolder of the export folder.
 */
class BrandSectionMapResolver {

    /** @type {Logger} */
    #logger;

    /** @type {StudioJsonRpcClient} */
    #studioJsonRpcClient;

    /**
     * @param {Logger} logger 
     * @param {StudioJsonRpcClient} studioJsonRpcClient
     */
    constructor(logger, studioJsonRpcClient) {
        this.#logger = logger;
        this.#studioJsonRpcClient = studioJsonRpcClient;
    }

    /**
     * Resolves all brand ids/names and their section ids/names from Studio Server.
     * Writes this info into a file named "brand-section-map.json" in the provided folder.
     * @param {Folder} exportFolder 
     */
    async run(exportFolder) {
        if (!this.#studioJsonRpcClient.hasSession()) {
            return; // only provide info when having a session
        }
        const publicationInfos = this.#studioJsonRpcClient.getPublicationInfos(null, ["Categories"]);
        const brandSectionMap = this.#composeBrandSectionMap(publicationInfos);
        await this.#saveBrandSectionMapToDisk(brandSectionMap, exportFolder);
    }

    /**
     * @param {Array<Object>} publicationInfos List of PublicationInfo data objects.
     * @returns {Object}
     */
    #composeBrandSectionMap(publicationInfos) {
        const brandSetup = {};
        for (const publicationInfo of publicationInfos) {
            const categories = {};
            for (const category of publicationInfo.Categories) {
                categories[category.Name] = String(category.Id);
            }
            brandSetup[publicationInfo.Name] =  {
                id: String(publicationInfo.Id),
                sections: categories
            }
        }
        return brandSetup;
    }

    /**
     * @param {Object} brandSectionMap
     * @param {Folder} exportFolder
     */
    async #saveBrandSectionMapToDisk(brandSectionMap, exportFolder) {
        const filepath = window.path.join(exportFolder, "_manifest", "brand-section-map.json");
        const lfs = require('uxp').storage.localFileSystem;
        const formats = require('uxp').storage.formats;
        const jsonFile = await lfs.createEntryWithUrl(filepath, { overwrite: true });
        const jsonString = JSON.stringify(brandSectionMap, null, 4);
        jsonFile.write(jsonString, {format: formats.utf8}); 
        this.#logger.info(`Saved the ids/names of brands and their sections to "${filepath}".`);
    }
}

module.exports = BrandSectionMapResolver;