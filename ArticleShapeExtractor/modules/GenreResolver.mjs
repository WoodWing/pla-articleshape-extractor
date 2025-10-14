const formats = require('uxp').storage.formats;

/**
 * Understands genres; How to detect the genre in a given an article name and how
 * to normalize and export them to the _manifest subfolder of the export folder.
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
        this.#genres = this.#normalizeGenres(genres);
    }

    /**
     * Unlike other entities, genres are not saved in the DB. So there is no id-name mapping.
     * Instead, genres is just a list of names. To avoid inconsistencies, those are normalized;
     * They are trimmed, lower-cased and sorted.
     * 
     * @param {Array<String>} genres
     */
    #normalizeGenres(genres) {
        return genres
            .map(genre => genre.trim().toLowerCase())
            .sort();
    }

    /**
     * Lookup the genre in the article name (case insensitive).
     * When multiple matches found, they are all returned.
     * 
     * @param {String} articleName 
     * @returns {Array<String>}
     */
    resolveGenreIds(articleName) {
        let genreIds = [];
        for (let genreIndex = 0; genreIndex < this.#genres.length; genreIndex++) {
            const thisGenreId = this.#genres[genreIndex];
            if (articleName.toLowerCase().includes(thisGenreId)) {
                genreIds.push(thisGenreId);
            }
        }
        return genreIds;
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
     * Export configured genres to the _manifest subfolder of the export folder.
     * The genres are trimmed, lower-cased and sorted to ease comparing configurations.
     * If the file already exists, it validates whether the genres to save are the same
     * as the genres in the file, which is expected.
     * 
     * @param {Folder} exportFolder
     */
    async saveGenesToManifest(exportFolder) {
        const manifestFoldername = "_manifest";
        const genresFilename = "genres.json";
        const { entry: manifestFolder, _ } = await this.#fileUtils.getOrCreateSubFolder(exportFolder, manifestFoldername);
        const { entry: genresFile, created } = await this.#fileUtils.getOrCreateFile(manifestFolder, genresFilename);
        const genresRelativePath = `${manifestFoldername}/${genresFilename}`;
        const configRelativePath = "config/config-local.js";
        if (created) {
            const genresJson = JSON.stringify(this.#genres, null, 4);
            const byteCount = await genresFile.write(genresJson, {format: formats.utf8}); 
            if (!byteCount ) {
                const { ConfigurationError } = require('./Errors.mjs');
                const message = `Could not write into file '${genresRelativePath}'.\nPlease check access rights.`;
                throw new ConfigurationError(message);
            }
            this.#logger.info(`Saved the configured genres to "${filepath}".`);
        } else {
            const genresOfPrecedingOperation = JSON.parse(await genresFile.read({format: formats.utf8}));
            if (!this.#compareArraysOfStrings(this.#genres, genresOfPrecedingOperation)) {
                this.#logger.error("Detected differences in configured genres:\n"
                    + `1) configured genres: ${JSON.stringify(this.#genres, null, 4)}\n`
                    + `2) genres.json:\n${JSON.stringify(genresOfPrecedingOperation, null, 4)}\n`
                );
                const { ConfigurationError } = require('./Errors.mjs');
                const message = "\n" 
                    + "The genres configured for the current operation differ from the preceding operation.\n"
                    + `Genres configured for the current operation are found in '${configRelativePath}'.\n`
                    + `Genres of the preceding operation were saved in '${genresRelativePath}'.\n`
                    + `Resolve differences by either adjusting '${configRelativePath}' or removing '${genresRelativePath}'.\n`
                    + "See also logging for the differences found.";
                throw new ConfigurationError(message);
            }
            this.#logger.info(`The configured genres already exist in '${configRelativePath}'. No action taken.`);
        }
    }

    /**
     * Check whether two sorted arrays of strings are identical.
     * 
     * @param {Array<String>} lhs 
     * @param {Array<String>} rhs 
     * @returns {Boolean}
     */
    #compareArraysOfStrings(lhs, rhs) {
        return lhs.length === rhs.length 
            && lhs.every((item, index) => item === rhs[index]);
    }
    
}

module.exports = GenreResolver;