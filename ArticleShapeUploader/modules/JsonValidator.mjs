import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';

/**
 * Understands how to validate a JSON with help of a JSON schema definition file.
 */
export class JsonValidator {

    #ajv = new Ajv();
    #cache = new Map();
    #workFolder;

    constructor(workFolder) {
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
                `- [${validationError.instancePath || '/'}] ${validationError.message}. Details:\n`
                + `  keyword: ${validationError.keyword}\n`
                + `  params: ${JSON.stringify(validationError.params, null, 2)}\n`
                + `  schemaPath: ${validationError.schemaPath}`
        }
        errorMessage += `JSON:\n${jsonData}\n`;
        throw new Error(errorMessage);
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