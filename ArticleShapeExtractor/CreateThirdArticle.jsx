//@include "bootstrap.jsx";

try {
    Container.resolve("InDesignArticleService").addOrRenameInDesignArticle("Third");
} catch(error) {
    error.alert();
}