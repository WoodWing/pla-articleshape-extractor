import fs from 'fs';
import path from 'path';
import { StatusCodes } from 'http-status-codes';

/**
 * Understands the REST API of the PLA service.
 */
export class PlaService {

    /** @type {string} */
    #plaServiceUrl;

    /** @type {boolean} */
    #logNetworkTraffic;

    /** @type {ColoredLogger} */
    #logger;

    /**
     * @param {string} plaServiceUrl 
     * @param {boolean} logNetworkTraffic 
     * @param {Logger} logger 
     */
    constructor(plaServiceUrl, logNetworkTraffic, logger) {
        this.#plaServiceUrl = plaServiceUrl;
        this.#logNetworkTraffic = logNetworkTraffic;
        this.#logger = logger;
    }

    /**
     * Retrieve the sheet dimensions from PLA service.
     * Those are set once blueprints are configured.
     * @param {string} accessToken 
     * @param {string} brandId 
     * @returns {Array<Object>} List of sheet dimension DTOs.
     */
    async getSheetDimensions(accessToken, brandId) {
        const url = `${this.#plaServiceUrl}/brands/${brandId}/sheet-dimensions`;
        try {
            const request = new Request(url, this.#requestInitForPlaService(accessToken, 'GET'));
            const response = await fetch(request);
            const responseJson = await response.json();
            this.#logHttpTraffic(request, null, response, responseJson);
            if (response.ok) {
                this.#logger.debug("Retrieved sheet dimensions:", responseJson);
                return responseJson;
            }
            if (response.status === StatusCodes.NOT_FOUND) {
                if (responseJson?.message.includes("is not registered")) {
                    throw new Error(responseJson.message); // client not registered
                }
                return [];
            }
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        } catch (error) {
            throw new Error(`Could not retrieve sheet dimensions - ${error.message}`);
        }        
    }

    /**
     * Run the brand validation in the PLA service.
     * It will validate the dimensions of the blueprint boxes vs the article shapes.
     * @param {string} accessToken 
     * @param {string} brandId 
     * @returns {Array<Object>} List of sheet dimension DTOs.
     */
    async validateBrandConfiguration(accessToken, brandId) {
        const url = `${this.#plaServiceUrl}/brands/${brandId}/admin/validate`;
        try {
            const request = new Request(url, this.#requestInitForPlaService(accessToken, 'GET'));
            const response = await fetch(request);
            const responseJson = await response.json();
            this.#logHttpTraffic(request, null, response, responseJson);
            if (response.ok) {
                this.#logger.debug(`Validated brand setup. Found ${responseJson.length} problems.`);
                return responseJson;
            }
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        } catch (error) {
            throw new Error(`Could not validate brand setup - ${error.message}`);
        }        
    }    

    /**
     * Retrieve the Document Setup settings from PLA service.
     * These settings are configured per brand.
     * When settings have not been made yet, it returns null.
     * @param {string} accessToken 
     * @param {string} brandId 
     * @returns {{margins: {top: Number, bottom: Number, inside: Number, outside: Number}, columns: {gutter: Number}}|null} Settings, or null when not found.
     */
    async getPageLayoutSettings(accessToken, brandId) {
        const url = `${this.#plaServiceUrl}/brands/${brandId}/admin/setting/page-layout`;
        try {
            const request = new Request(url, this.#requestInitForPlaService(accessToken, 'GET'));
            const response = await fetch(request);
            const pageSettings = await response.json();
            this.#logHttpTraffic(request, null, response, pageSettings);
            if (response.ok) {
                const settingsValue = JSON.parse(pageSettings.value);
                this.#logger.debug("Retrieved page layout settings:", settingsValue);
                return settingsValue;
            }
            if (response.status === StatusCodes.NOT_FOUND) {
                this.#logger.warning("Page layout settings not defined yet.");
                return null;
            }
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        } catch (error) {
            throw new Error(`Could not retrieve page layout settings - ${error.message}`);
        }
    }

    /**
     * Retrieve the element labels mapping configuration from PLA service.
     * This mapping is configured per brand.
     * When a mapping has not been made yet, it returns null.
     * @param {string} accessToken 
     * @param {string} brandId 
     * @returns {Object|null} Mapping, or null when not found.
     */
    async getElementLabelMapping(accessToken, brandId) {
        const url = `${this.#plaServiceUrl}/brands/${brandId}/admin/setting/element-labels`;
        try {
            const request = new Request(url, this.#requestInitForPlaService(accessToken, 'GET'));
            const response = await fetch(request);
            const elementMapping = await response.json();
            this.#logHttpTraffic(request, null, response, elementMapping);
            if (response.ok) {
                const settingsValue = JSON.parse(elementMapping.value);
                this.#logger.debug("Retrieved element labels mapping:", settingsValue);
                return settingsValue;
            }
            if (response.status === StatusCodes.NOT_FOUND) {
                this.#logger.warning("Element labels mapping not defined yet.");
                return null;
            }
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        } catch (error) {
            throw new Error(`Could not retrieve element labels mapping - ${error.message}`);
        }
    }    

    /**
     * Compose request options for the PLA service.
     * @param {string} accessToken 
     * @param {string} method 
     * @param {String|null} body 
     * @returns {RequestInit}
     */
    #requestInitForPlaService(accessToken, method, body=null) {
        return {
            mode: 'cors',
            withCredentials: false,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'content-type': 'application/json'
            },
            body: body,
            method: method
        }
    }

    /**
     * Remove all article shapes from the PLA service that were previously configured for a brand.
     * @param {string} accessToken
     * @param {string} brandId 
     */
    async deleteArticleShapes(accessToken, brandId) {
        const url = `${this.#plaServiceUrl}/brands/${brandId}/admin/article-shapes`;
        try {
            const request = new Request(url, this.#requestInitForPlaService(accessToken, 'DELETE'));
            const response = await fetch(request);
            this.#logHttpTraffic(request, null, response, null);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }
            this.#logger.info("Deleted previously configured article shapes.");
        } catch (error) {
            throw new Error(`Could not deleted previously configured article shapes." - ${error.message}`);
        }
    }

    /**
     * Create an article shape configuration in the PLA service.
     * @param {string} accessToken 
     * @param {string} brandId 
     * @param {string} articleShapeName 
     * @param {Object} articleShapeWithRenditionsDto
     * @returns {Array<Object>|null} File renditions, with pre-signed URLs, otherwise null.
     */
    async createArticleShape(accessToken, brandId, articleShapeName, articleShapeWithRenditionsDto) {
        const url = `${this.#plaServiceUrl}/brands/${brandId}/admin/article-shape/${articleShapeName}`;
        try {
            const requestBody = JSON.stringify(articleShapeWithRenditionsDto);
            const request = new Request(url, this.#requestInitForPlaService(accessToken, 'POST', requestBody));
            const response = await fetch(request);
            const responseJson = await response.json();
            this.#logHttpTraffic(request, articleShapeWithRenditionsDto, response, responseJson);
            if (!response.ok) {
                if (response.status === StatusCodes.CONFLICT) { // HTTP 409
                    const regEx1 = 'Article shape .* with this name is already configured for brand';
                    const regEx2 = 'Article shape .* with same composition is already configured for brand';
                    for (const pattern in [regEx1, regEx2]) {
                        const regEx = new RegExp(pattern, 'i');
                        if (regEx.test(responseJson.message)) {
                            this.#logger.info(`Skipped creating article shape - ${responseJson.message}`);
                            return null;
                        }
                    }
                }
                throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }
            this.#logger.info(`Created article shape "${articleShapeName}".`);
            return responseJson.renditions;
        } catch (error) {
            this.#logger.error(`Could not create article shape "${articleShapeName}" - ${error.message}`);
            return null;
        }
    }

    /**
     * Log the URL, request JSON body (optional), response status and response JSON body (optional).
     * @param {Request} request
     * @param {string|null} requestJson 
     * @param {Response} response 
     * @param {string|null} responseJson 
     */
    #logHttpTraffic(request, requestJson, response, responseJson) {
        if (!this.#logNetworkTraffic) {
            return;
        }
        const dottedLine = "- - - - - - - - - - - - - - - - - - - - - - -";
        let message = `Network traffic:\n${dottedLine}\nRequest: HTTP ${request.method} ${request.url}\n`;
        if (requestJson) {
            message += `${JSON.stringify(requestJson, null, 3)}\n`;
        }
        message += `${dottedLine}\nResponse: HTTP ${response.status} ${response.statusText}\n`;
        if (responseJson) {
            message += `${JSON.stringify(responseJson, null, 3)}\n`;
        }
        message += dottedLine;
        this.#logger.debug(message);
    }

    /**
     * Upload a local file to S3 using a pre-signed URL.
     * @param {string} localFilePath
     * @param {string} presignedUrl
     * @param {string} contentType
     * @returns {boolean} Whether the upload was successful.
     */
    async uploadFileToS3(localFilePath, presignedUrl, contentType) {
        try {
            const fileStream = fs.createReadStream(localFilePath);
            const stats = fs.statSync(localFilePath);
            const request = new Request(presignedUrl, {
                method: 'PUT',
                body: fileStream,
                headers: {
                    "Content-Length": stats.size,
                    'Content-Type': contentType,
                },
                duplex: "half" // Required when sending a stream
            });
            const response = await fetch(request);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }
            this.#logHttpTraffic(request, null, response, null);
            this.#logger.info(`Uploaded file "${path.basename(localFilePath)}" successfully to S3.`);
            return true;
        } catch (error) {
            this.#logger.error(`Error uploading file "${path.basename(localFilePath)}" - ${error.message}`);
            return false;
        }
    }
}