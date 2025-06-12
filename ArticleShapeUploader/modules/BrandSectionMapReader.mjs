import fs from 'fs';
import path from 'path';

export class BrandSectionMapReader {

    /** @type {ColoredLogger} */
    #logger;

    /** @type {JsonValidator} */
    #jsonValidator;

    /** @type {Object|null} */
    #brandSections;
    
    /**
     * @param {ColoredLogger} logger 
     * @param {JsonValidator} jsonValidator
     */
    constructor(logger, jsonValidator) {
        this.#logger = logger;
        this.#jsonValidator = jsonValidator;
        this.#brandSections = null;
    }

    /**
     * @param {string} folderPath 
     * @param {string} brandName
     * @return {string} Brand id.
     */
    readMapAndResolveBrandId(folderPath, brandName) {
        const brandSectionMap = this.#readAndValidateMap(folderPath);
        const brandSetup = this.#lookupBrandSetup(brandSectionMap, brandName);
        const sectionCount = Object.keys(brandSetup.sections).length;
        this.#logger.info(`Resolved brand id "${brandSetup.id}" and ${sectionCount} sections for brand "${brandName}".`);
        this.#brandSections = brandSetup.sections;
        return brandSetup.id;
    }

    /**
     * @param {string} folderPath 
     * @returns {Object}
     */
    #readAndValidateMap(folderPath) {
        const filepath = path.join(folderPath, this.#getRelativeMapFilepath());
        let brandSectionMap = null;
        try {
            brandSectionMap = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
        } catch(error) {
            throw new Error(`The file "${filepath}" is not valid JSON - ${error.message}`);
        }
        this.#jsonValidator.validate('brand-section-map', brandSectionMap);
        this.#logger.info(`The "${this.#getRelativeMapFilepath()}" file is valid.`);
        return brandSectionMap;
    }

    /**
     * Compose relative path of the mapping file: _manifest/brand-section-map.json
     * @returns {string}
     */
    #getRelativeMapFilepath() {
        const subfolderName = "_manifest";
        const filename = "brand-section-map.json";
        return path.join(subfolderName, filename);
    }

    /**
     * @param {Object} brandSectionMap 
     * @param {string} brandName 
     * @returns {{id: string, sections: Object}} Brand id and the sections configured under the brand.
     */
    #lookupBrandSetup(brandSectionMap, brandName) {
        const brandSetup = brandSectionMap[brandName];
        if (!brandSetup) {
            throw new Error(`No mapping found for brand "${brandName}". ${this.#getConfigTip()}`);
        }
        return brandSetup;
    }

    /**
     * Compose a help string to show user in case of configuration troubles.
     * @returns {string}
     */
    #getConfigTip() {
        return `Please check your brand setup. And check the "${this.#getRelativeMapFilepath()}" file.`;
    }

    /**
     * @param {string} sectionName 
     * @returns {string} Section id.
     */
    resolveSectionId(sectionName) {
        if (!this.#brandSections) {
            throw new Error(`The brand sections were not resolved yet.`);
        }
        const sectionId = this.#brandSections[sectionName];
        if (!sectionId) {
            throw new Error(`The section "${sectionName}" was not found. ${this.#getConfigTip()}`);
        }
        return sectionId;
    }
}