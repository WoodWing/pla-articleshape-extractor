//@include "bootstrap.jsx";

app.scriptPreferences.userInteractionLevel = UserInteractionLevels.neverInteract;

// Prompt the user to select the folder for saving the Article Shapes.
var folder = Folder.selectDialog("Select a folder to save the Article Shapes:");
if (!folder) {
    alert("No folder selected. Export cancelled.");
    exit();
}

Container.resolve("RegenerateArticleShapesService").run(folder);

app.scriptPreferences.userInteractionLevel = UserInteractionLevels.interactWithAll;
