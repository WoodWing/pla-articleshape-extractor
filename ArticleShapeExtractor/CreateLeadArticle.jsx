require('./bootstrap.jsx');
try {
    const Container = require("./modules/Container.inc.jsx");
    Container.resolve("InDesignArticleService").addOrRenameInDesignArticle("Lead");
} catch (error) {
    error.alert();
}
module.exports = CreateLeadArticle;