//@include "ExtractArticleShapesLibrary.inc.jsx";

// Prompt the user to select the folder for saving the snippets
var folder = Folder.selectDialog("Select a folder to save the ArticleShapes:");
if (folder) {
    var exportCounter = exportArticlesAsSnippets(folder);

    alert(exportCounter + " articles have been exported as ArticleShapes.");
}
else {
    alert("No folder selected. Export cancelled.");
}