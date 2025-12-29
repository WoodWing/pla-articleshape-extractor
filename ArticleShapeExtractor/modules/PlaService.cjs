/**
 * Understands the REST API of the PLA service.
 */
class PlaService {

    /** @type {Logger} */
    #logger;

    /** @type {HttpLogger} */
    #httpLogger;

    /** @type {string} */
    #plaServiceUrl;

    /**
     * @param {Logger} logger 
     * @param {HttpLogger} httpLogger 
     * @param {string} plaServiceUrl 
     */
    constructor(logger, httpLogger, plaServiceUrl) {
        this.#logger = logger;
        this.#httpLogger = httpLogger;
        this.#plaServiceUrl = plaServiceUrl;
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
        const httpRequest = new Request(url, this.#requestInitForPlaService(accessToken, 'GET'));
        try {
            const jsonResponseBody = await this.#fetchJson(httpRequest, null);
            this.#logger.info(`Retrieved ${jsonResponseBody.length} sheet dimensions.`);
            return jsonResponseBody;
        } catch (error) {
            const { PlaServiceCommunicationError } = require('./Errors.cjs');
            throw new PlaServiceCommunicationError(`Could not retrieve sheet dimensions.\n${error.message}`);
        }
    }

    /**
     * @param {Request} httpRequest 
     * @param {Object|null} jsonRequestBody JSON request body
     * @returns {Object} JSON response body.
     */
    async #fetchJson(httpRequest, jsonRequestBody) {
        let httpResponse = null;
        let jsonResponseBody = null;
        try {
            this.#httpLogger.debugLogHttpRequest(httpRequest, jsonRequestBody);
            httpResponse = await fetch(httpRequest);
            const responseBodyText = await httpResponse.text(); 
            try {            
                jsonResponseBody = JSON.parse(responseBodyText);
            } catch(error) {
            }
            if (!httpResponse.ok) {
                let message = `HTTP ${httpResponse.status} ${httpResponse.statusText}`;
                if (jsonResponseBody?.message) {
                    message += `\n${jsonResponseBody.message}`;
                }
                throw new Error(message);
            }
            if (!jsonResponseBody) {
                this.#logger.error("Invalid JSON response: {}", responseBodyText);
                throw new Error("Response does not contain a (valid) JSON.")
            }
        } finally {
            this.#httpLogger.debugLogHttpResponse(httpResponse, jsonResponseBody);
        }
        return jsonResponseBody;
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
     * @param {string|null} genreId 
     * @param {number} shapeType [1..4]
     * @param {number} bodyLength 
     * @param {number} imageCount 
     * @param {number} quoteCount 
     * @param {number} width Column count. 
     * @param {number} height Row count.
     * @param {number|null} foldLine 
     * @param {number} shapeCount 
     * @returns {Object}
     */
    composeSuggestArticleShapesRequestBody(
        genreId, shapeType, 
        bodyLength, imageCount, quoteCount,
        width, height, foldLine, shapeCount        
    ) {
        // Fields below marked with a "*" have no meaning in the service request.
        // Because some are mandatory for the API/DTO, just some dummy data is provided.
        return {
            object: {
                id: "-", // *
                type: "article",
                name: "-", // *
                head: "-", // *
                priority: "must_have", // *
                shape_type: shapeType,
                body_length: bodyLength,
                image_count: imageCount,
                aimed_image_count: null, // *
                quote_count: quoteCount,
                aimed_quote_count: null, // *
                page_id: null, // *
                genre_id: genreId,
            },
            width: width,
            height: height,
            fold_line: foldLine,
            shape_count: shapeCount
        }
    }

    /**
     * Invoke the PLA service that suggests alternative article shapes for a give shape.
     * @param {string} accessToken 
     * @param {string} brandId
     * @param {string} sectionId
     * @param {Object} jsonRequestBody
     * @returns {Array<string>} List of download URLs of the suggested article JSON files.
     */
    async suggestArticleShapes(accessToken, brandId, sectionId, jsonRequestBody) {
        const url = `${this.#plaServiceUrl}/brands/${brandId}/sections/${sectionId}/suggest-article-shapes`
            + "?renditions=composition"; // ask for article JSON file
        const requestInit = this.#requestInitForPlaService(accessToken, 'PUT', JSON.stringify(jsonRequestBody));
        const httpRequest = new Request(url, requestInit);
        try {
            const jsonResponseBody = await this.#fetchJson(httpRequest, jsonRequestBody);
            this.#logger.info(`Retrieved ${jsonResponseBody.length} shape suggestions.`);
            const downloadUrls = [];
            jsonResponseBody.forEach(suggestion => {
                suggestion.renditions.forEach(rendition => {
                    downloadUrls.push(rendition.presigned_url);
                });
            });
            return downloadUrls;
        } catch (error) {
            const { PlaServiceCommunicationError } = require('./Errors.cjs');
            throw new PlaServiceCommunicationError(`Could not retrieve shape suggestions.\n${error.message}`);
        }
    }
}

module.exports = PlaService;