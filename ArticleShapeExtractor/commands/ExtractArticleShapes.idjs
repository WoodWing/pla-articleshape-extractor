await (async function main() {
    const { app } = require("indesign");
    try {
        require('../bootstrap.js');

        if (app.documents.length === 0) {
            throw new NoDocumentOpenedError();
        }

        var doc = app.activeDocument;
        if (doc.articles.length === 0) {
            throw new NoArticlesInDocumentError();
        }

        // Prompt the user to select the folder for saving the snippets.
        alert("Select a folder to save the Article Shapes.");
        const lfs = require('uxp').storage.localFileSystem;
        const domains = require('uxp').storage.domains;
        const folder = await lfs.getFolder({initialDomain: domains.userDocuments});
        if (!folder || !folder.isFolder) {
            throw new NoFolderSelectedError();
        }

        const Container = require("../modules/Container.js");
        var exportCounter = Container.resolve("ExportInDesignArticlesToPlaService").run(doc, folder);
        if (exportCounter === 0) {
            throw new PrintLayoutAutomationError("No articles exported. Check if articles are properly named and have frames defined.");
        }
        alert(exportCounter + " articles have been exported as Article Shapes.");
    } catch(error) {
        error.alert();
    } finally {

    }
})();