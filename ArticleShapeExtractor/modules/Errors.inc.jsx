var errorFactory = Container.resolve("ErrorFactory");
ArgumentError = errorFactory.make("ArgumentError", "Bad argument provided.");
ConfigurationError = errorFactory.make("ConfigurationError", "Valid configuration.");

NoDocumentOpenedError = errorFactory.make("NoDocumentOpenedError", "No document opened.");
NoFramesSelectedError = errorFactory.make("NoFramesSelectedError", "No frames selected.");
NoTextOrGraphicalFramesSelectedError = errorFactory.make("NoTextOrGraphicalFramesSelectedError", "No text/graphical frame selected.");
NoArticlesInDocumentError = errorFactory.make("NoArticlesInDocumentError", "No articles found in the document.");

NoFolderSelectedError = errorFactory.make("NoFolderSelectedError", "No folder selected.");
PrintLayoutAutomationError = errorFactory.make("PrintLayoutAutomationError");
