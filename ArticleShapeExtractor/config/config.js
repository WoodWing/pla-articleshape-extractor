// DO NOT CHANGE THIS FILE! See README.md for instructions.

const plaDefaultConfig = {
    
    // Settings for the Regenerate Article Shapes process.
    regenerateArticleShapesSettings: {

        // Search parameters in Studio Server that returns layouts to be processed.
        filter: {
            brand: "", // name of the brand/publication
            issue: "", // name of the issue (leave empty for all issues)
            category: "", // name of the category/section
            status: "", // name of the layout status
        },

        // Name of layout status, to be set after processing:
        layoutStatusOnSuccess: "", // when processed OK
        layoutStatusOnError: "", // when process failed
    },

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
        level: "DISABLED", // Supported values: "DISABLED", "CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"
        filename: "pla.log",
        folder: "", // Directory where to create the log file.
        wipe: true, // Whether to clean the log file before starting a new operation.
        logNetworkTraffic: false, // Log all HTTP requests/responses. Requires "DEBUG" level.
    },    

    // Error on attempts running scripts on older InDesign versions that are not compatible.
    minimumRequiredInDesignVersion: "19.0.0",
};

module.exports = plaDefaultConfig;