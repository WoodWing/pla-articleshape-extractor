RegenerateArticleShapes = function() {
    this.run = async function() {
        require('./bootstrap.jsx');

        app.scriptPreferences.userInteractionLevel = UserInteractionLevels.neverInteract;
        
        try {
            // Prompt the user to select the folder for saving the Article Shapes.
            var folder = Folder.selectDialog("Select a folder to save the Article Shapes:");
            if (!folder) {
                throw new NoFolderSelectedError(null, $.fileName, $.line);
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