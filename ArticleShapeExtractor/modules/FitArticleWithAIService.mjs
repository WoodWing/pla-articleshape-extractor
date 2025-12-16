/**
 * Understands how to make a place article fit using the AI fitting service.
 */
class FitArticleWithAIService {

    /** @type {Logger} */
    #logger;
    
    /** @type {{{brand: <string>, issue: <string>, category: <string>, status: <string>}, layoutStatusOnSuccess: <string>, layoutStatusOnError: <string>}} */
    #settings;
    
    /** @type {StudioJsonRpcClient} */
    #studioJsonRpcClient;
    
    /** @type {PlaService} */
    #plaService;
    
    /**
     * @param {Logger} logger
     * @param {{{brand: <string>, issue: <string>, category: <string>, status: <string>}, layoutStatusOnSuccess: <string>, layoutStatusOnError: <string>}} settings
     * @param {StudioJsonRpcClient} studioJsonRpcClient
     * @param {PlaService} plaService
     */
    constructor(logger, settings, studioJsonRpcClient, plaService) {
        this.#logger = logger;
        this.#settings = settings;
        this.#studioJsonRpcClient = studioJsonRpcClient;
        this.#plaService = plaService;
    }

    /**
     * Fit the currently selected unfitted InDesign article.
     * 
     * Procedure:
     * - Extract unfitted shape from article.
     * - Retrieve access token from Studio Server CS plugin.
     * - Retrieve suggestions for the article from AILA service.
     * - Retrieve fitted shape from AI fitting service.
     * - Update the unfitted article with fitted shape (on the layout).
     */
    async run() {

        // Bail out when user is currently not logged in.
        if (!this.#studioJsonRpcClient.hasSession() ) {
            const { NoStudioSessionError } = require('./Errors.mjs');
            throw new NoStudioSessionError();
        }

        // TODO: Get brand id and section id from the current layout instead.
        const brandId = this.#settings.getOfflineFallbackConfig().brand.id;
        const sectionId = this.#settings.getOfflineFallbackConfig().category.id;

        const pubInfos = await this.#studioJsonRpcClient.getPublicationInfos([brandId]);
        const accessToken = await this.#studioJsonRpcClient.getAccessToken(brandId);
        const dimensions = await this.#plaService.getSheetDimensions(accessToken, brandId);
        const shapeFiles = await this.#retrieveArticleShapeSuggestions(accessToken, brandId, sectionId);
        for (const shapeFile of shapeFiles) {
            this.#logger.debug(`Removing article shape JSON '${shapeFile.nativePath}'.`)
            await shapeFile.delete();
        }
    }

    /**
     * Request for shape suggestions and retrieve the article JSON files into temp folder.
     * @param {string} accessToken 
     * @param {string} brandId 
     * @param {string} sectionId 
     * @returns {Array<File>}
     */
    async #retrieveArticleShapeSuggestions(accessToken, brandId, sectionId) {
        // TODO: Take values from extracted shape instead (to compose the request body).
        const width = 2, height = 7, foldLine = null, genreId = null;
        const requestBody = this.#plaService.composeSuggestArticleShapesRequestBody(
            genreId, 1, // genreId, shapeType, 
            3000, 1, 1, // bodyLength, imageCount, quoteCount,
            width, height, foldLine, 5, // width, height, foldLine, shapeCount        
        );
        const downloadUrls = await this.#plaService.suggestArticleShapes(
            accessToken, brandId, sectionId, requestBody
        );
        if (downloadUrls.length === 0) {
            const message = "No article shape suggestions found:\n"
                + "- within the current brand and section"
                + (genreId ? ` and genre '${genreId}'` : '') + ";\n"
                + `- having dimension of ${width} columns and ${height} rows;\n`
                + "- having " + (foldLine ? `a fold line between columns ${foldLine} and ${foldLine+1}` : 'no fold line') + ".\n";
            throw new Error(message);
        }
        const articleShapeFiles = [];
        for (const downloadUrl of downloadUrls) {
            const response = await fetch(downloadUrl);
            const articleShapeJson = await response.json();
            const articleShapeFile = await this.#writeArticleJsonToTemp(articleShapeJson);
            this.#logger.debug(`Wrote article shape JSON into '${articleShapeFile.nativePath}'.`)
            articleShapeFiles.push(articleShapeFile);
        }
        return articleShapeFiles;
    }

    /**
     * Create a new file in the temp folder and write the provided JSON data into it.
     * @param {Object} articleJson 
     * @returns {File}
     */
    async #writeArticleJsonToTemp(articleJson) {
        const lfs = require('uxp').storage.localFileSystem;
        const formats = require('uxp').storage.formats;

        const tempFolder = await lfs.getTemporaryFolder();
        const uniqueName = `article_shape_${Date.now()}_${Math.floor(Math.random() * 1000000)}.json`;
        const articleShapeFile = await tempFolder.createFile(uniqueName, { overwrite: true });
        const jsonString = JSON.stringify(articleJson, null, 2);
        await articleShapeFile.write(jsonString, { format: formats.utf8 });
        return articleShapeFile;
    }
}

module.exports = FitArticleWithAIService;