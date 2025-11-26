// DO NOT CHANGE THIS FILE! See README.md for instructions.

export const uploaderDefaultConfig = {
    // Connection URL to the PLA service.
    plaServiceUrl: "https://service.aila.woodwing.cloud",

    // Whether to log HTTP communication details (of the PLA service and S3) to the console.
    // To enable this feature is it require to set logLevel to "DEBUG".
    logNetworkTraffic: false,

    // Supported values: "DISABLED", "CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"
    logLevel: 'WARNING',

    //Optional enforce using the page-layout-settings from the AILA backend and disable the
    //validation against the local settings in _manifest/page-layout-settings.json 
    enforceServerSidePageLayoutSettings: false
}
