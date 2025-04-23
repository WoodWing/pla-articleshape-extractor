const { app } = require("indesign");

function InDesignArticleService() {

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
    this.addOrRenameInDesignArticle = function(articleName) {
        if (app.documents.length === 0) {
            const { NoDocumentOpenedError } = require('./Errors.js');
            throw new NoDocumentOpenedError();
        }

        if (app.selection.length === 0) {
            const { NoFramesSelectedError } = require('./Errors.js');
            throw new NoFramesSelectedError();
        }

        const frame = app.selection[0];
        if (!this.isValidArticleComponentFrame(frame)) {
            const { NoTextOrGraphicalFramesSelectedError } = require('./Errors.js');
            throw new NoTextOrGraphicalFramesSelectedError();
        }

        // Add new InDesign Articles.
        const doc = app.activeDocument;
        const articles = this._getInDesignArticles(doc, frame);
        if (articles.length == 0) {
            this._createNewInDesignArticleWithSelectedFrames(doc, articleName);
            alert("A new article '" + articleName + "' has been created, and selected frames have been added.");
            return;
        }

        // Rename existing InDesign Articles.
        for (let articleIndex = 0; articleIndex < articles.length; articleIndex++) {
            const article = articles[articleIndex];
            let newName = article.name;
            let oldName = article.name;

            const storyTypeNames = ["Lead", "Secondary", "Third", "Filler"];
            for (let storyTypeIndex = 0; storyTypeIndex < storyTypeNames.length; storyTypeIndex++) {
                const storyTypeName = storyTypeNames[storyTypeIndex];
                newName = this._replaceTextCaseInsensitive(newName, storyTypeName, articleName);
                newName = this._cleanWhitespaces(newName)
            };
            if (newName != oldName) {
                article.name = newName;
                alert("Article \"" + oldName + "\" has been renamed to \"" + newName + "\"");
            }
        }
    };

    /**
     * Collect articles the provided frame is part of.
     * @param {PageItem} Valid text/graphic frame.
     * @returns {Array<Article>}
     */
    this._getInDesignArticles = function(doc, frame) {
        const docArticles = doc.articles;
        let frameArticles = [];

        // Loop through all articles to check if the frame is a member
        for (let i = 0; i < docArticles.length; i++) {
            const docArticle = docArticles.item(i);

            // Check if the frame is in the article's members
            if (this._isFrameMemberOfInDesignArticle(docArticle, frame)) {
                frameArticles.push(docArticle);
            }
        }
        return frameArticles;
    };

    /**
     * Tell whether a given page item is member of a the given InDesign Article.
     * @param {Article} article - The InDesign article to check.
     * @param {PageItem} frame - The frame to check for membership.
     * @returns {Boolean} - True if the frame is already a member of the article, false otherwise.
     */
    this._isFrameMemberOfInDesignArticle = function(article, frame) {
        const articleMembers = article.articleMembers.everyItem().getElements(); // Get all members as an array
        for (let i = 0; i < articleMembers.length; i++) {
            if (articleMembers[i].itemRef.equals(frame)) {
                return true; // The frame is already a member of the article
            }
        }
        return false; // Frame not found in the article
    };

    /**
     * Create a new InDesign Article with the given name. Add the selected frames to the article.
     * @param {String} articleName
     */
    this._createNewInDesignArticleWithSelectedFrames = function(doc, articleName) {

        // Create a new InDesign Article (even if an article with the same name already exists).
        const article = doc.articles.add();
        article.name = articleName;

        // Add selected frames to the new article.
        for (let i = 0; i < app.selection.length; i++) {
            const frame = app.selection[i];
            if (this.isValidArticleComponentFrame(frame)) {
                try {
                    article.articleMembers.add(frame);
                } catch (error) {
                }
            }
        }
    };

    /**
     * Search for a text fragment (case insensitive) and substitute any found match with a replacement.
     * @param {String} text 
     * @param {String} search 
     * @param {String} replacement 
     * @returns {String} Text with substitutes.
     */
    this._replaceTextCaseInsensitive = function(text, search, replacement) {
        const regex = new RegExp(search, "gi"); // "g" = global, "i" = case insensitive
        return text.replace(regex, replacement);
    };

    /**
     * Remove any leading or trailing whitespaces. Replace multiple inner whitespaces with a single space.
     * @param {String} text 
     * @returns {String} Cleaned text.
     */
    this._cleanWhitespaces = function(text) {
        return text.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
    };

    /**
     * Tells whether the given page item is a valid text frame (to be part of an article).
     * @param {pageItem|null} object
     * @returns {Boolean}
     */
    this.isValidArticleTextFrame = function(pageItem) {
        return pageItem && pageItem.constructorName === "TextFrame" && pageItem.isValid
    };

    /**
     * Tells whether the given page item is a valid graphic frame (to be part of an article).
     * A graphic frame is any SplineItem, except GraphicLine; So only Rectangle, Oval and Polygon.
     * @param {pageItem|null} object
     * @returns {Boolean}
     */
    this.isValidArticleGraphicFrame = function(pageItem) {
        const graphicClasses = ["Rectangle", "Oval", "Polygon"];
        return pageItem && graphicClasses.includes(pageItem.constructorName) && pageItem.isValid;
    };

    /**
     * Tells whether the given page item is a valid text- or graphic frame (to be part of an article).
     * @param {pageItem|null} object
     * @returns {Boolean}
     */
    this.isValidArticleComponentFrame = function(pageItem) {
        return this.isValidArticleTextFrame(pageItem) || this.isValidArticleGraphicFrame(pageItem)
    }
}

module.exports = InDesignArticleService;