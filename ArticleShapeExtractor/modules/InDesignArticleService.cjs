const ind = require("indesign");
const Errors = require("../modules/Errors.cjs");

/**
 * A *ValidArticleFrame* is a page item that can be part of an InDesign Article.
 * The page item is valid and can be either a text frame or a graphic frame.
 *
 * For frames part of a threaded text story, this always refers to the **first** TextFrame.
 * Succeeding frames of type TextFrame in the thread are *not* considered valid article frames.
 * When the first frame in the thread is of type TextPath, the next TextFrame in the thread is used.
 *
 * Graphic frames and non-threaded text frames (of type TextFrame) are used as-is.
 *
 * @typedef {IND.TextFrame} ValidArticleFrame
 */

class InDesignArticleService {

    /**
     * Create a new InDesign Article for the currently selected frames. Or, when the frames are
     * already member of existing articles, rename the articles instead.
     *
     * For the provided article name, pass in the story type (Lead, Secondary, Third or Filler).
     * This name will be applied to new articles. For existing articles, it replaces previously
     * set story type (in the existing article names) with the new/provided story type.
     *
     * @param {string} articleName
     */
    addOrRenameInDesignArticle (articleName) {

        // Add new InDesign Articles.
        const doc = this.getActiveDocument();
        const articleFrames = this.getSelectedArticleFrames(doc);
        if (articleFrames.length === 0) {
            throw new Errors.NoTextOrGraphicalFramesSelectedError();
        }
        const articles = this.getInDesignArticlesForArticleFrames(doc, articleFrames);
        if (articles.length == 0) {
            this.#createNewInDesignArticleWithArticleFrames(doc, articleName, articleFrames);
            alert("A new article '" + articleName + "' has been created, and selected frames have been added.");
            return;
        }

        // Rename existing InDesign Articles.
        for (let articleIndex = 0; articleIndex < articles.length; articleIndex++) {
            const article = articles[articleIndex];
            let newName = article.name;
            let oldName = article.name;
            const storyTypeNames = ["Lead", "Secondary", "Third", "Filler"];

            // Rename article that was previously tagged with a story type
            for (let storyTypeIndex = 0; storyTypeIndex < storyTypeNames.length; storyTypeIndex++) {
                const storyTypeName = storyTypeNames[storyTypeIndex];
                newName = this.#replaceTextCaseInsensitive(newName, storyTypeName, articleName);
            };

            // Rename article when it does NOT contain any of the story types.
            if (!this.#containsCaseInsensitive(newName, storyTypeNames)) {
                newName = articleName + " " + newName;
            }

            newName = this.#cleanWhitespaces(newName);

            if (newName != oldName) {
                article.name = newName;
                alert("Article \"" + oldName + "\" has been renamed to \"" + newName + "\"");
            }
        }
    }

