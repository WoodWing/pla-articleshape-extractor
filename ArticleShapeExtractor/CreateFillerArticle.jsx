//@include "bootstrap.jsx";

try {
    Container.resolve("InDesignArticleService").addOrRenameInDesignArticle("Filler");
} catch(error) {
    error.alert();
}