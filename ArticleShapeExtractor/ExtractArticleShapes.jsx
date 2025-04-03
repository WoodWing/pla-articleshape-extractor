//@include "bootstrap.jsx";

try {
    if (app.documents.length === 0) {
        throw new NoDocumentOpenedError(null, $.fileName, $.line);
    }

    var doc = app.activeDocument;
    if (doc.articles.length === 0) {
        throw new NoArticlesInDocumentError(null, $.fileName, $.line);
    }

    // Prompt the user to select the folder for saving the snippets.
    var folder = Folder.selectDialog("Select a folder to save the Article Shapes:");
    if (!folder) {
        throw new PrintLayoutAutomationError("No folder selected. Export cancelled.", $.fileName, $.line);
    }

    var exportCounter = Container.resolve("ExportInDesignArticlesToPlaService").run(doc, folder);
    if (exportCounter === 0) {
        throw new PrintLayoutAutomationError("No articles exported. Check if articles are properly named and have frames defined.", $.fileName, $.line);
    }
    alert(exportCounter + " articles have been exported as Article Shapes.");
} catch(error) {
    error.alert();
}