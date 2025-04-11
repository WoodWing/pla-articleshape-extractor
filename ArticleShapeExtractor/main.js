const { entrypoints } = require("uxp");

/**
 * The fs.readFileSync() call dies silently when the file does not exist
 * and when called in a synchronous manner. It will fail gracefully when
 * called in an async manner. But the config file underlies all the very
 * basics of our dependency injection. This include error handling and the
 * definition of error classes, which is not done in an async manner, to
 * avoid adding complexity to essentials that should always be accessible.
 * 
 * The work-around for this challenge is implemented by this function that
 * is called before anything, even before including the bootstrap.js file.
 * Because called async, it can gracefully fail when the config file does
 * not exist, for which case it will create an empty file. Having the file
 * on disk assures that the synchronous file access works, which is done
 * a bit later, by the Settings class.
 */
async function createDummyLocalConfigFileWhenMissing() {
    const fs = require("fs");
    const configPath = "plugin-data:/config-local.json";
    try {
        fs.readFileSync(configPath, { encoding: "utf-8" }); 
    } catch (error) {
        fs.writeFileSync(configPath, JSON.stringify({}), { encoding: "utf-8" }); 
    }
}

let initialized = false;
async function ensureInit() {
  if (!initialized) {
    initialized = true;
    await createDummyLocalConfigFileWhenMissing();
  }
}

entrypoints.setup({
    commands: {
        createLeadArticle: async () => {
            await ensureInit();
            const CreateLeadArticle = require('./CreateLeadArticle.jsx');
            (new CreateLeadArticle()).run();
        },
        createSecondaryArticle: async () => {
            await ensureInit();
            const CreateSecondaryArticle = require('./CreateSecondaryArticle.jsx');
            (new CreateSecondaryArticle()).run();
        },
        createThirdArticle: async () => {
            await ensureInit();
            const CreateThirdArticle = require('./CreateThirdArticle.jsx');
            (new CreateThirdArticle()).run();
        },
        createFillerArticle: async () => {
            await ensureInit();
            const CreateFillerArticle = require('./CreateFillerArticle.jsx');
            (new CreateFillerArticle()).run();
        },
        extractArticleShapes: async () => {
            await ensureInit();
            const ExtractArticleShapes = require('./ExtractArticleShapes.jsx');
            await (new ExtractArticleShapes()).run();
        },
        regenerateArticleShapes: async () => {
            await ensureInit();
            const RegenerateArticleShapes = require('./RegenerateArticleShapes.jsx');
            await (new RegenerateArticleShapes()).run();
            
        },
    }
});
