await (async function main() {
    try {
        require('../bootstrap.js');
        const Container = require("../modules/Container.js");
        Container.resolve("InDesignArticleService").addOrRenameInDesignArticle("Secondary");
    } catch (error) {
        error.alert();
    }
})();