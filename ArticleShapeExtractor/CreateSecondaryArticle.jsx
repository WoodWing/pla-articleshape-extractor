//@include "bootstrap.jsx";

try {
    Container.resolve("InDesignArticleService").addOrRenameInDesignArticle("Secondary");
} catch(error) {
    error.alert();
}