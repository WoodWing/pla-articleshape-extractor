CreateLeadArticle = function() {
    this.run = function() {
        require('../bootstrap.js');
        try {
            const Container = require("../modules/Container.js");
            Container.resolve("InDesignArticleService").addOrRenameInDesignArticle("Lead");
        } catch (error) {
            error.alert();
        }
    };
}
module.exports = CreateLeadArticle;