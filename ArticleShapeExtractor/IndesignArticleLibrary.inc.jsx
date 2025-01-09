/**
 * Creates a new InDesign article with the given name and adds the selected frames to it.
 * @param {String} articleName - The name of the article to create.
 */
function createNewArticleWithSelectedFrames(articleName) {
    if (app.documents.length === 0) {
        alert("No document is open.");
        return;
    }

    var doc = app.activeDocument;

    // Ensure that at least one item is selected
    if (app.selection.length === 0) {
        alert("Please select one or more frames to add to the article.");
        return;
    }

    // Create a new article (even if an article with the same name already exists)
    var article = doc.articles.add();
    article.name = articleName;

    // Add selected frames to the new article
    for (var i = 0; i < app.selection.length; i++) {
        var item = app.selection[i];

        // Ensure that the selected item is a valid frame (TextFrame, GraphicFrame, or Rectangle)
        if (item instanceof TextFrame || item instanceof Rectangle || item instanceof Oval || item instanceof Polygon) {
            article.articleMembers.add(item);
        }
    }

    alert("A new article '" + articleName + "' has been created, and selected frames have been added.");
}