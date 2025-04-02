// DO NOT CHANGE THIS FILE! See README.md for instructions.

$.global.plaDefaultConfig = {
    
    // URL of the PLA service.
    plaServiceUrl: "https://service.pla-poc.woodwing.cloud",

    // User Query in Studio Server that returns layouts to automatically extract article shapes from.
    regenerateArticleShapesQueryName: "RegenerateArticleShapes",

    // Settings used if the layout is not stored in Studio.
    offlineFallback: {
        brand: {
            id: "1",
            name: "WW News",
        },
        category: {
            id: "1",
            name: "News",
        },
    },

    // A log file can be created in a certain log folder.
    // The level tells the minimum severity of messages to include.
    logger: {
        level: "ERROR", // Supported values: "DISABLED", "CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"
        filename: "pla.log",
        folder: Folder.desktop, // Directory where to create the log file.
        wipe: true, // Whether to clean the log file before starting a new operation.
    },
};