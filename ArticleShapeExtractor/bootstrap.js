require("./extensions/String.js");
require("./extensions/globals.js");
require("./modules/Errors.js");
const Container = require("./modules/Container.js");

Container.registerSingleton("Settings", function() {
    const Settings = require("./modules/Settings.js");
    const plaDefaultConfig = require("./config/config.js");
    let plaLocalConfig = {}
    try {
        plaLocalConfig = require("./config/config-local.js");
    } catch (error) {
    }
    return new Settings(plaDefaultConfig, plaLocalConfig);
});

Container.registerSingleton("Logger", function() {
    const Logger = require("./modules/Logger.js");
    const config = Container.resolve("Settings").getLoggerConfig();
    try {
        return new Logger(config.folder, config.filename, config.level, config.wipe);
    } catch(error) {
        throw new Error(error + " Please check your settings in config/config.js and config/config-local.js files.");
    }
});

Container.registerSingleton("VersionUtils", function() {
    const VersionUtils = require("./modules/VersionUtils.js");
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
    const InDesignArticleService = require("./modules/InDesignArticleService.js");
    return new InDesignArticleService();
});

Container.registerFactory("PageLayoutSettings", function() {
    const PageLayoutSettings = require("./modules/PageLayoutSettings.js");
    return new PageLayoutSettings(Container.resolve("Logger"));
});

Container.registerFactory("ExportInDesignArticlesToFolder", function() {
    const ExportInDesignArticlesToFolder = require("./modules/ExportInDesignArticlesToFolder.js");
    const settings = Container.resolve("Settings");
    return new ExportInDesignArticlesToFolder(
        Container.resolve("Logger"), 
        Container.resolve("InDesignArticleService"), 
        Container.resolve("PageLayoutSettings"), 
        settings.getOfflineFallbackConfig().brand,
        settings.getOfflineFallbackConfig().category,
    );
});

Container.registerFactory("RegenerateArticleShapesService", function() {
    const RegenerateArticleShapesService = require("./modules/RegenerateArticleShapesService.js");
    return new RegenerateArticleShapesService(
        Container.resolve("Logger"), 
        Container.resolve("VersionUtils"),
        Container.resolve("Settings").getRegenerateArticleShapesQueryName(),
        Container.resolve("ExportInDesignArticlesToFolder"),
        Container.resolve("Settings").getLogNetworkTraffic(),
    );
});

Container.registerFactory("BrandSectionMapResolver", function() {
    const BrandSectionMapResolver = require("./modules/BrandSectionMapResolver.js");
    return new BrandSectionMapResolver(Container.resolve("Logger"));
});

function initBootstrap() {
    validateHost();
}

module.exports = initBootstrap;