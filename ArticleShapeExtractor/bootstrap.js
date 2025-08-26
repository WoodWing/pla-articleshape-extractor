require("./extensions/String.js");
require("./extensions/globals.js");
require("./modules/Errors.mjs");
const Container = require("./modules/Container.mjs");

Container.registerSingleton("Settings", function() {
    const Settings = require("./modules/Settings.mjs");
    const plaDefaultConfig = require("./config/config.js");
    let plaLocalConfig = {}
    try {
        plaLocalConfig = require("./config/config-local.js");
    } catch (error) {
    }
    return new Settings(plaDefaultConfig, plaLocalConfig);
});

Container.registerSingleton("Logger", function() {
    const Logger = require("./modules/Logger.mjs");
    const config = Container.resolve("Settings").getLoggerConfig();
    try {
        return new Logger(config.folder, config.filename, config.level, config.wipe);
    } catch(error) {
        throw new Error(error + " Please check your settings in config/config.js and config/config-local.js files.");
    }
});

Container.registerSingleton("VersionUtils", function() {
    const VersionUtils = require("./modules/VersionUtils.mjs");
    return new VersionUtils();
});

Container.registerSingleton("PathMatcher", function() {
    const VersionUtils = require("./modules/PathMatcher.js");
    return new VersionUtils();
});

// Assure this script is running on a compatible InDesign version.
function validateHost() {
    const logger = Container.resolve("Logger");
    try {
        const versionUtils = Container.resolve("VersionUtils");
        const minRequiredVersion = Container.resolve("Settings").getMinimumRequiredInDesignVersion();
        const host = require('uxp').host;
        const os = require('os');
        logger.info(`Started log for host ${host.name} v${host.version} (${host.uiLocale}) `
            + `running on OS ${os.platform()}/${os.arch()} v${os.release()}`);
        if (versionUtils.versionCompare(host.version, minRequiredVersion) < 0) {
            throw new Error(`InDesign ${host.version} is not supported. `
                +`Minimum required version is ${minRequiredVersion}.`);
        }
    } catch(error) { // This may happen when debugging with the Adobe UXP Developer Tool.
        logger.error(error.toString());
    }
};

Container.registerFactory("InDesignArticleService", function() {
    const InDesignArticleService = require("./modules/InDesignArticleService.mjs");
    return new InDesignArticleService();
});

Container.registerFactory("FileUtils", function() {
    const FileUtils = require("./modules/FileUtils.mjs");
    return new FileUtils();
});

Container.registerFactory("PageLayoutSettings", function() {
    const PageLayoutSettings = require("./modules/PageLayoutSettings.mjs");
    return new PageLayoutSettings(
        Container.resolve("Logger"),
        Container.resolve("FileUtils"),
    );
});

Container.registerFactory("ExportInDesignArticlesToFolder", function() {
    const ExportInDesignArticlesToFolder = require("./modules/ExportInDesignArticlesToFolder.mjs");
    const settings = Container.resolve("Settings");
    return new ExportInDesignArticlesToFolder(
        Container.resolve("Logger"), 
        Container.resolve("InDesignArticleService"), 
        Container.resolve("PageLayoutSettings"), 
        Container.resolve("PathMatcher"), 
        settings.getParagraphsToGenres(),
        settings.getOfflineFallbackConfig().brand,
        settings.getOfflineFallbackConfig().category,
    );
});

Container.registerFactory("StudioJsonRpcClient", function() {
    const { app } = require("indesign");
    const StudioJsonRpcClient = require("./modules/StudioJsonRpcClient.mjs");
    return new StudioJsonRpcClient(
        Container.resolve("Logger"),
        Container.resolve("Settings").getLogNetworkTraffic(),
        app.entSession?.activeUrl, 
        app.entSession?.activeTicket,
    );
});

Container.registerFactory("RegenerateArticleShapesService", function() {
    const RegenerateArticleShapesService = require("./modules/RegenerateArticleShapesService.mjs");
    return new RegenerateArticleShapesService(
        Container.resolve("Logger"), 
        Container.resolve("VersionUtils"),
        Container.resolve("Settings").getRegenerateArticleShapesSettings(),
        Container.resolve("ExportInDesignArticlesToFolder"),
        Container.resolve("StudioJsonRpcClient"),
    );
});

Container.registerFactory("BrandSectionMapResolver", function() {
    const BrandSectionMapResolver = require("./modules/BrandSectionMapResolver.mjs");
    return new BrandSectionMapResolver(
        Container.resolve("Logger"),
        Container.resolve("StudioJsonRpcClient"),
        Container.resolve("FileUtils"),
    );
});

function initBootstrap() {
    validateHost();
}

module.exports = initBootstrap;