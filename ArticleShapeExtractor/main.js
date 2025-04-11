const { entrypoints } = require("uxp");

entrypoints.setup({
    commands: {
        createLeadArticle: () => {
            require('./CreateLeadArticle.jsx');
        },
        createSecondaryArticle: () => {
            require('./CreateSecondaryArticle.jsx');
        },
        createThirdArticle: () => {
            require('./CreateThirdArticle.jsx');
        },
        createFillerArticle: () => {
            require('./CreateFillerArticle.jsx');
        },
        extractArticleShapes: () => {
            require('./ExtractArticleShapes.jsx');
        },
        regenerateArticleShapes: () => {
            require('./RegenerateArticleShapes.jsx');
        },
    }
});
