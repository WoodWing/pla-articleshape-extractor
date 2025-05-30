const { app } = require("indesign");

/**
 * Understands how to obtain the id/name info for all brands and their categories.
 * 
 * @constructor
 * @param {Logger} logger 
 */
function BrandSectionMapResolver(logger) {
    this._logger = logger;

    /**
     * Resolves all brand ids/names and their section ids/names from Studio Server.
     * Writes this info into a file named "brand-section-map.json" in the provided folder.
     * @param {Folder} exportFolder 
     */
    this.run = async function(exportFolder) {
        if (!app.entSession || !app.entSession.activeServer ) {
            return; // only provide info when having a session
        }
        const publicationInfos = this._getPublicationInfos(
            app.entSession.activeUrl, app.entSession.activeTicket);
        const brandSectionMap = this._composeBrandSectionMap(publicationInfos);
        await this._saveBrandSectionMapToDisk(brandSectionMap, exportFolder);
    }

    /**
     * Calls the GetPublications workflow service provided by Studio Server.
     * Uses the JSON-RPC communication protocol.
     * @param {string} serverUrl 
     * @param {string} ticket 
     * @returns {Array<Object>} List of PublicationInfo data objects.
     */
    this._getPublicationInfos = function(serverUrl, ticket) {
        const separator = serverUrl.indexOf("?") === -1 ? '?' : '&';
        const serverUrlJson = `${serverUrl}${separator}protocol=JSON`;
        const wflRequest = {
            "Ticket": ticket,
            "RequestInfo": ["Categories"]
        }
        const rpcRequest = {
            "method": "GetPublications",
            "id": "1",
            "params": [wflRequest],
            "jsonrpc": "2.0"
        };
        const rawRequest = JSON.stringify(rpcRequest);
        const rawResponse = app.jsonRequest(serverUrlJson, rawRequest);
        const rpcResponse = JSON.parse(rawResponse);
        const wflResponse = rpcResponse.result;
        this._logger.info(`Resolved ${wflResponse.Publications.length} brands (with their sections) from Studio Server.`);
        return wflResponse.Publications;
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