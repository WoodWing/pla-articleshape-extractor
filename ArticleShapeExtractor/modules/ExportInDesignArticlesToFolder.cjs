const ind = require("indesign");

/**
 * Understands how to extract article shapes from InDesign Articles.
 */
class ExportInDesignArticlesToFolder {

    /** @type {Logger} */
    #logger;

    /** @type {InDesignArticleService} */
    #inDesignArticleService;

    /** @type {PageLayoutSettings} */
    #pageLayoutSettings;

    /** @type {GenreResolver} */
    #genreResolver;

    /** @type {BrandSectionResolver} */
    #brandSectionResolver;

    /**
     * @param {Logger} logger
     * @param {InDesignArticleService} inDesignArticleService
     * @param {PageLayoutSettings} pageLayoutSettings
     * @param {GenreResolver} genreResolver
     * @param {BrandSectionResolver} brandSectionResolver
     */
    constructor (
        logger,
        inDesignArticleService,
        pageLayoutSettings,
        genreResolver,
        brandSectionResolver,
    ) {
        this.#logger = logger;
        this.#inDesignArticleService = inDesignArticleService;
        this.#pageLayoutSettings = pageLayoutSettings;
        this.#genreResolver = genreResolver;
        this.#brandSectionResolver = brandSectionResolver;
    }

    /**
     * @param {IND.Document} doc
     * @param {UXP.storage.Folder} folder
     * @returns Promise<{number}> Count of exported article shapes.
     */
    async run (doc, folder) {
        if (!(await this.#pageLayoutSettings.exportSettings(doc, folder))) {
            return 0;
        }

        /** @type {UXP.storage.FileSystemProvider} */
        const lfs = require("uxp").storage.localFileSystem;
        const docName = doc.saved ? lfs.getNativePath(await doc.fullName) : doc.name;
        this.#logger.info("Extracting InDesign Articles for layout document '{}'.", docName);

        ind.app.scriptPreferences.measurementUnit = ind.MeasurementUnits.POINTS;
        let exportCounter = 0;
        for (let articleIndex = 0; articleIndex < doc.articles.length; articleIndex++) {
            const article = doc.articles.item(articleIndex);
            if (await this.#exportArticle(doc, folder, article, articleIndex)) {
                exportCounter++;
            }
        }
        ind.app.scriptPreferences.measurementUnit = ind.AutoEnum.AUTO_VALUE;
        return exportCounter;
    }

    /**
     * @param {IND.Document} doc
     * @param {UXP.storage.Folder} folder
     * @param {IND.Article} article
     * @param {number} articleIndex
     * @returns Promise>{boolean}> Whether or not successful.
     */
    async #exportArticle (doc, folder, article, articleIndex) {
        const articleMembers = /** @type {IND.ArticleMember} */
            (/** @type {unknown} */(article.articleMembers.everyItem()));
        const elements = articleMembers.getElements();
        const outerBounds = this.#getOuterboundOfArticleShape(elements);
        let articleShapeJson = this.#composeArticleShapeJson(doc, article.name, outerBounds);
        if (articleShapeJson === null) {
            this.#logger.warning("Excluded article '{}' from export because conversion to JSON failed.", article.name);
            return false;
        }
        const pageItems = await this.#collectArticlePageItems(article, elements, outerBounds, articleShapeJson);
        if (pageItems.length === 0) {
            this.#logger.warning("Excluded article '{}' from export because it has no page items.", article.name);
            return false;
        }
        articleShapeJson.genreId = null;
        if (this.#genreResolver.isFeatureEnabled()) {
            const genreIds = this.#genreResolver.resolveGenreIds(article.name);
            let message = null;
            if (genreIds.length === 0) {
                message = `Article '${article.name}' could not be exported because `
                    + "it's name does not contain any of the configured genres.";
            }
            else if (genreIds.length > 1) {
                message = `Article '${article.name}' could not be exported because `
                    + `it's name contains multiple of the configured genres: ${genreIds}.`;
            }
            if (message !== null) {
                alert(message);
                this.#logger.error(message);
                return false;
            }
            articleShapeJson.genreId = genreIds[0];
        }
        if (!this.#arePageItemsOnSameSpread(pageItems)) {
            const message = "Article '" + article.name + "' could not be exported because not all "
                + "page items are placed on the same spread.";
            alert(message);
            this.#logger.error(message);
            return false;
        }
        this.#logger.info("Exporting article '{}'...", article.name);
        return await this.#exportArticlePageItems(doc, folder, articleShapeJson.shapeTypeName, articleIndex, pageItems, articleShapeJson);
    }

