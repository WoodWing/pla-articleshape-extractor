//@include "bootstrap.jsx";

try {
    Container.resolve("InDesignArticleService").addOrRenameInDesignArticle("Lead");
} catch(error) {
    error.alert();
}