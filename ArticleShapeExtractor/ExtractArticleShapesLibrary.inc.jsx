//@include "Json.inc.jsx";
//@include "InDesignArticleLibrary.inc.jsx";

//Settings used if the layout is not stored in Studio
var fallBackSettings = {
    "publication": {
        "name": "WW News",
        "id": "1",
    },
    "category": {
        "name": "News",
        "id": "1",
    },
}

// Function to export all InDesign articles as snippets
function exportArticlesAsSnippets(doc, folder) {
    var exportCounter = 0;

    app.scriptPreferences.measurementUnit = MeasurementUnits.POINTS;
    for (var articleIndex = 0; articleIndex < doc.articles.length; articleIndex++) {
        var article = doc.articles[articleIndex];
        var pageItems = []; // Collect all associated page items for the article.
        var elements = article.articleMembers.everyItem().getElements();
        var outerBounds = getOuterboundOfArticleShape(elements);
        var articleShapeJson = composeArticleShapeJson(doc, article.name, outerBounds);
        if (articleShapeJson === null) {
            continue;
        }

        for (var elementIndex = 0; elementIndex < elements.length; elementIndex++) {
            var element = elements[elementIndex];
            if (isValidArticleTextFrame(element.itemRef)) {
                var threadedFrames = getThreadedFrames(element.itemRef);
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
                    if (isValidArticleTextFrame(frame)) {
                        var textStats = getTextStatisticsWithoutOverset(frame);
                        textComponent.frames.push({
                            "geometricBounds": composeGeometricBounds(outerBounds.topLeftX, outerBounds.topLeftY, frame),
                            "columns": frame.textFramePreferences.textColumnCount,
                            "words": textStats.wordCount,
                            "characters": textStats.charCount,
                            "textWrapMode": getTextWrapMode(frame),
                            "totalLineHeight": roundTo3Decimals(textStats.totalLineHeight),
                            "text": textStats.text
                        });
                        textComponent.words += textStats.wordCount;
                        textComponent.characters += textStats.charCount;
                    }
                }
                articleShapeJson.textComponents.push(textComponent);
            } else if (isValidArticleGraphicFrame(element.itemRef)) {
                pageItems.push(element.itemRef);
                articleShapeJson.imageComponents.push({
                    "geometricBounds": composeGeometricBounds(outerBounds.topLeftX, outerBounds.topLeftY, element.itemRef),
                    "textWrapMode": getTextWrapMode(element.itemRef)
                });
            }
        }
        if (pageItems.length > 1) {
            exportArticlePageItems(doc, folder, articleShapeJson.shapeTypeName, articleIndex, pageItems, articleShapeJson)
            exportCounter++;
        }
    }
    app.scriptPreferences.measurementUnit = AutoEnum.AUTO_VALUE;    
    return exportCounter;    
}

/**
 * @param {String} articleName 
 * @returns {Object|null}
 */
function resolveShapeTypeFromArticleName(articleName) {
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
        shapeType = null;
    }
    return shapeType;
}

/**
 * Compose a unique name that can be used as a base to compose export filenames.
 * @param {Document} doc 
 * @param {Object} folder 
 * @param {String} shapeTypeName 
 * @param {Number} articleIndex 
 * @returns {String}
 */
function getFileBaseName(doc, folder, shapeTypeName, articleIndex) {
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
function composeGeometricBounds(topLeftX, topLeftY, pageItem) {
    return {
        "x": roundTo3Decimals(pageItem.geometricBounds[1] - topLeftX),
        "y": roundTo3Decimals(pageItem.geometricBounds[0] - topLeftY),
        "width": roundTo3Decimals(pageItem.geometricBounds[3] - pageItem.geometricBounds[1]),
        "height": roundTo3Decimals(pageItem.geometricBounds[2] - pageItem.geometricBounds[0])
    }    
}

/**
 * Round a given number to a precision of maximum 3 decimals.
 * @param {Number} precisionNumber 
 * @returns {Number}
 */
function roundTo3Decimals(precisionNumber) {
    return Math.round(precisionNumber * 1000) / 1000
}

/**
 * 
 * @param {Document} doc 
 * @param {String} articleName 
 * @param {Object} outerBounds
 * @returns {Object|null}
 */
function composeArticleShapeJson(doc, articleName, outerBounds) {

    // Resolve Brand/Category. Fallback to defaults when no Studio session.
    try {
        var publication = app.entSessions.getPublication(
            doc.entMetaData.get("Core_Publication")
        );
        var category = app.entSession.getCategory(
            doc.entMetaData.get("Core_Publication"), 
            doc.entMetaData.get("Core_Section"), 
            doc.entMetaData.get("Core_Issue")
        );
    } catch (error) {
        var publication = fallBackSettings.publication;
        var category = fallBackSettings.category;
    }

    // Resolve the shape type. Bail out when article has bad naming convention.
    var shapeType = resolveShapeTypeFromArticleName(articleName)
    if(shapeType === null) {
        return null;
    }

    // Compose a base structure in the Article Shape JSON export format.
    var articleShapeJson = {
        "brandName": publication.name,
        "brandId": publication.id,
        "sectionName": category.name,
        "sectionId": category.id,
        "shapeTypeName": shapeType.name,
        "shapeTypeId": shapeType.id,
        "geometricBounds": {
            "x": roundTo3Decimals(outerBounds.topLeftX),
            "y": roundTo3Decimals(outerBounds.topLeftY),
            "width": roundTo3Decimals(outerBounds.bottomRightX - outerBounds.topLeftX),
            "height": roundTo3Decimals(outerBounds.bottomRightY - outerBounds.topLeftY)
        },
        "overlapsesFold": false,
        "textComponents": [],
        "imageComponents": []
    }
    articleShapeJson.overlapsesFold = doc.documentPreferences.pageWidth < articleShapeJson.geometricBounds.x + articleShapeJson.geometricBounds.width;
    return articleShapeJson;
}

/**
 * @param {Document} doc 
 * @param {Object} folder 
 * @param {String} shapeTypeName 
 * @param {Number} articleIndex 
 * @param {Array} pageItems
 * @param {Object} articleShapeJson
 */
function exportArticlePageItems(doc, folder, shapeTypeName, articleIndex, pageItems, articleShapeJson) {
    var baseFileName = getFileBaseName(doc, folder, shapeTypeName, articleIndex)
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
    saveJsonToDisk(articleShapeJson, jsonFileName);    
}

/**
* Save JSON data to a file on disk.
* @param {Object} jsonData - The JSON object to save.
* @param {String} filePath - The full path to save the file (including file name and .json extension).
*/
function saveJsonToDisk(jsonData, filePath) {
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
function getTextStatisticsWithoutOverset(textFrame) {

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
        totalLineHeight += getLineHeight(visibleText[i]);
    }

    return { 
        wordCount: wordCount, 
        charCount: charCount, 
        text: text, 
        totalLineHeight: roundTo3Decimals(totalLineHeight) 
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
function getOuterboundOfArticleShape(elements) {
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
        if (isValidArticleTextFrame(element.itemRef)) {
            threadedFrames = getThreadedFrames(element.itemRef);
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
function getThreadedFrames(textFrame) {
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
function getTextWrapMode(frame) {
    if (!isValidArticleComponentFrame(frame)) {
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
function getLineHeight(line) {
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