/**
 * Understands genres; How to detect the genre in a given an article name
 * and how to export them to  the _manifest subfolder of the export folder.
 */
class GenreResolver {

    /** @type {Logger} */
    #logger;

    /** @type {FileUtils} */
    #fileUtils;

    /** @type {Array<String>} */
    #genres;

    /**
     * @param {Logger} logger 
     * @param {FileUtils} fileUtils
     * @param {Array<String>} genres
     */
    constructor(logger, fileUtils, genres) {
        this.#logger = logger;
        this.#fileUtils = fileUtils;
        // Unlike other entities, genres are not saved in the DB. So there is no id-name mapping.
        // Instead, genres is just a list of names. To avoid inconsistencies, those are lower-cased.
        this.#genres = genres.map(genre => genre.toLowerCase());
    }

    /**
     * Lookup the genre in the article name (case insensitive).
     * 
     * @param {String} articleName 
     * @returns {String|null}
     */
    resolveGenreId(articleName) {
        let genreId = null;
        for (let genreIndex = 0; genreIndex < this.#genres.length; genreIndex++) {
            const thisGenreId = this.#genres[genreIndex];
            if (articleName.toLowerCase().includes(thisGenreId)) {
                genreId = thisGenreId;
                break;
            }
        }
        return genreId;
    }

    /**
     * When no genres configured, the Genres feature is disabled.
     * 
     * @returns {Boolean}
     */
    isFeatureEnabled() {
        return this.#genres.length > 0;
    }

    /**
     * @param {Folder} exportFolder
     */
    async saveGenesToManifest(exportFolder) {
        const filepath = window.path.join(exportFolder, "_manifest", "genres.json");
        await this.#fileUtils.getOrCreateSubFolder(exportFolder, "_manifest");
        const lfs = require('uxp').storage.localFileSystem;
        const formats = require('uxp').storage.formats;
        const jsonFile = await lfs.createEntryWithUrl(filepath, { overwrite: true });
        const jsonString = JSON.stringify(this.#genres, null, 4);
        jsonFile.write(jsonString, {format: formats.utf8}); 
        this.#logger.info(`Saved the supported genres to "${filepath}".`);
    }
}

module.exports = GenreResolver;