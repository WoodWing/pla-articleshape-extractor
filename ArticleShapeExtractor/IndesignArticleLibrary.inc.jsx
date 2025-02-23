/**
 * Creates a new InDesign article with the given name and adds the selected frames to it.
 * @param {String} articleName - The name of the article to create.
 */
function createNewArticleWithSelectedFrames(doc, articleName) {

    // Create a new article (even if an article with the same name already exists)
    var article = doc.articles.add();
    article.name = articleName;

    // Add selected frames to the new article
    for (var i = 0; i < app.selection.length; i++) {
        var frame = app.selection[i];

        // Ensure that the selected item is a valid frame (TextFrame, GraphicFrame, or Rectangle)
        if (frame instanceof TextFrame || frame instanceof Rectangle || frame instanceof Oval || frame instanceof Polygon) {
            try {
                article.articleMembers.add(frame);
            } catch (error) {

            }
        }
    }

    alert("A new article '" + articleName + "' has been created, and selected frames have been added.");
}

/**
 * Returns an array of all the articles the selected frame is part of.
 * @param {Object} frame - The selected frame (e.g., TextFrame, Rectangle, Oval, or Polygon).
 * @returns {Array} - An array of article names the frame is part of.
 */
function getIndesignArticles(doc, frame) {
    if (!frame || !frame.isValid) {
        alert("Invalid or no frame selected.");
        return [];
    }

    var articles = doc.articles;
    var indesignArticles = [];

    // Loop through all articles to check if the frame is a member
    for (var i = 0; i < articles.length; i++) {
        var article = articles[i];

        // Check if the frame is in the article's members
        if (isFrameInArticle(article, frame)) {
            indesignArticles.push(article);
        }
    }

    return indesignArticles;
}

/**
 * Checks if a given frame is already a member of the specified article.
 * @param {Article} article - The InDesign article to check.
 * @param {Object} frame - The frame to check for membership.
 * @returns {Boolean} - True if the frame is already a member of the article, false otherwise.
 */
function isFrameInArticle(article, frame) {
    if (!article || !frame || !frame.isValid) {
        return false;
    }

    var articleMembers = article.articleMembers.everyItem().getElements(); // Get all members as an array

    for (var i = 0; i < articleMembers.length; i++) {
        if (articleMembers[i].itemRef === frame) {
            return true; // The frame is already a member of the article
        }
    }

    return false; // Frame not found in the article
}

function addOrRenameInDesignArticle(articleName) {
    if (app.documents.length === 0) {
        alert("No document is open.");
        return;
    }

    var doc = app.activeDocument;

    // Ensure that at least one item is selected
    if (app.selection.length === 0) {
        alert("Please select one or more frames first.");
        return;
    }


    var indesignArticles = getIndesignArticles(doc, app.selection[0]);

    if (indesignArticles.length == 0) {
        createNewArticleWithSelectedFrames(doc, articleName);
    } else {
        for (var i = 0; i < indesignArticles.length; i++) {
            var article = indesignArticles[i];
            var newName = article.name;
            var oldName = article.name;

            newName = newName.replace(" Lead", "").replace(" Secondary", "").replace(" Third", "").replace(" Filler", "");
            newName = newName.replace("Lead", "").replace("Secondary", "").replace("Third", "").replace("Filler", "");
            newName = newName + " " + articleName;
            article.name = newName;

            alert("Article \"" + oldName + "\" has been renamed to \"" + newName + "\"");
        }
    }

}