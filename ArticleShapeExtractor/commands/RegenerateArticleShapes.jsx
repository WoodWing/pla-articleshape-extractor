RegenerateArticleShapes = function() {
    this.run = async function() {
        require('../bootstrap.jsx');
        const { app } = require("indesign");
        const idd = require("indesign");
        try {
            // Prompt the user to select the folder for saving the Article Shapes.
            alert("Select a folder to save the Article Shapes.");
            const fs = require('uxp').storage.localFileSystem;
            const domains = require('uxp').storage.domains;
            const folder = await fs.getFolder({initialDomain: domains.userDocuments});
            if (!folder || !folder.isFolder) {
                throw new NoFolderSelectedError();
            }    
        
            const Container = require("../modules/Container.inc.jsx");
            app.scriptPreferences.userInteractionLevel = idd.UserInteractionLevels.neverInteract;
            Container.resolve("RegenerateArticleShapesService").run(folder);
            app.scriptPreferences.userInteractionLevel = idd.UserInteractionLevels.interactWithAll;
        } catch(error) {
            // First enable the user interaction again to able to show the alert.
            app.scriptPreferences.userInteractionLevel = idd.UserInteractionLevels.interactWithAll;
            error.alert();
        }
    };
}
module.exports = RegenerateArticleShapes;