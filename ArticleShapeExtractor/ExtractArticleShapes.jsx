//@include "bootstrap.jsx";

var doc = app.activeDocument;
if (doc.articles.length === 0) {
    alert("No articles found in the document.");
    exit();
}

// Prompt the user to select the folder for saving the snippets.
var folder = Folder.selectDialog("Select a folder to save the Article Shapes:");
if (!folder) {
    alert("No folder selected. Export cancelled.");
    exit();
}

var exportCounter = Container.resolve("ExportInDesignArticlesToPlaService").run(doc, folder);
if (exportCounter === 0) {
    alert("No articles exported. Check if articles are properly named and have frames defined.");
    exit();
}
alert(exportCounter + " articles have been exported as Article Shapes.");
