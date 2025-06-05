import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import { ColoredLogger } from './ColoredLogger.mjs';

/**
 * Understands how to validate a JSON with help of a JSON schema definition file.
 */
export class JsonValidator {

    /** @type {Ajv} */
    #ajv = new Ajv();

    /** @type {Map} */
    #cache = new Map();

    /** @type {ColoredLogger} */
    #logger;

    /** @type {string} */
    #workFolder;

    /**
     * @param {ColoredLogger} logger 
     * @param {string} workFolder 
     */
    constructor(logger, workFolder) {
        this.#logger = logger;
        this.#workFolder = workFolder;
    }

    validate(schemaName, jsonData) {
        const validate = this.#loadCachedSchema(schemaName);
        if (validate(jsonData)) {
            return;
        }
        const schemaFilepath = this.#composeJsonSchemaFilepath(schemaName);
        let errorMessage = `The JSON is not valid according to the ${schemaFilepath} file:\n`;
        for (const validationError of validate.errors) {
            errorMessage +=
                `- [${validationError.instancePath || '/'}] ${validationError.message}.\nDetails:\n`
                + `  keyword: ${validationError.keyword}\n`
                + `  params: ${JSON.stringify(validationError.params, null, 2)}\n`
                + `  schemaPath: ${validationError.schemaPath}\n`
        }
        errorMessage += `JSON:\n`;
        this.#logger.error(errorMessage, jsonData);
        throw new Error(`Invalid ${schemaName} JSON.`);
    }

    #composeJsonSchemaFilepath(schemaName) {
        return path.join(this.#workFolder, `${schemaName}.schema.json`);
    }

    #loadCachedSchema(schemaName) {
        if (this.#cache.has(schemaName)) {
            return this.#cache.get(schemaName);
        }
        const schemaFilepath = this.#composeJsonSchemaFilepath(schemaName);
        const schemaJson = JSON.parse(fs.readFileSync(schemaFilepath, 'utf-8'));
        const validate = this.#ajv.compile(schemaJson);
        this.#cache.set(schemaName, validate);
        return validate;
    }    
}