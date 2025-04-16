require("./extensions/String.js");
require("./extensions/globals.js");
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
        var logger = new Logger(config.folder, config.filename, config.level, config.wipe);    
        return logger;
    } catch(error) {
        throw new Error(error + " Please check your settings in config/config.js and config/config-local.js files.");
    }
});

Container.registerSingleton("ErrorFactory", function() {
    const ErrorFactory = require("./modules/ErrorFactory.js");
    return new ErrorFactory(
        Container.resolve("Logger"),
        Container.resolve("Settings").getIncludeErrorDetailInAlerts(),
    );
});
// Late initialize custom errors (once after ErrorFactory is registered).
function delayedRequireErrorsModule() {
    require("./modules/Errors.js");
}
delayedRequireErrorsModule();

// Assure this script is running on a compatible InDesign version.
(function validateHost() {
    const logger = Container.resolve("Logger");
    const minRequiredVersion = Container.resolve("Settings").getMinimumRequiredInDesignVersion();
    const host = require('uxp').host;
    const os = require('os');
    logger.info(`Started log for host ${host.name} v${host.version} (${host.uiLocale}) `
        + `running on OS ${os.platform()}/${os.arch()} v${os.release()}`);
    if (versionCompare(host.version, minRequiredVersion) < 0) {
        throw new Error(`InDesign ${host.version} is not supported. `
            +`Minimum required version is ${minRequiredVersion}.`);
    }
})();

Container.registerSingleton("ArticleShapeGateway", function() {
    const ArticleShapeGateway = require("./modules/ArticleShapeGateway.js");
    return new ArticleShapeGateway(
        Container.resolve("Settings").getPlaServiceUrl(),
    );
});

Container.registerFactory("InDesignArticleService", function() {
    const InDesignArticleService = require("./modules/InDesignArticleService.js");
    return new InDesignArticleService();
});

Container.registerFactory("ExportInDesignArticlesToPlaService", function() {
    const ExportInDesignArticlesToPlaService = require("./modules/ExportInDesignArticlesToPlaService.js");
    const settings = Container.resolve("Settings");
    return new ExportInDesignArticlesToPlaService(
        Container.resolve("Logger"), 
        Container.resolve("InDesignArticleService"), 
        Container.resolve("ArticleShapeGateway"), 
        settings.getOfflineFallbackConfig().brand,
        settings.getOfflineFallbackConfig().category,
    );
});

Container.registerFactory("RegenerateArticleShapesService", function() {
    const RegenerateArticleShapesService = require("./modules/RegenerateArticleShapesService.js");
    return new RegenerateArticleShapesService(
        Container.resolve("Settings").getRegenerateArticleShapesQueryName(),
        Container.resolve("ExportInDesignArticlesToPlaService"),
    );
});
