
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
    this.run = function(doc, folder) {
        this._logger.info("Extracting InDesign Articles for layout document '{}'.", doc.fullName);
        var exportCounter = 0;

        app.scriptPreferences.measurementUnit = MeasurementUnits.POINTS;
        for (var articleIndex = 0; articleIndex < doc.articles.length; articleIndex++) {
            var article = doc.articles[articleIndex];
            var pageItems = []; // Collect all associated page items for the article.
            var elements = article.articleMembers.everyItem().getElements();
            var outerBounds = this._getOuterboundOfArticleShape(elements);
            var articleShapeJson = this._composeArticleShapeJson(doc, article.name, outerBounds);
            if (articleShapeJson === null) {
                this._logger.warning("Excluded article '{}' from export because conversion to JSON failed.", article.name);
                continue;
            }

            for (var elementIndex = 0; elementIndex < elements.length; elementIndex++) {
                var element = elements[elementIndex];
                if (this._inDesignArticleService.isValidArticleTextFrame(element.itemRef)) {
                    var threadedFrames = this._getThreadedFrames(element.itemRef);
                    var textComponent = {
                        "type": element.itemRef.elementLabel,
                        "words": 0,
                        "characters": 0,
                        "firstParagraphStyle": "",
                        "frames": []
                    };

                    // Add the name of the first paragraph style used in the chain of threaded frames.
                    if (threadedFrames[0].paragraphs.length > 0) {
                        textComponent.firstParagraphStyle = threadedFrames[0].paragraphs[0].appliedParagraphStyle.name
                    }

                    for (var frameIndex = 0; frameIndex < threadedFrames.length; frameIndex++) {
                        var frame = threadedFrames[frameIndex];
                        pageItems.push(frame);
                        if (this._inDesignArticleService.isValidArticleTextFrame(frame)) {
                            var textStats = this._getTextStatisticsWithoutOverset(frame);
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
                        article.name, element.itemRef.constructor.name, 
                        element.itemRef.geometricBounds[1], element.itemRef.geometricBounds[0]);
                }
            }
            if (pageItems.length === 0) {
                continue;
            }
            var managedArticle = this._getManagedArticleFromPageItems(pageItems)
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
            this._exportArticlePageItems(doc, folder, articleShapeJson.shapeTypeName, articleIndex, pageItems, articleShapeJson)
            exportCounter++;
        }
        app.scriptPreferences.measurementUnit = AutoEnum.AUTO_VALUE;    
        return exportCounter;    
    }

    /**
     * @param {String} articleName 
     * @returns {Object|null}
     */
    this._resolveShapeTypeFromArticleName = function(articleName) {
        var shapeType = { id: null, name: null };
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
    this._getFileBaseName = function(doc, folder, shapeTypeName, articleIndex) {
        var baseFileName = folder.fsName + "/" + doc.name + ' ' + shapeTypeName + ' ' + (articleIndex + 1);
        try {
            // Get workflow object ID and Version from Studio.
            baseFileName = baseFileName + ' (' + doc.entMetaData.get("Core_ID") + '.v' + doc.entMetaData.get("Version") + ')';
        } catch (error) {
            // Use path of layout to make file name unique.
            if (doc.saved) {
                var suffix = doc.filePath.absoluteURI;
                if ((suffix.indexOf("~\\") === 0) || (suffix.indexOf("~/") === 0)) {
                    suffix = suffix.replace("~\\", "").replace("~/", "");
                }
                while ((suffix.indexOf("\\") === 0) || (suffix.indexOf("/") === 0)) {
                    suffix = suffix.replace("\\", "").replace("/", "");
                }
                while ((suffix.indexOf("\\") != -1) || (suffix.indexOf("/") != -1)) {
                    suffix = suffix.replace("\\", "-").replace("/", "-");
                }
                baseFileName = baseFileName + ' (' + suffix + ")";
            }
        }
        return baseFileName;
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
        return Math.round(precisionNumber * 1000) / 1000
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
        try {
            var brand = app.entSessions.getPublication(
                doc.entMetaData.get("Core_Publication")
            );
            var category = app.entSession.getCategory(
                doc.entMetaData.get("Core_Publication"), 
                doc.entMetaData.get("Core_Section"), 
                doc.entMetaData.get("Core_Issue")
            );
        } catch (error) {
            var brand = this._fallbackBrand;
            var category = this._fallbackCategory;
        }
        this._logger.info("Resolved brand '{}' (id={}) and category '{}' (id={}).", 
            brand.name, brand.id, category.name, category.id);

        // Resolve the shape type. Bail out when article has bad naming convention.
        var shapeType = this._resolveShapeTypeFromArticleName(articleName)
        if(shapeType === null) {
            return null;
        }

        // Compose a base structure in the Article Shape JSON export format.
        var articleShapeJson = {
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
            "textComponents": [],
            "imageComponents": []
        }
        articleShapeJson.overlapsesFold = doc.documentPreferences.pageWidth < articleShapeJson.geometricBounds.x + articleShapeJson.geometricBounds.width;
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
        var firstItemSpread = pageItems[0].parent;
        for (var i = 1; i < pageItems.length; i++) {
            if (pageItems[i].parent !== firstItemSpread) {
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
    this._exportArticlePageItems = function(doc, folder, shapeTypeName, articleIndex, pageItems, articleShapeJson) {
        var baseFileName = this._getFileBaseName(doc, folder, shapeTypeName, articleIndex)
        var snippetFile = File(baseFileName + ".idms");
        var imgFile = File(baseFileName + ".jpg");
        var jsonFileName = baseFileName + ".json";

        // Export IDMS snippet.
        doc.select(pageItems);
        doc.exportPageItemsSelectionToSnippet(snippetFile);

        // Export JPEG image.
        try {
            var group = doc.groups.add(pageItems);

            // Define JPEG export options
            app.jpegExportPreferences.jpegQuality = JPEGOptionsQuality.HIGH;
            app.jpegExportPreferences.exportResolution = 144; // DPI, screen resolution
            group.exportFile(ExportFormat.JPG, imgFile);
        } catch (e) {
            alert("Error exporting the snippet: " + e.message);
        } finally {
            // Ungroup the items after export
            group.ungroup();
        }

        // Export JSON.
        this._saveJsonToDisk(articleShapeJson, jsonFileName);    
    }

    /**
    * Save JSON data to a file on disk.
    * @param {Object} jsonData - The JSON object to save.
    * @param {String} filePath - The full path to save the file (including file name and .json extension).
    */
    this._saveJsonToDisk = function(jsonData, filePath) {
        try {
            // Convert JSON object to a string
            var jsonString = JSON.stringify(jsonData, null, 4);

            // Create a File object
            var file = new File(filePath);
            file.encoding = "UTF-8";

            // Open the file for writing
            if (file.open("w")) {
                file.write(jsonString); // Write the JSON string to the file
                file.close(); // Close the file
            } else {
                alert("Failed to open the file for writing.");
            }
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
        var visibleText = textFrame.lines;
        var wordCount = 0;
        var charCount = 0;
        var text = "";
        var totalLineHeight = 0;

        // Loop through visible lines to count words and characters
        for (var i = 0; i < visibleText.length; i++) {
            wordCount += visibleText[i].words.length;
            charCount += visibleText[i].characters.length;
            text += visibleText[i].contents;
            totalLineHeight += this._getLineHeight(visibleText[i]);
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
        var topLeftX = 0;
        var topLeftY = 0;
        var bottomRightX = 0;
        var bottomRightY = 0;

        for (var j = 0; j < elements.length; j++) {
            var element = elements[j];
            var threadedFrames;

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

            for (var k = 0; k < threadedFrames.length; k++) {
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
        var threadedFrames = [];
        var currentFrame = textFrame;

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

        var textWrapPrefs = frame.textWrapPreferences;

        if (textWrapPrefs.textWrapMode == TextWrapModes.NONE) {
            return "none"
        } else if (textWrapPrefs.textWrapMode == TextWrapModes.BOUNDING_BOX_TEXT_WRAP) {
            return "bounding_box"
        } else if (textWrapPrefs.textWrapMode == TextWrapModes.CONTOUR) {
            return "contour"
        } else if (textWrapPrefs.textWrapMode == TextWrapModes.JUMP_OBJECT_TEXT_WRAP) {
            return "jump_object"
        } else if (textWrapPrefs.textWrapMode == TextWrapModes.NEXT_COLUMN_TEXT_WRAP) {
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
        var leading = line.leading; // line spacing
        var baselineShift = line.characters[0].baselineShift;

        // If leading is set to Auto (value = -1), estimate it as 120% of font size.
        if (leading === Leading.AUTO) {
            var fontSize = line.characters[0].pointSize;
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
        for (var i = 0; i < pageItems.length; i++) {
            var pageItem = pageItems[i];        
            try {
                if (pageItem.managedArticle instanceof ManagedArticle) {
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
        if (!managedArticle.entMetaData instanceof EntMetaData) {
            return null;
        }
        if (!managedArticle.entMetaData.has("C_PLA_GENRE")) {
            return null;
        }
        var genreId = managedArticle.entMetaData.get("C_PLA_GENRE");
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