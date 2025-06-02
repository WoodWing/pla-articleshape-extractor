/**
 * Understands how to obtain the id/name info for all brands and their categories
 * and how to provides that information in the _manifest subfolder of the export folder.
 * 
 * @constructor
 * @param {Logger} logger 
 * @param {StudioJsonRpcClient} studioJsonRpcClient
 */
function BrandSectionMapResolver(logger, studioJsonRpcClient) {
    this._logger = logger;
    this._studioJsonRpcClient = studioJsonRpcClient;

    /**
     * Resolves all brand ids/names and their section ids/names from Studio Server.
     * Writes this info into a file named "brand-section-map.json" in the provided folder.
     * @param {Folder} exportFolder 
     */
    this.run = async function(exportFolder) {
        if (!this._studioJsonRpcClient.hasSession()) {
            return; // only provide info when having a session
        }
        const publicationInfos = this._studioJsonRpcClient.getPublicationInfos(["Categories"]);
        const brandSectionMap = this._composeBrandSectionMap(publicationInfos);
        await this._saveBrandSectionMapToDisk(brandSectionMap, exportFolder);
    }

    /**
     * @param {Array<Object>} publicationInfos List of PublicationInfo data objects.
     * @returns {Object}
     */
    this._composeBrandSectionMap = function(publicationInfos) {
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
    this._saveBrandSectionMapToDisk = async function(brandSectionMap, exportFolder) {
        const filepath = window.path.join(exportFolder, "_manifest", "brand-section-map.json");
        const lfs = require('uxp').storage.localFileSystem;
        const formats = require('uxp').storage.formats;
        const jsonFile = await lfs.createEntryWithUrl(filepath, { overwrite: true });
        const jsonString = JSON.stringify(brandSectionMap, null, 4);
        jsonFile.write(jsonString, {format: formats.utf8}); 
        this._logger.info(`Saved the ids/names of brands and their sections to "${filepath}".`);
    }
}

module.exports = BrandSectionMapResolver;