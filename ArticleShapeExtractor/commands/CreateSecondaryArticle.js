CreateSecondaryArticle = function() {
    this.run = function() {
        require('../bootstrap.js');
        try {
            const Container = require("../modules/Container.js");
            Container.resolve("InDesignArticleService").addOrRenameInDesignArticle("Secondary");
        } catch (error) {
            error.alert();
        }
    };
}
module.exports = CreateSecondaryArticle;