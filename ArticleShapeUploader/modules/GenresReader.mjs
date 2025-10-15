import fs from 'fs';
import path from 'path';


export class GenresReader {

    /** @type {ColoredLogger} */
    #logger;

    /** @type {JsonValidator} */
    #jsonValidator;

    /** @type {Array<string>} */
    #genres;
    
    /**
     * @param {ColoredLogger} logger 
     * @param {JsonValidator} jsonValidator
     */
    constructor(logger, jsonValidator) {
        this.#logger = logger;
        this.#jsonValidator = jsonValidator;
        this.#genres = null;
    }

    /**
     * @param {string} folderPath 
     * @return {Array<string>}
     */
    readGenres(folderPath) {
        const manifestFoldername = "_manifest";
        const genresFilename = "genres.json";
        const genresPath = path.join(folderPath, manifestFoldername, genresFilename);
        const genresRelativePath = `${manifestFoldername}/${genresFilename}`;
        try {
            this.#genres = JSON.parse(fs.readFileSync(genresPath, 'utf-8'));
        } catch(error) {
            throw new Error(`The file "${genresRelativePath}" is not valid JSON - ${error.message}`);
        }
        this.#jsonValidator.validate('genres', this.#genres);
        this.#logger.info(`The "${genresRelativePath}" file is valid.`);
        return this.#genres;
    }
}