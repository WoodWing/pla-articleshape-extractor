import fs from 'fs';
import path from 'path';
import { StatusCodes } from 'http-status-codes';

/**
 * Understands the REST API of the PLA service.
 */
export class PlaService {
    /**
     * @param {string} plaServiceUrl 
     * @param {boolean} logNetworkTraffic 
     * @param {Logger} logger 
     */
    constructor(plaServiceUrl, logNetworkTraffic, logger) {
        this._plaServiceUrl = plaServiceUrl;
        this._logNetworkTraffic = logNetworkTraffic;
        this._logger = logger;
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
        const url = `${this._plaServiceUrl}/brands/${brandId}/admin/setting/page-layout`;
        try {
            const request = new Request(url, this._requestInitForPlaService(accessToken, 'GET'));
            const response = await fetch(request);
            const pageSettings = await response.json();
            this._logHttpTraffic(request, null, response, pageSettings);
            if (response.ok) {
                const settingsValue = JSON.parse(pageSettings.value);
                this._logger.debug("Retrieved page layout settings: ", settingsValue);
                return settingsValue;
            }
            if (response.status === StatusCodes.NOT_FOUND) {
                this._logger.warning("Page layout settings not defined yet.");
                return null;
            }
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        } catch (error) {
            throw new Error(`Could not retrieve page layout settings - ${error.message}`);
        }
    }

    /**
     * Compose request options for the PLA service.
     * @param {string} accessToken 
     * @param {string} method 
     * @param {String|null} body 
     * @returns {RequestInit}
     */
    _requestInitForPlaService(accessToken, method, body=null) {
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
        const url = `${this._plaServiceUrl}/brands/${brandId}/admin/article-shapes`;
        try {
            const request = new Request(url, this._requestInitForPlaService(accessToken, 'DELETE'));
            const response = await fetch(request);
            this._logHttpTraffic(request, null, response, null);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }
            this._logger.info("Deleted previously configured article shapes.");
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
        const url = `${this._plaServiceUrl}/brands/${brandId}/admin/article-shape/${articleShapeName}`;
        try {
            const requestBody = JSON.stringify(articleShapeWithRenditionsDto);
            const request = new Request(url, this._requestInitForPlaService(accessToken, 'POST', requestBody));
            const response = await fetch(request);
            const responseJson = await response.json();
            this._logHttpTraffic(request, articleShapeWithRenditionsDto, response, responseJson);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }
            this._logger.info(`Created article shape "${articleShapeName}".`);
            return responseJson.renditions;
        } catch (error) {
            this._logger.error(`Could not create article shape "${articleShapeName}" - ${error.message}`);
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
    _logHttpTraffic(request, requestJson, response, responseJson) {
        if (!this._logNetworkTraffic) {
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
        this._logger.debug(message);
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
            this._logHttpTraffic(request, null, response, null);
            this._logger.info(`Uploaded file "${path.basename(localFilePath)}" successfully to S3.`);
            return true;
        } catch (error) {
            this._logger.error(`Error uploading file "${path.basename(localFilePath)}" - ${error.message}`);
            return false;
        }
    }
}