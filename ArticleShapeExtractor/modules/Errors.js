class ArgumentError extends Error {
    constructor(argument) {
        super(`Bad argument '${argument}' provided.`);
        this.name = this.constructor.name;
    }
}
class ConfigurationError extends Error {
    constructor(message) {
        super(`Invalid configuration. ${message}`);
        this.name = this.constructor.name;
    }
}
class NoStudioSessionError extends Error {
    constructor() {
        super("Not logged in to WoodWing Studio.");
        this.name = this.constructor.name;
    }
}
class NoDocumentOpenedError extends Error {
    constructor() {
        super("No document opened.");
        this.name = this.constructor.name;
    }
}
class NoFramesSelectedError extends Error {
    constructor() {
        super("No frames selected.");
        this.name = this.constructor.name;
    }
}
class NoTextOrGraphicalFramesSelectedError extends Error {
    constructor() {
        super("No text/graphical frame selected.");
        this.name = this.constructor.name;
    }
}
class NoArticlesInDocumentError extends Error {
    constructor() {
        super("No articles found in the document.");
        this.name = this.constructor.name;
    }
}
class NoFolderSelectedError extends Error {
    constructor() {
        super("No folder selected.");
        this.name = this.constructor.name;
    }
}
class PrintLayoutAutomationError extends Error {
    constructor() {
        super(message);
        this.name = this.constructor.name;
    }
}