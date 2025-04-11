const { entrypoints } = require("uxp");

entrypoints.setup({
    commands: {
        createLeadArticle: async () => {
            const CreateLeadArticle = require('./CreateLeadArticle.jsx');
            (new CreateLeadArticle()).run();
        },
        createSecondaryArticle: async () => {
            const CreateSecondaryArticle = require('./CreateSecondaryArticle.jsx');
            (new CreateSecondaryArticle()).run();
        },
        createThirdArticle: async () => {
            const CreateThirdArticle = require('./CreateThirdArticle.jsx');
            (new CreateThirdArticle()).run();
        },
        createFillerArticle: async () => {
            const CreateFillerArticle = require('./CreateFillerArticle.jsx');
            (new CreateFillerArticle()).run();
        },
        extractArticleShapes: async () => {
            const ExtractArticleShapes = require('./ExtractArticleShapes.jsx');
            await (new ExtractArticleShapes()).run();
        },
        regenerateArticleShapes: async () => {
            const RegenerateArticleShapes = require('./RegenerateArticleShapes.jsx');
            await (new RegenerateArticleShapes()).run();
            
        },
    }
});
