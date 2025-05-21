// DO NOT CHANGE THIS FILE! See README.md for instructions.

export const uploaderDefaultConfig = {
    // Connection URL to the PLA service.
    plaServiceUrl: "https://service.pla-poc.woodwing.cloud",

    // For PLA a layout page has a simple grid of rows and columns. Use whole numbers only.
    grid: {
        columnCount: 5,
        rowCount: 8
    },

    // Whether to log HTTP communication details (of the PLA service and S3) to the console.
    // To enable this feature is it require to set logLevel to "DEBUG".
    logNetworkTraffic: false,

    // Supported values: "DISABLED", "CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"
    logLevel: 'INFO',
}