    /**
     * @param {IND.Document} doc
     * @returns {Object[]} The currently selected objects in the active document.
     */
    #getSelectedObjects (doc) {
        const selection = /** @type {Object[]} */(doc.selection);
        if (selection.length === 0) {
            throw new Errors.NoFramesSelectedError();
        }
        return selection;
    }

    /**
     * @returns {IND.Document} The top most document in InDesign.
     */
    getActiveDocument () {
        if (ind.app.documents.length === 0) {
            throw new Errors.NoDocumentOpenedError();
        }
        return ind.app.activeDocument;
    }

    /**
     * @param {string} stringValue
     * @param {string[]} listOfStringValues
     * @returns
     */
    #containsCaseInsensitive (stringValue, listOfStringValues) {
        for (let storyTypeIndex = 0; storyTypeIndex < listOfStringValues.length; storyTypeIndex++) {
            if (stringValue.toLowerCase().includes (listOfStringValues[storyTypeIndex].toLowerCase())) {
                return true;
            }
        }
        return false;
    }

    /**
     * Collect articles the provided frame is part of.
     * @param {IND.Document} doc
     * @param {ValidArticleFrame[]} articleFrames
     * @returns {IND.Article[]}
     */
    getInDesignArticlesForArticleFrames (doc, articleFrames) {
        const docArticles = doc.articles;
        let foundArticles = [];

        // Loop through all articles to check if the frame is a member
        for (let i = 0; i < docArticles.length; i++) {
            const docArticle = docArticles.item(i);
            for (let j = 0; j < articleFrames.length; j++) {
                const articleFrame = articleFrames[j];
                // Check if the frame is in the article's members
                if (this.#isArticleFrameMemberOfInDesignArticle(docArticle, articleFrame)) {
                    foundArticles.push(docArticle);
                    break; // take next article (prevent duplicates)
                }
            }
        }
        return foundArticles;
    }

    /**
     * Tell whether a given page item is member of a the given InDesign Article.
     * @param {IND.Article} article - The InDesign article to check.
     * @param {ValidArticleFrame} articleFrame - The frame to check for membership.
     * @returns {boolean} - True if the frame is already a member of the article, false otherwise.
     */
    #isArticleFrameMemberOfInDesignArticle (article, articleFrame) {
        const articleMembers = /** @type {IND.ArticleMember} */
            (/** @type {unknown} */(article.articleMembers.everyItem()));
        const elements = articleMembers.getElements();
        for (let i = 0; i < elements.length; i++) {
            if (elements[i].itemRef.equals(articleFrame)) {
                return true; // The frame is already a member of the article
            }
        }
        return false; // Frame not found in the article
    }

    /**
     * Create a new InDesign Article with the given name. Add the frames to the article.
     * @param {IND.Document} doc
     * @param {ValidArticleFrame[]} articleFrames
     * @param {string} articleName
     */
    #createNewInDesignArticleWithArticleFrames (doc, articleName, articleFrames) {

        // Create a new InDesign Article (even if an article with the same name already exists).
        const article = doc.articles.add();
        article.name = articleName;

        // Add selected frames to the new article.
        for (let i = 0; i < articleFrames.length; i++) {
            try {
                article.articleMembers.add(articleFrames[i]);
            }
            catch {
                // Intentionally ignored
            }
        }
    }

    /**
     * Filter the provided page items and return only unique and valid article text/graphic frames.
     * When a text frame is part of a text thread, only the first text frame in the thread is returned.
     * @param {IND.Document} doc
     * @returns {ValidArticleFrame[]}
     */
    getSelectedArticleFrames (doc) {

        /** @type {Map<number, IND.PageItem>} */
        const uniqueFrames = new Map();
        const selectedObjects = this.#getSelectedObjects(doc);

        for (let i = 0; i < selectedObjects.length; i++) {
            const pageItem = selectedObjects[i];
            let frameToAdd = null;
            if (this.isValidTextFrame(pageItem)) {
                frameToAdd = this.#getFirstTextFrameInThread(
                    /** @type {IND.PageItem} */ (pageItem),
                );
            }
            else if (this.isValidGraphicFrame(pageItem)) {
                frameToAdd = /** @type {IND.PageItem} */ (pageItem);
            }
            if (frameToAdd && !uniqueFrames.has(frameToAdd.id)) {
                uniqueFrames.set(frameToAdd.id, frameToAdd);
            }
        }
        return Array.from(uniqueFrames.values());
    }

    /**
     * Search for a text fragment (case insensitive) and substitute any found match with a replacement.
     * @param {string} text
     * @param {string} search
     * @param {string} replacement
     * @returns {string} Text with substitutes.
     */
    #replaceTextCaseInsensitive (text, search, replacement) {
        const regex = new RegExp(search, "gi"); // "g" = global, "i" = case insensitive
        return text.replace(regex, replacement);
    }

    /**
     * Remove any leading or trailing whitespaces. Replace multiple inner whitespaces with a single space.
     * @param {string} text
     * @returns {string} Cleaned text.
     */
    #cleanWhitespaces (text) {
        return text.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
    }

    /**
     * Tells whether the given page item is a valid frame and has any of the provided frame types.
     * @param {IND.PageItem|null} pageItem
     * @param {string[]} frameTypes
     * @returns {boolean}
     */
    #isValidFrameOfType (pageItem, frameTypes) {
        return pageItem
            && pageItem.isValid
            && frameTypes.includes(pageItem.constructorName);
    };

    /**
     * Tells whether the given page item is a valid text frame (to be part of an article).
     * @param {IND.PageItem|null} pageItem
     * @returns {pageItem is ValidArticleFrame}
     */
    isValidTextFrame (pageItem) {
        if (!this.#isValidFrameOfType(pageItem, ["TextFrame"])) {
            return false;
        }
        const textFrame = /** @type {IND.TextFrame} */(pageItem);
        return textFrame.contentType.toString() === ind.ContentType.TEXT_TYPE.toString();
    }

    /**
     * Tells whether the given page item is a valid graphic frame (to be part of an article).
     * @param {IND.PageItem|null} pageItem
     * @returns {pageItem is IND.Oval | IND.Polygon | IND.Rectangle | IND.GraphicLine}
     */
    isValidGraphicFrame (pageItem) {
        //Note: In the future we might want to extend with idd.ContentType.GRAPHIC_TYPE.toString()
        // check just like text frames however the side-effects are unclear
        return this.#isValidFrameOfType(pageItem, ["Oval", "Polygon", "Rectangle", "GraphicLine"]);
    }

    /**
     * Tells whether the given page item is a Rectangle graphic frame, but very slim, hence
     * should be interpreted as a work-around of the layouter to compose a line (GraphicLine).
     * @param {IND.PageItem|null} pageItem
     * @returns {pageItem is IND.Rectangle}
     */
    #isValid1DRectangleFrame (pageItem) {
        //Note: In the future we might want to extend with idd.ContentType.GRAPHIC_TYPE.toString()
        // check just like text frames however the side-effects are unclear
        if (!this.#isValidFrameOfType(pageItem, ["Rectangle"])) {
            return false;
        }
        const width = Number(pageItem.geometricBounds[3]) - Number(pageItem.geometricBounds[1]);
        const height = Number(pageItem.geometricBounds[2]) - Number(pageItem.geometricBounds[0]);
        const isVerySimilarToGraphicLine = height <= 10 || width <= 10;
        return isVerySimilarToGraphicLine;
    }

    /**
     * Tells whether the given page item is a valid 1 dimensional graphic frame.
     * This is either a frame of type GraphicLine or a very slim Rectangle.
     * These frames are included in "article definition" files (IDMS) but they
     * are excluded from "article composition" (JSON) files.
     * @param {IND.PageItem|null} pageItem
     * @returns {pageItem is IND.GraphicLine}
     */
    isValid1DGraphicFrame (pageItem) {
        //Note: In the future we might want to extend with idd.ContentType.GRAPHIC_TYPE.toString()
        // check just like text frames however the side-effects are unclear
        return this.#isValidFrameOfType(pageItem, ["GraphicLine"])
            || this.#isValid1DRectangleFrame(pageItem);
    }

    /**
     * Tells whether the given page item is a valid 2 dimensional graphic frame.
     * This includes Oval and Polygon frames, and Rectangle frames when not too slim.
     * This excludes TextFrame, GraphicLine and very slim Rectangle frames.
     * @param {IND.PageItem|null} pageItem
     * @returns {pageItem is IND.Oval | IND.Polygon}
     */
    isValid2DGraphicFrame (pageItem) {
        //Note: In the future we might want to extend with idd.ContentType.GRAPHIC_TYPE.toString()
        // check just like text frames however the side-effects are unclear
        if (this.#isValidFrameOfType(pageItem, ["Oval", "Polygon"])) {
            return true;
        }
        return this.#isValidFrameOfType(pageItem, ["Rectangle"])
            && !this.#isValid1DRectangleFrame(pageItem);
    }

    /**
     * Tells whether the given page item is an unassigned frame (InDesign->Object->Content)
     * @param {IND.PageItem|null} pageItem
     * @returns {boolean}
     */
    isUnassignedFrame (pageItem) {
        return pageItem
            && pageItem.isValid
            && pageItem.contentType.toString() === ind.ContentType.UNASSIGNED.toString();
    }

    /**
     * Tells whether the given page item is a valid text- or graphic frame to be part
     * of an "article definition" file (IDMS), also called InDesign Snippet.
     * @param {IND.PageItem|null} pageItem
     * @returns {pageItem is IND.TextFrame | IND.Oval | IND.Polygon | IND.Rectangle | IND.GraphicLine}
     */
    isValidArticleComponentFrame (pageItem) {
        return this.isValidTextFrame(pageItem)
            || this.isValidGraphicFrame(pageItem);
    }

    /**
     * Get all threaded text frames for a given text frame.
     * @param {IND.TextFrame} textFrame Any text frame within the thread.
     * @returns {ValidArticleFrame[]} All text frames in the thread, including the provided frame.
     */
    getThreadedFrames (textFrame) {
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
     * @param {IND.TextFrame | IND.TextPath | IND.NothingEnum} threadedSibling
     * @returns {threadedSibling is IND.TextFrame}
     */
    #isThreadedSiblingValidTextFrame (threadedSibling) {
        if (!threadedSibling || threadedSibling.constructorName !== "TextFrame") {
            return false;
        }
        const textFrame = /** @type {TextFrame} */(threadedSibling);
        return this.isValidTextFrame(textFrame);
    }

    /**
     * Return the first TextFrame in the text thread.
     * Skips any TextPath in the thread.
     *
     * @param {IND.TextFrame} textFrame
     * @returns {ValidArticleFrame}
     */
    #getFirstTextFrameInThread (textFrame) {
        let firsTextFrame = textFrame.startTextFrame; // May be TextFrame or TextPath.
        while (firsTextFrame && !firsTextFrame.equals(ind.NothingEnum.NOTHING)) {
            if (this.#isThreadedSiblingValidTextFrame (firsTextFrame)) {
                return firsTextFrame;
            }
            firsTextFrame = firsTextFrame.nextTextFrame;
        }
        return textFrame; // Should never reach here.
    }
}

module.exports = InDesignArticleService;
