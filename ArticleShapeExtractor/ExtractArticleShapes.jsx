#target 'InDesign'
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
function exportArticlesAsSnippets() {
    var doc = app.activeDocument;


    // Check if the document has any articles
    if (doc.articles.length === 0) {
        alert("No articles found in the document.");
        return;
    }

    // Prompt the user to select the folder for saving the snippets
    var folder = Folder.selectDialog("Select a folder to save the snippets:");
    if (!folder) {
        alert("No folder selected. Export cancelled.");
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
        var shapeTypeName = "";
        var shapeTypeId = -1;

        if (article.name.toLowerCase().indexOf("lead") != -1) {
            shapeTypeName = "lead";
            shapeTypeId = "1";
        } else if (article.name.toLowerCase().indexOf("secondary") != -1) {
            shapeTypeName = "secondary";
            shapeTypeId = "2";
        } else if (article.name.toLowerCase().indexOf("third") != -1) {
            shapeTypeName = "third";
            shapeTypeId = "3";
        } else if (article.name.toLowerCase().indexOf("filler") != -1) {
            shapeTypeName = "filler";
            shapeTypeId = "4";
        } else {
            alert ("InDesign Article [" + article.name + "] skipped because the name does not include lead, secondary, third or filler");
        }       
        
        if (shapeTypeId > 0) {
            var articleShapeJson = {
                "brandName": publication.name,
                "brandId": publication.id,
                "sectionName": category.name,
                "sectionId": category.id,
                "shapeTypeName": shapeTypeName,
                "shapeTypeId": shapeTypeId,
                "geometricBounds": {
                    "width": 0,
                    "height": 0
                },
                "textComponents": [],
                "imageComponents": []
            }
    
            // Create a unique filename
            var baseFileName = folder.fsName + "/" + doc.name + ' ' + shapeTypeName + ' ' + (i + 1);
            try {
                //Get Studio version and ID
                baseFileName = baseFileName + ' (' + doc.entMetaData.get("Core_ID") + '.v' + doc.entMetaData.get("Version") + ')';   
            } catch (error) {
                //Use path of layout to make file name unique
                if (doc.saved) {
                    var suffix = doc.filePath.absoluteURI;
                    while ((suffix.indexOf("~") != -1) || (suffix.indexOf("\\") != -1) || (suffix.indexOf("/") != -1)) {
                        suffix = suffix.replace ("~", "").replace("\\","-").replace("/","-");
                    }
                    
                    baseFileName = baseFileName + ' (' + suffix + ")";   
                }
            }
            alert (baseFileName);
             
            var snippetFile = File(baseFileName + ".idms");
            var imgFile = File(baseFileName + ".jpg");
            var jsonFileName = baseFileName + ".json"
    
            // Collect all associated page items for the article
            var pageItems = [];
            var elements = article.articleMembers.everyItem().getElements();
            var outerBounds = getOuterboundOfArticleShape(elements);
    
    
            for (var j = 0; j < elements.length; j++) {
                var element = elements[j];
                var threadedFrames;
    
                //Create an array with all thread frames (images dont have threaded frames)
                if (element.itemRef.elementLabel == "graphic") {
                    threadedFrames = [element.itemRef];
                } else {
                    
                    threadedFrames = getThreadedFrames(element.itemRef);

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

                    //Add the shape 
                    articleShapeJson.textComponents.push(textComponent);
                }
    
                for (var k = 0; k < threadedFrames.length; k++) {
                    frame = threadedFrames[k];
    
                    //Ensure elements have the right z-index
                    pageItems.push(frame);
                    frame.sendToBack();
    
                    //Add frame to JSON
                    if (frame.elementLabel == "graphic") {                        
                        articleShapeJson.imageComponents.push({
                            "geometricBounds": {
                                "x": frame.geometricBounds[1] - outerBounds.topLeftX,
                                "y": frame.geometricBounds[0] - outerBounds.topLeftY,
                                "width": frame.geometricBounds[3] - frame.geometricBounds[1],
                                "height": frame.geometricBounds[2] - frame.geometricBounds[0]
                            },
                            "textWrapMode": getTextWrapMode(frame)                        
                        });
                                            
                    } else {
                        var textStats = getTextStatisticsWithoutOverset(frame);
                        textComponent.frames.push({
                            "geometricBounds": {
                                "x": frame.geometricBounds[1] - outerBounds.topLeftX,
                                "y": frame.geometricBounds[0] - outerBounds.topLeftY,
                                "width": frame.geometricBounds[3] - frame.geometricBounds[1],
                                "height": frame.geometricBounds[2] - frame.geometricBounds[0]
                            },
                            "columns": frame.textFramePreferences.textColumnCount,
                            "words": textStats.wordCount,
                            "characters": textStats.charCount,
                            "textWrapMode": getTextWrapMode(frame),
                            "text": textStats.text
                        });
                        textComponent.words += textStats.wordCount;
                        textComponent.characters += textStats.charCount;
                    }
                }
            }
    
            
            articleShapeJson.geometricBounds.width = outerBounds.bottomRightX - outerBounds.topLeftX;
            articleShapeJson.geometricBounds.height = outerBounds.bottomRightY - outerBounds.topLeftY;
    
            // Export the article's page items
            if (pageItems.length > 1) {
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
            }
        }
    }

    alert("All articles have been exported as snippets.");
}

/**
* Save JSON data to a file on disk.
* @param {Object} jsonData - The JSON object to save.
* @param {String} filePath - The full path to save the file (including file name and .json extension).
*/
function saveJsonToDisk(jsonData, filePath) {
    try {
        // Convert JSON object to a string
        var jsonString = JSON.stringify(jsonData);

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
    if (!textFrame || !textFrame.isValid) {
        alert("Invalid text frame.");
        return { wordCount: 0, charCount: 0 };
    }

    // Extract only the visible text (not overset)
    var visibleText = textFrame.lines;
    var wordCount = 0;
    var charCount = 0;
    var text = "";

    // Loop through visible lines to count words and characters
    for (var i = 0; i < visibleText.length; i++) {
        wordCount += visibleText[i].words.length;
        charCount += visibleText[i].characters.length;
        text += visibleText[i].contents;
    }

    return { wordCount: wordCount, charCount: charCount, text: text };
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
        if (element.itemRef.elementLabel == "graphic") {
            threadedFrames = [element.itemRef];
        } else {
            threadedFrames = getThreadedFrames(element.itemRef);
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
    if (!textFrame || !textFrame.isValid) {
        alert("Invalid text frame.");
        return [];
    }

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
    } else if  (textWrapPrefs.textWrapMode == TextWrapModes.NONE) {
        return "none"
    } else if  (textWrapPrefs.textWrapMode == TextWrapModes.BOUNDING_BOX_TEXT_WRAP) {
        return "bounding_box"
    } else if  (textWrapPrefs.textWrapMode == TextWrapModes.SHAPE_TEXT_WRAP) {
        return "contour"
    } else if  (textWrapPrefs.textWrapMode == TextWrapModes.JUMP_OBJECT_TEXT_WRAP) {
        return "jump_object"
    } else if  (textWrapPrefs.textWrapMode == TextWrapModes.JUMP_TO_NEXT_COLUMN_TEXT_WRAP) {
        return "jump_to_next_column"
    } else {
        return ""
    }
}

// Call the function
exportArticlesAsSnippets();