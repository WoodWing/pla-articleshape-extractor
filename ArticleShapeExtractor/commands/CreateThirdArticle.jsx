CreateThirdArticle = function() {
    this.run = function() {
        require('../bootstrap.jsx');
        try {
            const Container = require("../modules/Container.inc.jsx");
            Container.resolve("InDesignArticleService").addOrRenameInDesignArticle("Third");
        } catch (error) {
            error.alert();
        }
    };
}
module.exports = CreateThirdArticle;