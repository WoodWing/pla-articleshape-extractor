/**
 * Create a new InDesign Article with the given name. Add the selected frames to the article.
 * @param {String} articleName
 */
function createNewInDesignArticleWithSelectedFrames(doc, articleName) {

    // Create a new InDesign Article (even if an article with the same name already exists).
    var article = doc.articles.add();
    article.name = articleName;

    // Add selected frames to the new article.
    for (var i = 0; i < app.selection.length; i++) {
        var frame = app.selection[i];
        if (isValidArticleComponentFrame(frame)) {
            try {
                article.articleMembers.add(frame);
            } catch (error) {
            }
        }
    }
}

/**
 * Collect articles the provided frame is part of.
 * @param {PageItem} Valid text/graphic frame.
 * @returns {Array<Article>}
 */
function getInDesignArticles(doc, frame) {
    var docArticles = doc.articles;
    var frameArticles = [];

    // Loop through all articles to check if the frame is a member
    for (var i = 0; i < docArticles.length; i++) {
        var docArticle = docArticles[i];

        // Check if the frame is in the article's members
        if (isFrameMemberOfInDesignArticle(docArticle, frame)) {
            frameArticles.push(docArticle);
        }
    }

    return frameArticles;
}

/**
 * Tell whether a given page item is member of a the given InDesign Article.
 * @param {Article} article - The InDesign article to check.
 * @param {PageItem} frame - The frame to check for membership.
 * @returns {Boolean} - True if the frame is already a member of the article, false otherwise.
 */
function isFrameMemberOfInDesignArticle(article, frame) {
    var articleMembers = article.articleMembers.everyItem().getElements(); // Get all members as an array
    for (var i = 0; i < articleMembers.length; i++) {
        if (articleMembers[i].itemRef === frame) {
            return true; // The frame is already a member of the article
        }
    }
    return false; // Frame not found in the article
}

/**
 * Create a new InDesign Article for the currently selected frames. Or, when the frames are
 * already member of existing articles, rename the articles instead.
 * 
 * For the provided article name, pass in the story type (Lead, Secondary, Third or Filler).
 * This name will be applied to new articles. For existing articles, it replaces previously 
 * set story type (in the existing article names) with the new/provided story type.
 * 
 * @param {String} articleName 
 */
function addOrRenameInDesignArticle(articleName) {
    if (app.documents.length === 0) {
        alert("No document is open.");
        return;
    }

    if (app.selection.length === 0) {
        alert("Please select one or more frames first.");
        return;
    }

    var frame = app.selection[0];
    if (!isValidArticleComponentFrame(frame)) {
        alert("Invalid or no text/graphical frame selected.");
        return;
    }

    // Add new InDesign Articles.
    var doc = app.activeDocument;
    var articles = getInDesignArticles(doc, frame);
    if (articles.length == 0) {
        createNewInDesignArticleWithSelectedFrames(doc, articleName);
        alert("A new article '" + articleName + "' has been created, and selected frames have been added.");
        return;
    }

    // Rename existing InDesign Articles.
    for (var articleIndex = 0; articleIndex < articles.length; articleIndex++) {
        var article = articles[articleIndex];
        var newName = article.name;
        var oldName = article.name;

        var storyTypeNames = ["Lead", "Secondary", "Third", "Filler"];
        for (var storyTypeIndex = 0; storyTypeIndex < storyTypeNames.length; storyTypeIndex++) {
            var storyTypeName = storyTypeNames[storyTypeIndex];
            newName = replaceTextCaseInsensitive(newName, storyTypeName, articleName);
            newName = cleanWhitespaces(newName)
        };
        if (newName != oldName) {
            article.name = newName;
            alert("Article \"" + oldName + "\" has been renamed to \"" + newName + "\"");
        }
    }
}

/**
 * Search for a text fragment (case insensitive) and substitute any found match with a replacement.
 * @param {String} text 
 * @param {String} search 
 * @param {String} replacement 
 * @returns {String} Text with substitutes.
 */
function replaceTextCaseInsensitive(text, search, replacement) {
    var regex = new RegExp(search, "gi"); // "g" = global, "i" = case insensitive
    return text.replace(regex, replacement);
}

/**
 * Remove any leading or trailing whitespaces. Replace multiple inner whitespaces with a single space.
 * @param {String} text 
 * @returns {String} Cleaned text.
 */
function cleanWhitespaces(text) {
    return text.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
}

/**
 * Tells whether the given page item is a valid text frame (to be part of an article).
 * @param {pageItem|null} object
 * @returns {Boolean}
 */
function isValidArticleTextFrame(pageItem) {
    return pageItem && pageItem instanceof TextFrame && pageItem.isValid
}

/**
 * Tells whether the given page item is a valid graphic frame (to be part of an article).
 * A graphic frame is any SplineItem, except GraphicLine; So only Rectangle, Oval and Polygon.
 * @param {pageItem|null} object
 * @returns {Boolean}
 */
function isValidArticleGraphicFrame(pageItem) {
    return pageItem && (pageItem instanceof Rectangle || pageItem instanceof Oval || pageItem instanceof Polygon) && pageItem.isValid;
}

/**
 * Tells whether the given page item is a valid text- or graphic frame (to be part of an article).
 * @param {pageItem|null} object
 * @returns {Boolean}
 */
function isValidArticleComponentFrame(pageItem) {
    return isValidArticleTextFrame(pageItem) || isValidArticleGraphicFrame(pageItem)
}