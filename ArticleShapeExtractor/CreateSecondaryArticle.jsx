require('./bootstrap.jsx');
try {
    const Container = require("./modules/Container.inc.jsx");
    Container.resolve("InDesignArticleService").addOrRenameInDesignArticle("Secondary");
} catch (error) {
    error.alert();
}
module.exports = CreateSecondaryArticle;