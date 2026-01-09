const ind = require("indesign");
const Errors = require("./Errors.cjs");

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

    /** @type {ExportInDesignArticlesToFolder} */
    #inDesignArticlesExporter;

    /** @type {InDesignArticleService} */
    #inDesignArticleService;

    /** @type {FileUtils} */
    #fileUtils;

    /**
     * @param {Logger} logger
     * @param {StudioJsonRpcClient} studioJsonRpcClient
     * @param {PlaService} plaService
     * @param {BrandSectionResolver} brandSectionResolver
     * @param {ExportInDesignArticlesToFolder} exportInDesignArticles
     * @param {InDesignArticleService} inDesignArticleService
     * @param {FileUtils} fileUtils
     */
    constructor (
        logger,
        studioJsonRpcClient,
        plaService,
        brandSectionResolver,
        exportInDesignArticles,
        inDesignArticleService,
        fileUtils,
    ) {
        this.#logger = logger;
        this.#studioJsonRpcClient = studioJsonRpcClient;
        this.#plaService = plaService;
        this.#brandSectionResolver = brandSectionResolver;
        this.#inDesignArticlesExporter = exportInDesignArticles;
        this.#inDesignArticleService = inDesignArticleService;
        this.#fileUtils = fileUtils;
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
    async run () {

        // Bail out when user is currently not logged in.
        if (!this.#studioJsonRpcClient.hasSession()) {
            throw new Errors.NoStudioSessionError();
        }

        // Resolve brand and section from layout doc (or use fallback settings).
        const doc = this.#inDesignArticleService.getActiveDocument();
        const { brand, section } = this.#brandSectionResolver.resolve(doc);

        // Export the contextual article to a temp work folder.
        const tempFolder = await this.#fileUtils.getTempFolder();
        const articles = this.#inDesignArticleService.getSelectedInDesignArticles(doc);
        for (let articleIndex = 0; articleIndex < articles.length; articleIndex++) {
            const article = articles[articleIndex];
            const articleSuffix = String(articleIndex + 1);
            await this.#inDesignArticlesExporter.exportArticle(doc, tempFolder, article, articleSuffix);
        }

        // Ask AILA for article shape suggestions.
        /*const pubInfos =*/ await this.#studioJsonRpcClient.getPublicationInfos([brand.id], null);
        const accessToken = await this.#studioJsonRpcClient.getAccessToken(brand.id);
        /*const dimensions =*/ await this.#plaService.getSheetDimensions(accessToken, brand.id);
        // TODO: Error when layout does not occur in any of the dimensions.
        /*const shapeFiles =*/ await this.#retrieveArticleShapeSuggestions(accessToken, brand, section);

        // Clean up temp folder.
        await this.#fileUtils.deleteFolderRecursively (tempFolder);
    }

    /**
     * Request for shape suggestions and retrieve the article JSON files into temp folder.
     * @param {string} accessToken
     * @param {BrandInfo} brand
     * @param {SectionInfo} section
     * @returns {Promise<UXP.storage.File[]>}
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
            const articleShapeJson = /** @type {ArticleShapeJson} */(await response.json());
            const articleShapeFile = await this.#writeArticleJsonToTemp(articleShapeJson);
            this.#logger.debug(`Wrote article shape JSON into '${articleShapeFile.nativePath}'.`);
            articleShapeFiles.push(articleShapeFile);
        }
        return articleShapeFiles;
    }

    /**
     * Create a new file in the temp folder and write the provided JSON data into it.
     * @param {ArticleShapeJson} articleJson
     * @returns {Promise<UXP.storage.File>}
     */
    async #writeArticleJsonToTemp (articleJson) {
        const formats = require("uxp").storage.formats;
        const uniqueName = `article_shape_${Date.now()}_${Math.floor(Math.random() * 1000000)}.json`;
        const tempFolder = await this.#fileUtils.getTempFolder();
        const articleShapeFile = await tempFolder.createFile(uniqueName, { overwrite: true });
        const jsonString = JSON.stringify(articleJson, null, 2);
        await articleShapeFile.write(jsonString, { format: formats.utf8 });
        return articleShapeFile;
    }
}

module.exports = FitArticleWithAIService;
