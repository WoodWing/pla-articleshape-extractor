RegenerateArticleShapes = function() {
    this.run = async function() {
        require('./bootstrap.jsx');

        app.scriptPreferences.userInteractionLevel = UserInteractionLevels.neverInteract;
        
        const { app } = require("indesign");
        try {
            // Prompt the user to select the folder for saving the Article Shapes.
            alert("Select a folder to save the Article Shapes.");
            const fs = require('uxp').storage.localFileSystem;
            const domains = require('uxp').storage.domains;
            const folder = await fs.getFolder({initialDomain: domains.userDocuments});
            if (!folder || !folder.isFolder) {
                throw new NoFolderSelectedError();
            }    
        
            const Container = require("./modules/Container.inc.jsx");
            Container.resolve("RegenerateArticleShapesService").run(folder);
        } catch(error) {
            error.alert();
        }
        
        app.scriptPreferences.userInteractionLevel = UserInteractionLevels.interactWithAll;
    };
}
module.exports = RegenerateArticleShapes;