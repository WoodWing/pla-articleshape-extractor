import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import { ColoredLogger } from './ColoredLogger.mjs';

/**
 * Understands how to validate a JSON with help of a JSON schema definition file.
 */
export class JsonValidator {

    #ajv = new Ajv();
    #cache = new Map();
    #logger;
    #workFolder;

    /**
     * @constructor
     * @param {ColoredLogger} logger 
     * @param {string} workFolder 
     */
    constructor(logger, workFolder) {
        this.#logger = logger;
        this.#workFolder = workFolder;
    }

    validate(schemaName, jsonData) {
        const validate = this._loadCachedSchema(schemaName);
        if (validate(jsonData)) {
            return;
        }
        const schemaFilepath = this._composeJsonSchemaFilepath(schemaName);
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

    _composeJsonSchemaFilepath(schemaName) {
        return path.join(this.#workFolder, `${schemaName}.schema.json`);
    }

    _loadCachedSchema(schemaName) {
        if (this.#cache.has(schemaName)) {
            return this.#cache.get(schemaName);
        }
        const schemaFilepath = this._composeJsonSchemaFilepath(schemaName);
        const schemaJson = JSON.parse(fs.readFileSync(schemaFilepath, 'utf-8'));
        const validate = this.#ajv.compile(schemaJson);
        this.#cache.set(schemaName, validate);
        return validate;
    }    
}