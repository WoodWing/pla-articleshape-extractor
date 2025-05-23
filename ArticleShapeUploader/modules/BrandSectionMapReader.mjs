import fs from 'fs';
import path from 'path';

export class BrandSectionMapReader {
    #logger;
    #jsonValidator;
    
    /**
     * @param {Logger} logger 
     * @param {JsonValidator} jsonValidator
     */
    constructor(logger, jsonValidator) {
        this.#logger = logger;
        this.#jsonValidator = jsonValidator;
    }

    /**
     * @param {string} folderPath 
     * @param {string} brandName
     * @return {{brandId: string, sectionMap: Array<string,string>}}
     */
    readMapAndResolveBrandId(folderPath, brandName) {
        const brandSectionMap = this.#readAndValidateMap(folderPath);
        const brandSetup = this.#lookupBrandSetup(brandSectionMap, brandName);
        const sectionCount = Object.keys(brandSetup.sections).length;
        this.#logger.info(`Resolved brand id "${brandSetup.id}" and ${sectionCount} sections for brand "${brandName}".`);
        return { brandId: brandSetup.id, sectionMap: brandSetup.sections };
    }

    /**
     * @param {string} folderPath 
     * @returns {Object}
     */
    #readAndValidateMap(folderPath) {
        const subfolderName = "_manifest";
        const filename = "brand-section-map.json";
        const filepath = path.join(folderPath, subfolderName, filename);
        let brandSectionMap = null;
        try {
            brandSectionMap = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
        } catch(error) {
            throw new Error(`The file "${filepath}" is not valid JSON - ${error.message}`);
        }
        this.#jsonValidator.validate('brand-section-map', brandSectionMap);
        this.#logger.info(`The "${subfolderName}/${filename}" file is valid.`);
        return brandSectionMap;
    }

    /**
     * @param {Object} brandSectionMap 
     * @param {string} brandName 
     * @returns {brandId: string, sectionMap: Array<string,string>}
     */
    #lookupBrandSetup(brandSectionMap, brandName) {
        const brandSetup = brandSectionMap[brandName];
        if (!brandSetup) {
            throw new Error(`No mapping found for brand "${brandName}". Please check your brand setup.`);
        }
        return brandSetup;
    }
}