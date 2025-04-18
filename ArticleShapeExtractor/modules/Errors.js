class ArgumentError extends Error {
    constructor(argument) {
        super(`Bad argument '${argument}' provided.`);
        this.name = this.constructor.name;
    }
}
globalThis.ArgumentError = ArgumentError;

class ConfigurationError extends Error {
    constructor(message) {
        super(`Invalid configuration. ${message}`);
        this.name = this.constructor.name;
    }
}
globalThis.ConfigurationError = ConfigurationError;

class NoStudioSessionError extends Error {
    constructor() {
        super("Not logged in to WoodWing Studio.");
        this.name = this.constructor.name;
    }
}
globalThis.NoStudioSessionError = NoStudioSessionError;

class NoDocumentOpenedError extends Error {
    constructor() {
        super("No document opened.");
        this.name = this.constructor.name;
    }
}
globalThis.NoDocumentOpenedError = NoDocumentOpenedError;

class NoFramesSelectedError extends Error {
    constructor() {
        super("No frames selected.");
        this.name = this.constructor.name;
    }
}
globalThis.NoFramesSelectedError = NoFramesSelectedError;

class NoTextOrGraphicalFramesSelectedError extends Error {
    constructor() {
        super("No text/graphical frame selected.");
        this.name = this.constructor.name;
    }
}
globalThis.NoTextOrGraphicalFramesSelectedError = NoTextOrGraphicalFramesSelectedError;

class NoArticlesInDocumentError extends Error {
    constructor() {
        super("No articles found in the document.");
        this.name = this.constructor.name;
    }
}
globalThis.NoArticlesInDocumentError = NoArticlesInDocumentError;

class NoFolderSelectedError extends Error {
    constructor() {
        super("No folder selected.");
        this.name = this.constructor.name;
    }
}
globalThis.NoFolderSelectedError = NoFolderSelectedError;

class PrintLayoutAutomationError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}
globalThis.PrintLayoutAutomationError = PrintLayoutAutomationError;