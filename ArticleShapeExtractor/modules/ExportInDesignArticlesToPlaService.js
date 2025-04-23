const { app } = require("indesign");
const idd = require("indesign");

/**
 * @constructor
 * @param {Logger} logger
 * @param {InDesignArticleService} inDesignArticleService
 * @param {ArticleShapeGateway} articleShapeGateway
 * @param {Object} fallbackBrand
 * @param {Object} fallbackCategory
 */
function ExportInDesignArticlesToPlaService(
    logger,
    inDesignArticleService, 
    articleShapeGateway, 
    fallbackBrand, 
    fallbackCategory,
) {
    this._logger = logger;
    this._inDesignArticleService = inDesignArticleService;
    this._articleShapeGateway = articleShapeGateway;
    this._fallbackBrand = fallbackBrand;
    this._fallbackCategory = fallbackCategory;

    /**
     * @param {Document} doc 
     * @param {Folder} folder
     * @returns {Number} Count of exported article shapes.
     */
    this.run = async function(doc, folder) {
        const lfs = require('uxp').storage.localFileSystem;
        const docName = doc.saved ? lfs.getNativePath(await doc.fullName) : doc.name;
        this._logger.info("Extracting InDesign Articles for layout document '{}'.", docName);
        let exportCounter = 0;

        app.scriptPreferences.measurementUnit = idd.MeasurementUnits.POINTS;
        for (let articleIndex = 0; articleIndex < doc.articles.length; articleIndex++) {
            const article = doc.articles.item(articleIndex);
            let pageItems = []; // Collect all associated page items for the article.
            const elements = article.articleMembers.everyItem().getElements();
            const outerBounds = this._getOuterboundOfArticleShape(elements);
            let articleShapeJson = this._composeArticleShapeJson(doc, article.name, outerBounds);
            if (articleShapeJson === null) {
                this._logger.warning("Excluded article '{}' from export because conversion to JSON failed.", article.name);
                continue;
            }

            for (let elementIndex = 0; elementIndex < elements.length; elementIndex++) {
                const element = elements[elementIndex];
                if (this._inDesignArticleService.isValidArticleTextFrame(element.itemRef)) {
                    const threadedFrames = this._getThreadedFrames(element.itemRef);
                    let textComponent = {
                        "type": element.itemRef.elementLabel,
                        "words": 0,
                        "characters": 0,
                        "firstParagraphStyle": "",
                        "frames": []
                    };

                    // Add the name of the first paragraph style used in the chain of threaded frames.
                    if (threadedFrames[0].paragraphs.length > 0) {
                        textComponent.firstParagraphStyle = threadedFrames[0].paragraphs.item(0).appliedParagraphStyle.name
                    }

                    for (let frameIndex = 0; frameIndex < threadedFrames.length; frameIndex++) {
                        const frame = threadedFrames[frameIndex];
                        pageItems.push(frame);
                        if (this._inDesignArticleService.isValidArticleTextFrame(frame)) {
                            const textStats = this._getTextStatisticsWithoutOverset(frame);
                            textComponent.frames.push({
                                "geometricBounds": this._composeGeometricBounds(outerBounds.topLeftX, outerBounds.topLeftY, frame),
                                "columns": frame.textFramePreferences.textColumnCount,
                                "words": textStats.wordCount,
                                "characters": textStats.charCount,
                                "textWrapMode": this._getTextWrapMode(frame),
                                "totalLineHeight": this._roundTo3Decimals(textStats.totalLineHeight),
                                "text": textStats.text
                            });
                            textComponent.words += textStats.wordCount;
                            textComponent.characters += textStats.charCount;
                        }
                    }
                    articleShapeJson.textComponents.push(textComponent);
                } else if (this._inDesignArticleService.isValidArticleGraphicFrame(element.itemRef)) {
                    pageItems.push(element.itemRef);
                    articleShapeJson.imageComponents.push({
                        "geometricBounds": this._composeGeometricBounds(outerBounds.topLeftX, outerBounds.topLeftY, element.itemRef),
                        "textWrapMode": this._getTextWrapMode(element.itemRef)
                    });
                } else {
                    this._logger.info("Article '{}' has a page item '{}' placed at ({},{}). " 
                        + "The page item is either not valid or not a text/graphic frame. "
                        + "Hence the item is excluded from the article export operation.",
                        article.name, element.itemRef.constructorName, 
                        element.itemRef.geometricBounds[1], element.itemRef.geometricBounds[0]);
                }
            }
            if (pageItems.length === 0) {
                continue;
            }
            const managedArticle = this._getManagedArticleFromPageItems(pageItems)
            if (managedArticle) {
                articleShapeJson.genreId = this._resolveGenreFromManagedArticle(managedArticle);
            }
            if (!this._arePageItemsOnSameSpread(pageItems)) {
                const message = ("Article '{}' could not be exported because not all "
                    + "page items are placed on the same spread.").format(article.name);
                alert(message);
                this._logger.error(message);
                continue;
            }
            await this._exportArticlePageItems(doc, folder, articleShapeJson.shapeTypeName, articleIndex, pageItems, articleShapeJson)
            exportCounter++;
        }
        app.scriptPreferences.measurementUnit = idd.AutoEnum.AUTO_VALUE;
        return exportCounter;    
    }

    /**
     * @param {String} articleName 
     * @returns {Object|null}
     */
    this._resolveShapeTypeFromArticleName = function(articleName) {
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
            this._logger.warning("Shape type could not be resolved from article '{}' due to bad naming convention.", articleName);
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
    this._getFileBaseName = async function(doc, folder, shapeTypeName, articleIndex) {
        let fileName = doc.name + ' ' + shapeTypeName + ' ' + (articleIndex + 1);
        try {
            // Get workflow object ID and Version from Studio.
            fileName = fileName + ' (' + doc.entMetaData.get("Core_ID") + '.v' + doc.entMetaData.get("Version") + ')';
        } catch (error) {
            // Use path of layout to make file name unique.
            if (doc.saved) {
                const docFile  = await doc.fullName;
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
    this._composeGeometricBounds = function(topLeftX, topLeftY, pageItem) {
        return {
            "x": this._roundTo3Decimals(pageItem.geometricBounds[1] - topLeftX),
            "y": this._roundTo3Decimals(pageItem.geometricBounds[0] - topLeftY),
            "width": this._roundTo3Decimals(pageItem.geometricBounds[3] - pageItem.geometricBounds[1]),
            "height": this._roundTo3Decimals(pageItem.geometricBounds[2] - pageItem.geometricBounds[0])
        }    
    }

    /**
     * Round a given number to a precision of maximum 3 decimals.
     * @param {Number} precisionNumber 
     * @returns {Number}
     */
    this._roundTo3Decimals = function(precisionNumber) {
        return Math.round(precisionNumber * 1000) / 1000;
    }

    /**
     * 
     * @param {Document} doc 
     * @param {String} articleName 
     * @param {Object} outerBounds
     * @returns {Object|null}
     */
    this._composeArticleShapeJson = function(doc, articleName, outerBounds) {

        // Resolve Brand/Category. Fallback to defaults when no Studio session.
        let brand = null;
        let category = null;
        try {
            brand = app.entSessions.getPublication(
                doc.entMetaData.get("Core_Publication")
            );
            category = app.entSession.getCategory(
                doc.entMetaData.get("Core_Publication"), 
                doc.entMetaData.get("Core_Section"), 
                doc.entMetaData.get("Core_Issue")
            );
        } catch (error) {
            brand = this._fallbackBrand;
            category = this._fallbackCategory;
        }
        this._logger.info("Resolved brand '{}' (id={}) and category '{}' (id={}).", 
            brand.name, brand.id, category.name, category.id);

        // Resolve the shape type. Bail out when article has bad naming convention.
        const shapeType = this._resolveShapeTypeFromArticleName(articleName)
        if(shapeType === null) {
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
                "x": this._roundTo3Decimals(outerBounds.topLeftX),
                "y": this._roundTo3Decimals(outerBounds.topLeftY),
                "width": this._roundTo3Decimals(outerBounds.bottomRightX - outerBounds.topLeftX),
                "height": this._roundTo3Decimals(outerBounds.bottomRightY - outerBounds.topLeftY)
            },
            "overlapsesFold": false,
            "foldLine": null,
            "textComponents": [],
            "imageComponents": []
        }
        const geometricBoundsRight = articleShapeJson.geometricBounds.x + articleShapeJson.geometricBounds.width;
        articleShapeJson.overlapsesFold = doc.documentPreferences.pageWidth < geometricBoundsRight;
        if (articleShapeJson.overlapsesFold) {
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
    this._arePageItemsOnSameSpread = function(pageItems) {
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
    this._exportArticlePageItems = async function(doc, folder, shapeTypeName, articleIndex, pageItems, articleShapeJson) {
        const fs = require('uxp').storage.localFileSystem;

        const baseFileName = await this._getFileBaseName(doc, folder, shapeTypeName, articleIndex);
        const snippetFile = await fs.createEntryWithUrl(baseFileName + ".idms", { overwrite: true });
        const imgFile = await fs.createEntryWithUrl(baseFileName + ".jpg", { overwrite: true });
        const jsonFile = await fs.createEntryWithUrl(baseFileName + ".json", { overwrite: true });

        // Export IDMS snippet.
        let pageItemsIds = [];
        for (let index = 0; index < pageItems.length; index++) {
            const pageItem = pageItems[index];
            this._logger.info(`Exporting '${pageItem.constructor.name}' page item with id '${pageItem.id}'.`);
            pageItemsIds.push(pageItem.id);
        }    
        doc.exportPageItemsToSnippet(snippetFile, pageItemsIds);

        // Export JPEG image.
        const PreferencesManager = require('./PreferencesManager.js');
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
            this._logger.logError(error);
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
        this._saveJsonToDisk(articleShapeJson, jsonFile);    
    }

    /**
    * Save JSON data to a file on disk.
    * @param {Object} jsonData - The JSON object to save.
    * @param {File} file
    */
    this._saveJsonToDisk = function(jsonData, file) {
        try {
            // Convert JSON object to a string
            const jsonString = JSON.stringify(jsonData, null, 4);

            // Write the JSON string to the file
            const formats = require('uxp').storage.formats;
            file.write(jsonString, {format: formats.utf8}); 
        } catch (e) {
            alert("An error occurred: " + e.message);
        }
    }

    /**
     * Get the word count and character count of a text frame, excluding overset text.
     * @param {TextFrame} textFrame - The text frame to analyze.
     * @returns {Object} - An object containing word count, character count and text without overset.
     */
    this._getTextStatisticsWithoutOverset = function(textFrame) {

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
            totalLineHeight += this._getLineHeight(visibleTextItem);
        }

        return { 
            wordCount: wordCount, 
            charCount: charCount, 
            text: text, 
            totalLineHeight: this._roundTo3Decimals(totalLineHeight) 
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
    this._getOuterboundOfArticleShape = function(elements) {
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
            if (this._inDesignArticleService.isValidArticleTextFrame(element.itemRef)) {
                threadedFrames = this._getThreadedFrames(element.itemRef);
            } else {
                threadedFrames = [element.itemRef];
            }

            for (let k = 0; k < threadedFrames.length; k++) {
                frame = threadedFrames[k];

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
    this._getThreadedFrames = function(textFrame) {
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
    this._getTextWrapMode = function(frame) {
        if (!this._inDesignArticleService.isValidArticleComponentFrame(frame)) {
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
    this._getLineHeight = function(line) {
        if (line.characters.length === 0) {
            return 0;
        }

        // Calculate line height based on line leading and base shift of first character.
        let leading = line.leading; // line spacing
        const baselineShift = line.characters.item(0).baselineShift;

        // If leading is set to Auto (value = -1), estimate it as 120% of font size.
        if (leading.equals(idd.Leading.AUTO)) {
            const fontSize = line.characters.item(0).pointSize;
            leading = fontSize * 1.2;
        }

        // Calculate final line height.
        return leading + (baselineShift || 0);
    }

    /**
     * @param {Array<PageItem>} pageItems 
     * @returns {ManagedArticle|null}
     */
    this._getManagedArticleFromPageItems = function(pageItems) {
        for (let i = 0; i < pageItems.length; i++) {
            const pageItem = pageItems[i];        
            try {
                if (pageItem.managedArticle.constructorName === "ManagedArticle") {
                    return pageItem.managedArticle;
                }                
            } catch (error) {}
        }
        return null;
    }

    /**
     * @param {ManagedArticle} managedArticle 
     * @return {String|null}
     */
    this._resolveGenreFromManagedArticle = function(managedArticle) {
        if (!managedArticle.entMetaData.constructorName === "EntMetaData") {
            return null;
        }
        if (!managedArticle.entMetaData.has("C_PLA_GENRE")) {
            return null;
        }
        let genreId = managedArticle.entMetaData.get("C_PLA_GENRE");
        if (!genreId instanceof String) {
            return null;
        }
        genreId = genreId.trim();
        if (genreId.length == 0) {
            return null;
        }
        return genreId;
    }
}

module.exports = ExportInDesignArticlesToPlaService;