    /**
     * @param {IND.Article} article
     * @param {IND.ArticleMember[]} elements
     * @param {GeoBounds} outerBounds
     * @param {ArticleShapeJson} articleShapeJson
     * @returns {IND.PageItem[]}
     */
    #collectArticlePageItems (article, elements, outerBounds, articleShapeJson) {
        /** @type {IND.PageItem[]} */
        let pageItems = []; // Collect all associated page items for the article.
        for (let elementIndex = 0; elementIndex < elements.length; elementIndex++) {
            const element = elements[elementIndex];
            const geometricBounds = this.#composeGeometricBounds(outerBounds.topLeftX, outerBounds.topLeftY, element.itemRef);
            if (this.#inDesignArticleService.isValidTextFrame(element.itemRef)) {
                const textFrame = /** @type {IND.TextFrame} */(element.itemRef);
                const threadedFrames = this.#getThreadedFrames(textFrame);
                let textComponent = {
                    "type": textFrame.elementLabel,
                    "words": 0,
                    "characters": 0,
                    "firstParagraphStyle": "",
                    "frames": [],
                };

                // Add the name of the first paragraph style used in the chain of threaded frames.
                if (threadedFrames[0].paragraphs.length > 0) {
                    const paragraphStyle = /** @type {paragraphStyle} */(threadedFrames[0].paragraphs.item(0).appliedParagraphStyle);
                    textComponent.firstParagraphStyle = paragraphStyle.name;
                }

                for (let frameIndex = 0; frameIndex < threadedFrames.length; frameIndex++) {
                    const frame = threadedFrames[frameIndex];
                    pageItems.push(frame);
                    if (this.#inDesignArticleService.isValidTextFrame(frame)) {
                        const textStats = this.#getTextStatisticsWithoutOverset(frame);
                        textComponent.frames.push({
                            "geometricBounds": this.#composeGeometricBounds(outerBounds.topLeftX, outerBounds.topLeftY, frame),
                            "columns": frame.textFramePreferences.textColumnCount,
                            "words": textStats.wordCount,
                            "characters": textStats.charCount,
                            "textWrapMode": this.#getTextWrapMode(frame),
                            "totalLineHeight": this.#roundTo3Decimals(textStats.totalLineHeight),
                            "text": textStats.text,
                        });
                        textComponent.words += textStats.wordCount;
                        textComponent.characters += textStats.charCount;
                    }
                }
                articleShapeJson.textComponents.push(textComponent);
            }
            else if (this.#inDesignArticleService.isUnassignedFrame(element.itemRef)) {
                pageItems.push(element.itemRef);
                this.#logger.info("Article '{}' has a unassigned frame item '{}' placed at ({},{},{},{}). "
                    + "Hence the item is excluded from the article composition (JSON file). "
                    + "Set it to TextFrame or Graphic via Object->Content",
                article.name, element.itemRef.constructorName,
                element.itemRef.geometricBounds[1], element.itemRef.geometricBounds[0], geometricBounds.height, geometricBounds.width);
            }
            else if (this.#inDesignArticleService.isValid2DGraphicFrame(element.itemRef)) {
                pageItems.push(element.itemRef);
                articleShapeJson.imageComponents.push({
                    "geometricBounds": geometricBounds,
                    "textWrapMode": this.#getTextWrapMode(element.itemRef),
                });
            }
            else if (this.#inDesignArticleService.isValid1DGraphicFrame(element.itemRef)) {
                pageItems.push(element.itemRef);
                this.#logger.info("Article '{}' has a graphic frame item '{}' placed at ({},{},{},{}). "
                    + "The graphic is too slim. It is either a line or a very slim rectangle. "
                    + "Hence the item is excluded from the article composition (JSON file).",
                article.name, element.itemRef.constructorName,
                element.itemRef.geometricBounds[1], element.itemRef.geometricBounds[0], geometricBounds.height, geometricBounds.width);
            }
            else {
                this.#logger.info("Article '{}' has a page item '{}' placed at ({},{}). "
                    + "The page item is either not valid or not a text/graphic frame. "
                    + "Hence the item is excluded from the article export operation.",
                article.name, element.itemRef.constructorName,
                element.itemRef.geometricBounds[1], element.itemRef.geometricBounds[0]);
            }
        }
        return pageItems;
    }

    /**
     * @param {string} articleName
     * @returns {ArticleShapeTypeInfo|null}
     */
    #resolveShapeTypeFromArticleName (articleName) {
        let shapeType = { id: null, name: null };
        articleName = articleName.toLowerCase();
        if (articleName.indexOf("lead") != -1) {
            shapeType.name = "lead";
            shapeType.id = "1";
        }
        else if (articleName.indexOf("secondary") != -1) {
            shapeType.name = "secondary";
            shapeType.id = "2";
        }
        else if (articleName.indexOf("third") != -1) {
            shapeType.name = "third";
            shapeType.id = "3";
        }
        else if (articleName.indexOf("filler") != -1) {
            shapeType.name = "filler";
            shapeType.id = "4";
        }
        else {
            this.#logger.warning("Shape type could not be resolved from article '{}' due to bad naming convention.", articleName);
            shapeType = null;
        }
        return shapeType;
    }

    /**
     * Compose a unique name that can be used as a base to compose export filenames.
     * @param {IND.Document} doc
     * @param {UXP.storage.Folder} folder
     * @param {string} shapeTypeName
     * @param {number} articleIndex
     * @returns {Promise<string>}
     */
    async #getFileBaseName (doc, folder, shapeTypeName, articleIndex) {
        let fileName = doc.name + " " + shapeTypeName + " " + (articleIndex + 1);
        try {
            // Get workflow object ID and Version from Studio.
            fileName = fileName + " (" + doc.entMetaData.get("Core_ID") + ".v" + doc.entMetaData.get("Version") + ")";
        }
        catch {
            // Use path of layout to make file name unique.
            if (doc.saved) {
                const docFile = await doc.fullName;
                let suffix = window.path.dirname(docFile);
                suffix = suffix.ltrim(window.path.sep).rtrim(window.path.sep);
                suffix = suffix.replaceAll(window.path.sep, "-");
                fileName = fileName + " (" + suffix + ")";
            }
        }
        return window.path.join(folder, fileName);
    }

    /**
     * Create a data object that describes the geometrical boundaries of a given page item.
     * @param {number} topLeftX - Make it relative to this X position.
     * @param {number} topLeftY - Make it relative to this Y position.
     * @param {IND.PageItem} pageItem - TextFrame, Rectangle, etc
     * @returns {ArticleShapeGeoBounds}
     */
    #composeGeometricBounds (topLeftX, topLeftY, pageItem) {
        return {
            "x": this.#roundTo3Decimals(Number(pageItem.geometricBounds[1]) - topLeftX),
            "y": this.#roundTo3Decimals(Number(pageItem.geometricBounds[0]) - topLeftY),
            "width": this.#roundTo3Decimals(Number(pageItem.geometricBounds[3]) - Number(pageItem.geometricBounds[1])),
            "height": this.#roundTo3Decimals(Number(pageItem.geometricBounds[2]) - Number(pageItem.geometricBounds[0])),
        };
    }

    /**
     * Round a given number to a precision of maximum 3 decimals.
     * @param {number} precisionNumber
     * @returns {number}
     */
    #roundTo3Decimals (precisionNumber) {
        return Math.round(precisionNumber * 1000) / 1000;
    }

    /**
     *
     * @param {IND.Document} doc
     * @param {string} articleName
     * @param {GeoBounds} outerBounds
     * @returns {ArticleShapeJson|null}
     */
    #composeArticleShapeJson (doc, articleName, outerBounds) {

        // Resolve brand and section from layout doc (or use fallback settings).
        const { brand, section } = this.#brandSectionResolver.resolve(doc);

        // Resolve the shape type. Bail out when article has bad naming convention.
        const shapeType = this.#resolveShapeTypeFromArticleName(articleName);
        if (shapeType === null) {
            return null;
        }

        // Compose a base structure in the Article Shape JSON export format.
        let articleShapeJson = {
            "brandName": brand.name,
            "brandId": brand.id,
            "sectionName": section.name,
            "sectionId": section.id,
            "genreId": null,
            "shapeTypeName": shapeType.name,
            "shapeTypeId": shapeType.id,
            "geometricBounds": {
                "x": this.#roundTo3Decimals(outerBounds.topLeftX),
                "y": this.#roundTo3Decimals(outerBounds.topLeftY),
                "width": this.#roundTo3Decimals(outerBounds.bottomRightX - outerBounds.topLeftX),
                "height": this.#roundTo3Decimals(outerBounds.bottomRightY - outerBounds.topLeftY),
            },
            "foldLine": null,
            "textComponents": [],
            "imageComponents": [],
        };
        // Set the foldLine property when the article shape does crossover the fold line of the spread.
        const geometricBoundsRight = articleShapeJson.geometricBounds.x + articleShapeJson.geometricBounds.width;
        const crossoverFoldLine =
            Number(articleShapeJson.geometricBounds.x) < Number(doc.documentPreferences.pageWidth)
            && Number(doc.documentPreferences.pageWidth) < geometricBoundsRight;
        if (crossoverFoldLine) {
            articleShapeJson.foldLine = Number(doc.documentPreferences.pageWidth) - articleShapeJson.geometricBounds.x;
        }
        return articleShapeJson;
    }

    /**
     * Tells whether all given page items are placed on the same spread. If this is not the case,
     * the items can not be selected nor grouped which is required by _exportArticlePageItems().
     * @param {IND.PageItem[]} pageItems
     * @returns
     */
    #arePageItemsOnSameSpread (pageItems) {
        if (pageItems.length === 0) {
            return true;
        }
        const firstItemSpread = pageItems[0].parent;
        for (let i = 1; i < pageItems.length; i++) {
            if (!pageItems[i].parent.equals(firstItemSpread)) {
                return false; // Different spread found
            }
        }
        return true;
    }

    /**
     * @param {IND.Document} doc
     * @param {UXP.storage.Folder} folder
     * @param {string} shapeTypeName
     * @param {number} articleIndex
     * @param {IND.PageItem[]} pageItems
     * @param {ArticleShapeJson} articleShapeJson
     * @returns {Promise<boolean>} Whether or not successful.
     */
    async #exportArticlePageItems (doc, folder, shapeTypeName, articleIndex, pageItems, articleShapeJson) {
        /** @type {UXP.storage.FileSystemProvider} */
        const lfs = require("uxp").storage.localFileSystem;

        const baseFileName = await this.#getFileBaseName(doc, folder, shapeTypeName, articleIndex);
        const snippetFile = await lfs.createEntryWithUrl(baseFileName + ".idms", { overwrite: true });
        const imgFile = await lfs.createEntryWithUrl(baseFileName + ".jpg", { overwrite: true });
        const jsonFile = await lfs.createEntryWithUrl(baseFileName + ".json", { overwrite: true });

        // Export IDMS snippet.
        let pageItemsIds = [];
        for (let index = 0; index < pageItems.length; index++) {
            const pageItem = pageItems[index];
            this.#logger.debug(`Exporting '${pageItem.constructor.name}' page item with id '${pageItem.id}'.`);
            pageItemsIds.push(pageItem.id);
        }
        doc.exportPageItemsToSnippet(snippetFile, pageItemsIds);

        // Export JPEG image.
        const PreferencesManager = require("./PreferencesManager.cjs");
        const preferencesManager = new PreferencesManager(ind.app.jpegExportPreferences);
        let originalPreferences = null;
        let group = null;
        let isExported = false;
        try {
            originalPreferences = preferencesManager.overridePreferences({
                embedColorProfile: true,
                antiAlias: true,
                useDocumentBleeds: false,
                simulateOverprint: false,
                jpegQuality: ind.JPEGOptionsQuality.HIGH,
                jpegRenderingStyle: ind.JPEGOptionsFormat.BASELINE_ENCODING,
                exportResolution: 144, // DPI, screen resolution
                jpegColorSpace: ind.JpegColorSpaceEnum.RGB,
            });
            if (pageItems.length === 1) {
                pageItems[0].exportFile(ind.ExportFormat.JPG, imgFile);
            }
            else {
                group = doc.groups.add(pageItems);
                group.exportFile(ind.ExportFormat.JPG, imgFile);
            }
            isExported = true;
        }
        catch (error) {
            this.#logger.logError(error);
            alert("Error exporting the snippet: " + error.message);
        }
        finally {
            if (group) {
                const currentSelection = doc.selection;
                group.ungroup();
                doc.selection = currentSelection;
            }
            if (originalPreferences) {
                preferencesManager.restoreOriginalPreferences(originalPreferences);
            }
        }

        // Export JSON.
        if (isExported) {
            return await this.#saveJsonToDisk(articleShapeJson, jsonFile);
        }
        return false;
    }

    /**
     * Save JSON data to a file on disk.
     * @param {ArticleShapeJson} jsonData - The JSON object to save.
     * @param {UXP.storage.File} file
     * @returns {Promise<boolean>} Whether or not successful.
     */
    async #saveJsonToDisk (jsonData, file) {
        let isSaved = false;
        try {
            // Convert JSON object to a string
            const jsonString = JSON.stringify(jsonData, null, 4);

            // Write the JSON string to the file
            const formats = require("uxp").storage.formats;
            await file.write(jsonString, { format: formats.utf8 });
            isSaved = true;
        }
        catch (error) {
            this.#logger.logError(error);
            alert("An error occurred: " + error.message);
        }
        return isSaved;
    }

    /**
     * Get the word count and character count of a text frame, excluding overset text.
     * @param {IND.TextFrame} textFrame - The text frame to analyze.
     * @returns {{wordCount: number, charCount: number, text: string, totalLineHeight: number}} - An object containing word count, character count and text without overset.
     */
    #getTextStatisticsWithoutOverset (textFrame) {

        // Extract only the visible text (not overset)
        const visibleText = textFrame.lines;
        let wordCount = 0;
        let charCount = 0;
        let text = "";
        let totalLineHeight = 0;

        // Loop through visible lines to count words and characters
        for (let i = 0; i < visibleText.length; i++) {
            const visibleTextItem = visibleText.item(i);
            wordCount += visibleTextItem.words.length;
            charCount += visibleTextItem.characters.length;
            text += visibleTextItem.contents;
            totalLineHeight += this.#getLineHeight(visibleTextItem);
        }

        return {
            wordCount: wordCount,
            charCount: charCount,
            text: text,
            totalLineHeight: this.#roundTo3Decimals(totalLineHeight),
        };
    }


    /**
     * Calculates the outermost bounding box of a collection of article elements, considering threaded frames if applicable.
     *
     * @param {IND.ArticleMember[]} elements
     *    An array of article elements. Each element should have an `itemRef` property that represents the InDesign object.
     *    The `itemRef` can be a text frame, graphic, or other page item.
     * @returns {GeoBounds} Outer bounds of the combined elements and their threaded frames.
     */
    #getOuterboundOfArticleShape (elements) {
        let topLeftX = 0;
        let topLeftY = 0;
        let bottomRightX = 0;
        let bottomRightY = 0;

        for (let j = 0; j < elements.length; j++) {
            const element = elements[j];
            let threadedFrames;

            if (j == 0) {
                topLeftX = Number(element.itemRef.geometricBounds[1]);
                topLeftY = Number(element.itemRef.geometricBounds[0]);
                bottomRightX = Number(element.itemRef.geometricBounds[3]);
                bottomRightY = Number(element.itemRef.geometricBounds[2]);
            }

            //Create an array with all thread frames (images don't have threaded frames)
            if (this.#inDesignArticleService.isValidTextFrame(element.itemRef)) {
                const textFrame = /** @type {IND.TextFrame} */(element.itemRef);
                threadedFrames = this.#getThreadedFrames(textFrame);
            }
            else {
                threadedFrames = [element.itemRef];
            }

            for (let k = 0; k < threadedFrames.length; k++) {
                const frame = threadedFrames[k];

                if (Number(frame.geometricBounds[1]) < topLeftX) {
                    topLeftX = Number(frame.geometricBounds[1]);
                }
                if (Number(frame.geometricBounds[0]) < topLeftY) {
                    topLeftY = Number(frame.geometricBounds[0]);
                }
                if (Number(frame.geometricBounds[3]) > bottomRightX) {
                    bottomRightX = Number(frame.geometricBounds[3]);
                }
                if (Number(frame.geometricBounds[2]) > bottomRightY) {
                    bottomRightY = Number(frame.geometricBounds[2]);
                }
            }
        }

        return { topLeftX: topLeftX, topLeftY: topLeftY, bottomRightX: bottomRightX, bottomRightY: bottomRightY };
    }


    /**
     * Get all threaded text frames for a given text frame.
     * @param {IND.TextFrame} textFrame The starting text frame.
     * @returns {IND.TextFrame[]} All threaded text frames, including the starting frame.
     */
    #getThreadedFrames (textFrame) {
        let threadedFrames = [textFrame];

        // Traverse forward through the thread chain
        /** @type {TextFrame | TextPath | NothingEnum} */
        let threadedSibling = textFrame.nextTextFrame;
        while (this.#isThreadedSiblingValidTextFrame(threadedSibling)) {
            threadedFrames.push(threadedSibling); // append at end
            threadedSibling = threadedSibling.nextTextFrame;
        }

        // Traverse backward through the thread chain
        threadedSibling = textFrame.previousTextFrame;
        while (this.#isThreadedSiblingValidTextFrame(threadedSibling)) {
            threadedFrames.unshift(threadedSibling); // insert at start
            threadedSibling = threadedSibling.previousTextFrame;
        }

        return threadedFrames;
    }

    /**
     * @param {TextFrame | TextPath | NothingEnum} threadedSibling
     * @returns {threadedSibling is IND.TextFrame}
     */
    #isThreadedSiblingValidTextFrame (threadedSibling) {
        if (!threadedSibling || threadedSibling.constructorName !== "TextFrame") {
            return false;
        }
        const textFrame = /** @type {TextFrame} */(threadedSibling);
        return this.#inDesignArticleService.isValidTextFrame(textFrame);
    }

    /**
     * Get the text wrap settings of a selected frame, including the text wrap mode as a string.
     * @param {IND.PageItem|null} frame TextFrame, GraphicFrame, etc
     * @returns {string} Name of the text wrap mode
     */
    #getTextWrapMode (frame) {
        if (!this.#inDesignArticleService.isValidArticleComponentFrame(frame)) {
            alert("Invalid frame.");
            return null;
        }

        const textWrapPrefs = frame.textWrapPreferences;

        if (textWrapPrefs.textWrapMode.equals(ind.TextWrapModes.NONE)) {
            return "none";
        }
        else if (textWrapPrefs.textWrapMode.equals(ind.TextWrapModes.BOUNDING_BOX_TEXT_WRAP)) {
            return "bounding_box";
        }
        else if (textWrapPrefs.textWrapMode.equals(ind.TextWrapModes.CONTOUR)) {
            return "contour";
        }
        else if (textWrapPrefs.textWrapMode.equals(ind.TextWrapModes.JUMP_OBJECT_TEXT_WRAP)) {
            return "jump_object";
        }
        else if (textWrapPrefs.textWrapMode.equals(ind.TextWrapModes.NEXT_COLUMN_TEXT_WRAP)) {
            return "jump_to_next_column";
        }
        else {
            return "";
        }
    }

    /**
     * Calculate the line height in points.
     * @param {IND.Line} line
     * @returns {number}
     */
    #getLineHeight (line) {
        if (line.characters.length === 0) {
            return 0;
        }

        // Calculate line height based on line leading and base shift of first character.
        let leading = line.leading; // line spacing
        const baselineShift = Number(line.characters.item(0).baselineShift);

        // If leading is set to Auto (value = -1), estimate it as 120% of font size.
        if (leading !== null
            && typeof leading === "object"
            && (/** @type {object} */(leading)).equals(ind.Leading.AUTO)) {
            const fontSize = Number(line.characters.item(0).pointSize);
            leading = fontSize * 1.2;
        }

        // Calculate final line height.
        return leading + (baselineShift || 0);
    }
}

module.exports = ExportInDesignArticlesToFolder;
