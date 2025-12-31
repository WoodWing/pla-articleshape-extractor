/**
 * Understands how to make a place article fit using the AI fitting service.
 */
class FitArticleWithAIService {

    /** @type {Logger} */
    #logger;

    /** @type {StudioJsonRpcClient} */
    #studioJsonRpcClient;

    /** @type {PlaService} */
    #plaService;

    /** @type {BrandSectionResolver} */
    #brandSectionResolver;

    /**
     * @param {Logger} logger
     * @param {StudioJsonRpcClient} studioJsonRpcClient
     * @param {PlaService} plaService
     * @param {BrandSectionResolver} brandSectionResolver
     */
    constructor (logger, studioJsonRpcClient, plaService, brandSectionResolver) {
        this.#logger = logger;
        this.#studioJsonRpcClient = studioJsonRpcClient;
        this.#plaService = plaService;
        this.#brandSectionResolver = brandSectionResolver;
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
     *
     * @param {Document} doc
     */
    async run (doc) {

        // Bail out when user is currently not logged in.
        if (!this.#studioJsonRpcClient.hasSession()) {
            const { NoStudioSessionError } = require("./Errors.cjs");
            throw new NoStudioSessionError();
        }

        // Resolve brand and section from layout doc (or use fallback settings).
        const { brand, section } = this.#brandSectionResolver.resolve(doc);

        /*const pubInfos =*/ await this.#studioJsonRpcClient.getPublicationInfos([brand.id]);
        const accessToken = await this.#studioJsonRpcClient.getAccessToken(brand.id);
        /*const dimensions =*/ await this.#plaService.getSheetDimensions(accessToken, brand.id);
        // TODO: Error when layout does not occur in any of the dimensions.
        const shapeFiles = await this.#retrieveArticleShapeSuggestions(accessToken, brand, section);
        for (const shapeFile of shapeFiles) {
            this.#logger.debug(`Removing article shape JSON '${shapeFile.nativePath}'.`);
            await shapeFile.delete();
        }
    }

    /**
     * Request for shape suggestions and retrieve the article JSON files into temp folder.
     * @param {string} accessToken
     * @param {{id: string, name: string}} brand
     * @param {{id: string, name: string}} section
     * @returns {Array<File>}
     */
    async #retrieveArticleShapeSuggestions (accessToken, brand, section) {
        // TODO: Take values from extracted shape instead (to compose the request body).
        const width = 2, height = 6, foldLine = null, genreId = null;
        const requestBody = this.#plaService.composeSuggestArticleShapesRequestBody(
            genreId, 1, // genreId, shapeType,
            3000, 1, 1, // bodyLength, imageCount, quoteCount,
            width, height, foldLine, 5, // width, height, foldLine, shapeCount
        );
        const downloadUrls = await this.#plaService.suggestArticleShapes(
            accessToken, brand.id, section.id, requestBody,
        );
        if (downloadUrls.length === 0) {
            const message = "No article shape suggestions found:\n"
                + `- within the brand '${brand.name}' (id=${brand.id}) and section '${section.name}' (id=${section.id})`
                + (genreId ? ` and genre '${genreId}'` : "") + ";\n"
                + `- having dimension of ${width} columns and ${height} rows;\n`
                + "- having " + (foldLine ? `a fold line between columns ${foldLine} and ${foldLine + 1}` : "no fold line") + ".\n";
            throw new Error(message);
        }
        const articleShapeFiles = [];
        for (const downloadUrl of downloadUrls) {
            const response = await fetch(downloadUrl);
            const articleShapeJson = await response.json();
            const articleShapeFile = await this.#writeArticleJsonToTemp(articleShapeJson);
            this.#logger.debug(`Wrote article shape JSON into '${articleShapeFile.nativePath}'.`);
            articleShapeFiles.push(articleShapeFile);
        }
        return articleShapeFiles;
    }

    /**
     * Create a new file in the temp folder and write the provided JSON data into it.
     * @param {Object} articleJson
     * @returns {File}
     */
    async #writeArticleJsonToTemp (articleJson) {
        const lfs = require("uxp").storage.localFileSystem;
        const formats = require("uxp").storage.formats;

        const tempFolder = await lfs.getTemporaryFolder();
        const uniqueName = `article_shape_${Date.now()}_${Math.floor(Math.random() * 1000000)}.json`;
        const articleShapeFile = await tempFolder.createFile(uniqueName, { overwrite: true });
        const jsonString = JSON.stringify(articleJson, null, 2);
        await articleShapeFile.write(jsonString, { format: formats.utf8 });
        return articleShapeFile;
    }
}

module.exports = FitArticleWithAIService;
