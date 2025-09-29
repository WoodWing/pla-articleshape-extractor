const { app } = require("indesign");
const idd = require("indesign");

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

    /** @type {PathMatcher} */
    #pathMatcher;
    
    /** @type {Map} */
    #paragraphsToGenres;
    
    /** @type {Object} */
    #fallbackBrand;

    /** @type {Object} */
    #fallbackCategory;

    /**
     * @param {Logger} logger
     * @param {InDesignArticleService} inDesignArticleService
     * @param {PageLayoutSettings} pageLayoutSettings
     * @param {PathMatcher} pathMatcher
     * @param {Map} paragraphsToGenres
     * @param {Object} fallbackBrand
     * @param {Object} fallbackCategory
     */
    constructor(
        logger,
        inDesignArticleService,
        pageLayoutSettings,
        pathMatcher,
        paragraphsToGenres,        
        fallbackBrand,
        fallbackCategory,
    ) {
        this.#logger = logger;
        this.#inDesignArticleService = inDesignArticleService;
        this.#pageLayoutSettings = pageLayoutSettings;
        this.#pathMatcher = pathMatcher;
        this.#paragraphsToGenres = paragraphsToGenres;
        this.#fallbackBrand = fallbackBrand;
        this.#fallbackCategory = fallbackCategory;
    }

    /**
     * @param {Document} doc 
     * @param {Folder} folder
     * @returns {Number} Count of exported article shapes.
     */
    async run(doc, folder) {
        if (!(await this.#pageLayoutSettings.exportSettings(doc, folder))) {
            return 0;
        }

        const lfs = require('uxp').storage.localFileSystem;
        const docName = doc.saved ? lfs.getNativePath(await doc.fullName) : doc.name;
        this.#logger.info("Extracting InDesign Articles for layout document '{}'.", docName);

        app.scriptPreferences.measurementUnit = idd.MeasurementUnits.POINTS;
        let exportCounter = 0;
        for (let articleIndex = 0; articleIndex < doc.articles.length; articleIndex++) {
            const article = doc.articles.item(articleIndex);
            await this.#exportArticle(doc, folder, article, articleIndex);
            exportCounter++;
        }
        app.scriptPreferences.measurementUnit = idd.AutoEnum.AUTO_VALUE;
        return exportCounter;
    }

    /**
     * @param {Document} doc 
     * @param {Folder} folder
     * @param {Object} article
     * @param {Number} articleIndex
     */
    async #exportArticle(doc, folder, article, articleIndex) {
        const elements = article.articleMembers.everyItem().getElements();
        const outerBounds = this.#getOuterboundOfArticleShape(elements);
        let articleShapeJson = this.#composeArticleShapeJson(doc, article.name, outerBounds);
        if (articleShapeJson === null) {
            this.#logger.warning("Excluded article '{}' from export because conversion to JSON failed.", article.name);
            return;
        }
        const pageItems = await this.#collectArticlePageItems(article, elements, outerBounds, articleShapeJson);
        if (pageItems.length === 0) {
            this.#logger.warning("Excluded article '{}' from export because it has no page items.", article.name);
            return;
        }
        articleShapeJson.genreId = this.#resolveGenreFromManagedArticle(articleShapeJson.textComponents);
        if (!this.#arePageItemsOnSameSpread(pageItems)) {
            const message = "Article '" + article.name + "' could not be exported because not all "
                + "page items are placed on the same spread.";
            alert(message);
            this.#logger.error(message);
            return;
        }
        this.#logger.info("Exporting article '{}'...", article.name);
        await this.#exportArticlePageItems(doc, folder, articleShapeJson.shapeTypeName, articleIndex, pageItems, articleShapeJson)
    }

    /**
     * @param {Object} article
     * @param {Array<Object>} elements
     * @param {Object} outerBounds
     * @param {Object} articleShapeJson
     * @returns {Array<Object>} Page items.
     */
    #collectArticlePageItems(article, elements, outerBounds, articleShapeJson) {
        let pageItems = []; // Collect all associated page items for the article.
        for (let elementIndex = 0; elementIndex < elements.length; elementIndex++) {
            const element = elements[elementIndex];
            const geometricBounds = this.#composeGeometricBounds(outerBounds.topLeftX, outerBounds.topLeftY, element.itemRef)
            if (this.#inDesignArticleService.isValidTextFrame(element.itemRef)) {
                const threadedFrames = this.#getThreadedFrames(element.itemRef);
                let textComponent = {
                    "type": element.itemRef.elementLabel,
                    "words": 0,
                    "characters": 0,
                    "firstParagraphStyle": "",
                    "frames": []
                };

                // Add the first paragraph style used in the chain of threaded frames.
                if (threadedFrames[0].paragraphs.length > 0) {
                    const paragraphStyle = threadedFrames[0].paragraphs.item(0).appliedParagraphStyle;
                    if (paragraphStyle.isValid) {
                        textComponent.firstParagraphStyle = this.#getParagraphStylePath(paragraphStyle);
                    }
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
                            "text": textStats.text
                        });
                        textComponent.words += textStats.wordCount;
                        textComponent.characters += textStats.charCount;
                    }
                }
                articleShapeJson.textComponents.push(textComponent);
            } else if (this.#inDesignArticleService.isValid2DGraphicFrame(element.itemRef)) {
                pageItems.push(element.itemRef);
                articleShapeJson.imageComponents.push({
                    "geometricBounds": geometricBounds,
                    "textWrapMode": this.#getTextWrapMode(element.itemRef)
                });
            } else if (this.#inDesignArticleService.isValid1DGraphicFrame(element.itemRef)) {
                pageItems.push(element.itemRef);
                this.#logger.info("Article '{}' has a graphic frame item '{}' placed at ({},{},{},{}). "
                    + "The graphic is too slim. It is either a line or a very slim rectangle. "
                    + "Hence the item is excluded from the article composition (JSON file).",
                    article.name, element.itemRef.constructorName,
                    element.itemRef.geometricBounds[1], element.itemRef.geometricBounds[0], geometricBounds.height, geometricBounds.width);
            } else {
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
     * @param {String} articleName 
     * @returns {Object|null}
     */
    #resolveShapeTypeFromArticleName(articleName) {
        let shapeType = { id: null, name: null };
        articleName = articleName.toLowerCase();
        if (articleName.indexOf("lead") != -1) {
            shapeType.name = "lead";
            shapeType.id = "1";
        } else if (articleName.indexOf("secondary") != -1) {
            shapeType.name = "secondary";
            shapeType.id = "2";
        } else if (articleName.indexOf("third") != -1) {
            shapeType.name = "third";
            shapeType.id = "3";
        } else if (articleName.indexOf("filler") != -1) {
            shapeType.name = "filler";
            shapeType.id = "4";
        } else {
            this.#logger.warning("Shape type could not be resolved from article '{}' due to bad naming convention.", articleName);
            shapeType = null;
        }
        return shapeType;
    }

    /**
     * Compose a unique name that can be used as a base to compose export filenames.
     * @param {Document} doc 
     * @param {Folder} folder 
     * @param {String} shapeTypeName 
     * @param {Number} articleIndex 
     * @returns {String}
     */
    async #getFileBaseName(doc, folder, shapeTypeName, articleIndex) {
        let fileName = doc.name + ' ' + shapeTypeName + ' ' + (articleIndex + 1);
        try {
            // Get workflow object ID and Version from Studio.
            fileName = fileName + ' (' + doc.entMetaData.get("Core_ID") + '.v' + doc.entMetaData.get("Version") + ')';
        } catch (error) {
            // Use path of layout to make file name unique.
            if (doc.saved) {
                const docFile = await doc.fullName;
                let suffix = window.path.dirname(docFile);
                suffix = suffix.ltrim(window.path.sep).rtrim(window.path.sep);
                suffix = suffix.replaceAll(window.path.sep, "-");
                fileName = fileName + ' (' + suffix + ")";
            }
        }
        return window.path.join(folder, fileName)
    }

    /**
     * Create a data object that describes the geometrical boundaries of a given page item.
     * @param {Number} topLeftX - Make it relative to this X position.
     * @param {Number} topLeftY - Make it relative to this Y position.
     * @param {PageItem} pageItem - TextFrame, Rectangle, etc
     * @returns {Object}
     */
    #composeGeometricBounds(topLeftX, topLeftY, pageItem) {
        return {
            "x": this.#roundTo3Decimals(pageItem.geometricBounds[1] - topLeftX),
            "y": this.#roundTo3Decimals(pageItem.geometricBounds[0] - topLeftY),
            "width": this.#roundTo3Decimals(pageItem.geometricBounds[3] - pageItem.geometricBounds[1]),
            "height": this.#roundTo3Decimals(pageItem.geometricBounds[2] - pageItem.geometricBounds[0])
        }
    }

    /**
     * Resolve the full parental group path of a given paragraph style.
     * @param {Object} paragraphStyle The given style must be valid.
     * @returns {String} The group path, including the style name, for example "MainGroup/SubGroup/ParaStyle".
     */
    #getParagraphStylePath(paragraphStyle) {
        let parts = [paragraphStyle.name];
        let parent = paragraphStyle.parent;
        while (parent && parent.constructor.name === "ParagraphStyleGroup") {
            parts.unshift(parent.name);
            parent = parent.parent;
        }
        return parts.join("/");
    }

    /**
     * Round a given number to a precision of maximum 3 decimals.
     * @param {Number} precisionNumber 
     * @returns {Number}
     */
    #roundTo3Decimals(precisionNumber) {
        return Math.round(precisionNumber * 1000) / 1000;
    }

    /**
     * 
     * @param {Document} doc 
     * @param {String} articleName 
     * @param {Object} outerBounds
     * @returns {Object|null}
     */
    #composeArticleShapeJson(doc, articleName, outerBounds) {

        // Resolve Brand/Category. Fallback to defaults when no Studio session.
        let brand = null;
        let category = null;
        try {
            brand = app.entSession.getPublication(
                doc.entMetaData.get("Core_Publication")
            );
            category = app.entSession.getCategory(
                doc.entMetaData.get("Core_Publication"),
                doc.entMetaData.get("Core_Section"),
                doc.entMetaData.get("Core_Issue")
            );
        } catch (error) {
            brand = this.#fallbackBrand;
            category = this.#fallbackCategory;
        }
        this.#logger.info("Resolved brand '{}' (id={}) and category '{}' (id={}).",
            brand.name, brand.id, category.name, category.id);

        // Resolve the shape type. Bail out when article has bad naming convention.
        const shapeType = this.#resolveShapeTypeFromArticleName(articleName)
        if (shapeType === null) {
            return null;
        }

        // Compose a base structure in the Article Shape JSON export format.
        let articleShapeJson = {
            "brandName": brand.name,
            "brandId": brand.id,
            "sectionName": category.name,
            "sectionId": category.id,
            "genreId": null,
            "shapeTypeName": shapeType.name,
            "shapeTypeId": shapeType.id,
            "geometricBounds": {
                "x": this.#roundTo3Decimals(outerBounds.topLeftX),
                "y": this.#roundTo3Decimals(outerBounds.topLeftY),
                "width": this.#roundTo3Decimals(outerBounds.bottomRightX - outerBounds.topLeftX),
                "height": this.#roundTo3Decimals(outerBounds.bottomRightY - outerBounds.topLeftY)
            },
            "foldLine": null,
            "textComponents": [],
            "imageComponents": []
        }
        // Set the foldLine property when the article shape does crossover the fold line of the spread.
        const geometricBoundsRight = articleShapeJson.geometricBounds.x + articleShapeJson.geometricBounds.width;
        const crossoverFoldLine =
            articleShapeJson.geometricBounds.x < doc.documentPreferences.pageWidth
            && doc.documentPreferences.pageWidth < geometricBoundsRight;
        if (crossoverFoldLine) {
            articleShapeJson.foldLine = doc.documentPreferences.pageWidth - articleShapeJson.geometricBounds.x;
        }
        return articleShapeJson;
    }

    /**
     * Tells whether all given page items are placed on the same spread. If this is not the case,
     * the items can not be selected nor grouped which is required by _exportArticlePageItems().
     * @param {Array} pageItems 
     * @returns 
     */
    #arePageItemsOnSameSpread(pageItems) {
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
     * @param {Document} doc 
     * @param {Folder} folder 
     * @param {String} shapeTypeName 
     * @param {Number} articleIndex 
     * @param {Array} pageItems
     * @param {Object} articleShapeJson
     */
    async #exportArticlePageItems(doc, folder, shapeTypeName, articleIndex, pageItems, articleShapeJson) {
        const lfs = require('uxp').storage.localFileSystem;

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
        const PreferencesManager = require('./PreferencesManager.mjs');
        const preferencesManager = new PreferencesManager(app.jpegExportPreferences);
        let originalPreferences = null;
        let group = null;
        try {
            originalPreferences = preferencesManager.overridePreferences({
                embedColorProfile: true,
                antiAlias: true,
                useDocumentBleeds: false,
                simulateOverprint: false,
                jpegQuality: idd.JPEGOptionsQuality.HIGH,
                jpegRenderingStyle: idd.JPEGOptionsFormat.BASELINE_ENCODING,
                exportResolution: 144, // DPI, screen resolution
                jpegColorSpace: idd.JpegColorSpaceEnum.RGB,
            });
            if (pageItems.length === 1) {
                pageItems[0].exportFile(idd.ExportFormat.JPG, imgFile);
            } else {
                group = doc.groups.add(pageItems);
                group.exportFile(idd.ExportFormat.JPG, imgFile);
            }
        } catch (error) {
            this.#logger.logError(error);
            alert("Error exporting the snippet: " + error.message);
        } finally {
            if (group) {
                group.ungroup();
            }
            if (originalPreferences) {
                preferencesManager.restoreOriginalPreferences(originalPreferences);
            }
        }

        // Export JSON.
        this.#saveJsonToDisk(articleShapeJson, jsonFile);
    }

    /**
     * Save JSON data to a file on disk.
     * @param {Object} jsonData - The JSON object to save.
     * @param {File} file
     */
    #saveJsonToDisk(jsonData, file) {
        try {
            // Convert JSON object to a string
            const jsonString = JSON.stringify(jsonData, null, 4);

            // Write the JSON string to the file
            const formats = require('uxp').storage.formats;
            file.write(jsonString, { format: formats.utf8 });
        } catch (error) {
            this.#logger.logError(error);
            alert("An error occurred: " + error.message);
        }
    }

    /**
     * Get the word count and character count of a text frame, excluding overset text.
     * @param {TextFrame} textFrame - The text frame to analyze.
     * @returns {Object} - An object containing word count, character count and text without overset.
     */
    #getTextStatisticsWithoutOverset(textFrame) {

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
            totalLineHeight: this.#roundTo3Decimals(totalLineHeight)
        };
    }


    /**
     * Calculates the outermost bounding box of a collection of article elements, considering threaded frames if applicable.
     *
     * @param {Array} elements - An array of article elements. Each element should have an `itemRef` property that represents the InDesign object.
     *                           The `itemRef` can be a text frame, graphic, or other page item.
     * @returns {Object} - An object representing the outer bounds of the combined elements and their threaded frames:
     *                     {
     *                         topLeftX: {Number} - The smallest X coordinate of the bounding box's top-left corner.
     *                         topLeftY: {Number} - The smallest Y coordinate of the bounding box's top-left corner.
     *                         bottomRightX: {Number} - The largest X coordinate of the bounding box's bottom-right corner.
     *                         bottomRightY: {Number} - The largest Y coordinate of the bounding box's bottom-right corner.
     *                     }
     */
    #getOuterboundOfArticleShape(elements) {
        let topLeftX = 0;
        let topLeftY = 0;
        let bottomRightX = 0;
        let bottomRightY = 0;

        for (let j = 0; j < elements.length; j++) {
            const element = elements[j];
            let threadedFrames;

            if (j == 0) {
                topLeftX = element.itemRef.geometricBounds[1];
                topLeftY = element.itemRef.geometricBounds[0];
                bottomRightX = element.itemRef.geometricBounds[3];
                bottomRightY = element.itemRef.geometricBounds[2];
            }

            //Create an array with all thread frames (images dont have threaded frames)
            if (this.#inDesignArticleService.isValidTextFrame(element.itemRef)) {
                threadedFrames = this.#getThreadedFrames(element.itemRef);
            } else {
                threadedFrames = [element.itemRef];
            }

            for (let k = 0; k < threadedFrames.length; k++) {
                const frame = threadedFrames[k];

                if (frame.geometricBounds[1] < topLeftX) {
                    topLeftX = frame.geometricBounds[1];
                }
                if (frame.geometricBounds[0] < topLeftY) {
                    topLeftY = frame.geometricBounds[0];
                }
                if (frame.geometricBounds[3] > bottomRightX) {
                    bottomRightX = frame.geometricBounds[3];
                }
                if (frame.geometricBounds[2] > bottomRightY) {
                    bottomRightY = frame.geometricBounds[2];
                }
            }
        }

        return { topLeftX: topLeftX, topLeftY: topLeftY, bottomRightX: bottomRightX, bottomRightY: bottomRightY };
    }


    /**
     * Get all threaded text frames for a given text frame.
     * @param {TextFrame} textFrame - The starting text frame.
     * @returns {Array} - An array of all threaded text frames, including the starting frame.
     */
    #getThreadedFrames(textFrame) {
        let threadedFrames = [];
        let currentFrame = textFrame;

        // Traverse forward through the thread chain
        while (currentFrame) {
            threadedFrames.push(currentFrame);
            currentFrame = currentFrame.nextTextFrame;
        }

        // Traverse backward through the thread chain
        currentFrame = textFrame.previousTextFrame;
        while (currentFrame) {
            threadedFrames.unshift(currentFrame);
            currentFrame = currentFrame.previousTextFrame;
        }

        return threadedFrames;
    }

    /**
     * Get the text wrap settings of a selected frame, including the text wrap mode as a string.
     * @param {PageItem|null} frame - The InDesign frame object (e.g., TextFrame, GraphicFrame).
     * @returns {String} - Name of the text wrap mode
     */
    #getTextWrapMode(frame) {
        if (!this.#inDesignArticleService.isValidArticleComponentFrame(frame)) {
            alert("Invalid frame.");
            return null;
        }

        const textWrapPrefs = frame.textWrapPreferences;

        if (textWrapPrefs.textWrapMode.equals(idd.TextWrapModes.NONE)) {
            return "none"
        } else if (textWrapPrefs.textWrapMode.equals(idd.TextWrapModes.BOUNDING_BOX_TEXT_WRAP)) {
            return "bounding_box"
        } else if (textWrapPrefs.textWrapMode.equals(idd.TextWrapModes.CONTOUR)) {
            return "contour"
        } else if (textWrapPrefs.textWrapMode.equals(idd.TextWrapModes.JUMP_OBJECT_TEXT_WRAP)) {
            return "jump_object"
        } else if (textWrapPrefs.textWrapMode.equals(idd.TextWrapModes.NEXT_COLUMN_TEXT_WRAP)) {
            return "jump_to_next_column"
        } else {
            return ""
        }
    }

    /**
     * Calculate the line height in points.
     * @param {Line} line
     * @returns {Number}
     */
    #getLineHeight(line) {
        if (line.characters.length === 0) {
            return 0;
        }

        // Calculate line height based on line leading and base shift of first character.
        let leading = line.leading; // line spacing
        const baselineShift = line.characters.item(0).baselineShift;

        // If leading is set to Auto (value = -1), estimate it as 120% of font size.
        if (typeof leading === "object" && leading.equals(idd.Leading.AUTO)) {
            const fontSize = line.characters.item(0).pointSize;
            leading = fontSize * 1.2;
        }

        // Calculate final line height.
        return leading + (baselineShift || 0);
    }

    /**
     * For the given text components, it does lookup the paragraph style into the configured genre mapping.
     * The first best component for which a configuration exists, is taken to resolve the genre id.
     * @param {Array} textComponents
     * @return {String|null} Genre id. Null when none found.
     */
    #resolveGenreFromManagedArticle(textComponents) {
        let genreId = null;
        const paragraphsToGenres = Array.from(this.#paragraphsToGenres.keys());
        for (let i = 0; i < textComponents.length; i++) {
            const textComponent = textComponents[i];
            if (textComponent.firstParagraphStyle.length == 0) {
                continue;
            }
            const matchedPattern = this.#pathMatcher.findBestMatch(
                paragraphsToGenres, 
                textComponent.firstParagraphStyle
            );
            genreId = matchedPattern ? this.#paragraphsToGenres.get(matchedPattern) : null;
            if (typeof(genreId) !== "string") { // null, undefined (from get()) or bad configured type
                genreId = null;
            }
            if (genreId !== null) {
                break; // found style mapping in config
            }
        }
        // At this point, genreId is either a String or null.
        if (genreId === null) {
            return null;
        }
        genreId = genreId.trim();
        if (genreId.length == 0) {
            return null;
        }
        return genreId;
    }
}

module.exports = ExportInDesignArticlesToFolder;
