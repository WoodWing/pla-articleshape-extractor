require('./bootstrap.jsx');
try {
    const Container = require("./modules/Container.inc.jsx");
    Container.resolve("InDesignArticleService").addOrRenameInDesignArticle("Filler");
} catch (error) {
    error.alert();
}
module.exports = CreateFillerArticle;