require("./extensions/String.js");
require("./extensions/globals.js");
const Container = require("./modules/Container.js");

function loadLocalConfigFile() {
    const fs = require("fs");
    var localConfig = {};
    try {
        const configPath = "plugin-data:/config-local.json";
        const configJson = fs.readFileSync(configPath, { encoding: "utf-8" }); 
        localConfig = JSON.parse(configJson);       
    } catch (error) {
    }
    return localConfig;
}

Container.registerSingleton("Settings", function() {
    const Settings = require("./modules/Settings.js");
    require("./config/config.js");
    const localConfig = loadLocalConfigFile();
    return new Settings(globalThis.plaDefaultConfig, localConfig);
});

Container.registerSingleton("Logger", function() {
    const Logger = require("./modules/Logger.js");
    const config = Container.resolve("Settings").getLoggerConfig();
    var logger = new Logger(config.folder, config.filename, config.level, config.wipe);
    logger.init();
    return logger;
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
