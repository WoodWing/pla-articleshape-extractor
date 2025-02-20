//@include "Json.inc.jsx";

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
function exportArticlesAsSnippets(folder) {
    var doc = app.activeDocument;
    var exportCounter = 0;

    app.scriptPreferences.measurementUnit = MeasurementUnits.POINTS;

    // Check if the document has any articles
    if (doc.articles.length === 0) {
        alert("No articles found in the document.");
        return;
    }

    //Get the category object of the layout
    try {
        var publication = app.entSessions.getPublication(doc.entMetaData.get("Core_Publication"));
        var category = app.entSession.getCategory(doc.entMetaData.get("Core_Publication"), doc.entMetaData.get("Core_Section"), doc.entMetaData.get("Core_Issue"));
    } catch (error) {
        var publication = fallBackSettings.publication;
        var category = fallBackSettings.category;
    }

    // Loop through each article
    for (var i = 0; i < doc.articles.length; i++) {

        var article = doc.articles[i];
        var shapeType = resolveShapeTypeFromArticleName(article.name)
        if(shapeType === null) {
            continue;
        }

        var articleShapeJson = {
            "brandName": publication.name,
            "brandId": publication.id,
            "sectionName": category.name,
            "sectionId": category.id,
            "shapeTypeName": shapeType.name,
            "shapeTypeId": shapeType.id,
            "geometricBounds": {
                "x": 0,
                "y": 0,
                "width": 0,
                "height": 0
            },
            "overlapsesFold": false,
            "textComponents": [],
            "imageComponents": []
        }

        // Create a unique filename
        var baseFileName = folder.fsName + "/" + doc.name + ' ' + shapeType.name + ' ' + (i + 1);
        try {
            //Get Studio version and ID
            baseFileName = baseFileName + ' (' + doc.entMetaData.get("Core_ID") + '.v' + doc.entMetaData.get("Version") + ')';
        } catch (error) {
            //Use path of layout to make file name unique
            if (doc.saved) {
                var suffix = doc.filePath.absoluteURI;
                while ((suffix.indexOf("~") != -1) || (suffix.indexOf("\\") != -1) || (suffix.indexOf("/") != -1)) {
                    suffix = suffix.replace("~", "").replace("\\", "-").replace("/", "-");
                }

                baseFileName = baseFileName + ' (' + suffix + ")";
            }
        }

        // Collect all associated page items for the article
        var pageItems = [];
        var elements = article.articleMembers.everyItem().getElements();
        var outerBounds = getOuterboundOfArticleShape(elements);

        for (var j = 0; j < elements.length; j++) {
            var element = elements[j];

            //Create an array with all thread frames (images dont have threaded frames)
            if (isValidTextFrame(element.itemRef)) {
                var threadedFrames = getThreadedFrames(element.itemRef);

                var textComponent = {
                    "type": element.itemRef.elementLabel,
                    "words": 0,
                    "characters": 0,
                    "firstParagraphStyle": "",
                    "frames": [
                    ]
                };

                //Add the name of the first paragraph style used in the chain of threaded frames
                if (threadedFrames[0].paragraphs.length > 0) {
                    textComponent.firstParagraphStyle = threadedFrames[0].paragraphs[0].appliedParagraphStyle.name
                }

                for (var k = 0; k < threadedFrames.length; k++) {
                    var frame = threadedFrames[k];

                    //Ensure elements have the right z-index
                    pageItems.push(frame);
                    //frame.sendToBack();

                    //Add frame to JSON
                    if (isValidTextFrame(frame)) {
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

                //Add the shape 
                articleShapeJson.textComponents.push(textComponent);
            } else {
                //Ensure elements have the right z-index
                pageItems.push(element.itemRef);
                //element.itemRef.sendToBack();

                articleShapeJson.imageComponents.push({
                    "geometricBounds": composeGeometricBounds(outerBounds.topLeftX, outerBounds.topLeftY, element.itemRef),
                    "textWrapMode": getTextWrapMode(element.itemRef)
                });
            }

        }

        articleShapeJson.geometricBounds.x = outerBounds.topLeftX;
        articleShapeJson.geometricBounds.y = outerBounds.topLeftY;
        articleShapeJson.geometricBounds.width = outerBounds.bottomRightX - outerBounds.topLeftX;
        articleShapeJson.geometricBounds.height = outerBounds.bottomRightY - outerBounds.topLeftY;

        articleShapeJson.overlapsesFold = doc.documentPreferences.pageWidth < articleShapeJson.geometricBounds.x + articleShapeJson.geometricBounds.width;


        // Export the article's page items
        if (pageItems.length > 1) {
            var snippetFile = File(baseFileName + ".idms");
            var imgFile = File(baseFileName + ".jpg");
            var jsonFileName = baseFileName + ".json"

            //Export as snippet
            doc.select(pageItems);
            doc.exportPageItemsSelectionToSnippet(snippetFile);

            // Export as image
            try {
                var group = doc.groups.add(pageItems);

                // Define JPEG export options
                app.jpegExportPreferences.jpegQuality = JPEGOptionsQuality.HIGH;
                app.jpegExportPreferences.exportResolution = 300; // Set resolution to 300 DPI
                group.exportFile(ExportFormat.JPG, imgFile);
            } catch (e) {
                alert("Error exporting the snippet: " + e.message);
            } finally {
                // Ungroup the items after export
                group.ungroup();
            }

            //Export JSON
            saveJsonToDisk(articleShapeJson, jsonFileName);

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
        if (isValidTextFrame(element.itemRef)) {
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
 * @param {Object} frame - The InDesign frame object (e.g., TextFrame, GraphicFrame).
 * @returns {String} - Name of the text wrap mode
 */
function getTextWrapMode(frame) {
    if (!frame || !frame.isValid) {
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
 * Tells whether the given object is a valid text frame.
 * @param {Object} object
 * @returns {Boolean}
 */
function isValidTextFrame(object) {
    return object && object instanceof TextFrame && object.isValid
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