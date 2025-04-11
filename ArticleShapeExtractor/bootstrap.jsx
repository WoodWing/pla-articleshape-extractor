require("./extensions/String.js");
require("./extensions/globals.js");
const Container = require("./modules/Container.inc.jsx");

//@include "config/config.jsx";
Container.registerSingleton("Settings", function() {
    const Settings = require("./modules/Settings.inc.jsx");
    var localConfig = {};
    var scriptsFolder = File($.fileName).parent.fsName;
    var localConfigFilepath = scriptsFolder + "/config/config-local.jsx";
    if (File(localConfigFilepath).exists) {
        $.evalFile(localConfigFilepath);
        localConfig = $.global.plaLocalConfig;
    }
    return new Settings($.global.plaDefaultConfig, localConfig);
});

Container.registerSingleton("Logger", function() {
    const Logger = require("./modules/Logger.inc.jsx");
    const config = Container.resolve("Settings").getLoggerConfig();
    var logger = new Logger(config.folder, config.filename, config.level, config.wipe);
    logger.init();
    return logger;
});

Container.registerSingleton("ErrorFactory", function() {
    const ErrorFactory = require("./modules/ErrorFactory.inc.jsx");
    return new ErrorFactory(
        Container.resolve("Logger"),
        Container.resolve("Settings").getIncludeErrorDetailInAlerts(),
    );
});
// Late initialize custom errors (once after ErrorFactory is registered).
function delayedRequireErrorsModule() {
    require("./modules/Errors.inc.jsx");
}
delayedRequireErrorsModule();

Container.registerSingleton("ArticleShapeGateway", function() {
    const ArticleShapeGateway = require("./modules/ArticleShapeGateway.inc.jsx");
    return new ArticleShapeGateway(
        Container.resolve("Settings").getPlaServiceUrl(),
    );
});

Container.registerFactory("InDesignArticleService", function() {
    const InDesignArticleService = require("./modules/InDesignArticleService.inc.jsx");
    return new InDesignArticleService();
});

Container.registerFactory("ExportInDesignArticlesToPlaService", function() {
    const ExportInDesignArticlesToPlaService = require("./modules/ExportInDesignArticlesToPlaService.inc.jsx");
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
    const RegenerateArticleShapesService = require("./modules/RegenerateArticleShapesService.inc.jsx");
    return new RegenerateArticleShapesService(
        Container.resolve("Settings").getRegenerateArticleShapesQueryName(),
        Container.resolve("ExportInDesignArticlesToPlaService"),
    );
});
