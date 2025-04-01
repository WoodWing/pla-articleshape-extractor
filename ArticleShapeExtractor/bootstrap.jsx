//@include "modules/Container.inc.jsx";

//@include "config/config.jsx";
//@include "modules/Settings.inc.jsx";
Container.registerSingleton("Settings", function() {
    var localConfig = {};
    var scriptsFolder = File($.fileName).parent.fsName;
    var localConfigFilepath = scriptsFolder + "/config/config-local.jsx";
    if (File(localConfigFilepath).exists) {
        $.evalFile(localConfigFilepath);
        localConfig = $.global.plaLocalConfig;
    }
    return new Settings($.global.plaDefaultConfig, localConfig);
});

//@include "modules/ArticleShapeGateway.inc.jsx";
Container.registerSingleton("ArticleShapeGateway", function() {
    return new ArticleShapeGateway(
        Container.resolve("Settings").getPlaServiceUrl(),
    );
});

//@include "modules/InDesignArticleService.inc.jsx";
Container.registerFactory("InDesignArticleService", function() {
    return new InDesignArticleService();
});

//@include "modules/ExportInDesignArticlesToPlaService.inc.jsx";
Container.registerFactory("ExportInDesignArticlesToPlaService", function() {
    var settings = Container.resolve("Settings");
    return new ExportInDesignArticlesToPlaService(
        Container.resolve("InDesignArticleService"), 
        Container.resolve("ArticleShapeGateway"), 
        settings.getFallbackBrand(),
        settings.getFallbackCategory(),
    );
});

//@include "modules/RegenerateArticleShapesService.inc.jsx";
Container.registerFactory("RegenerateArticleShapesService", function() {
    return new RegenerateArticleShapesService(
        Container.resolve("Settings").getRegenerateArticleShapesQueryName(),
        Container.resolve("ExportInDesignArticlesToPlaService"),
    );
});
