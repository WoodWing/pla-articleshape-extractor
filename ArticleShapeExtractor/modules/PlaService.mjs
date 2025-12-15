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
        try {
            const request = new Request(url, this.#requestInitForPlaService(accessToken, 'GET'));
            const response = await fetch(request);
            const responseJson = await response.json();
            this.#httpLogger.debugLogHttpTraffic(request, null, response, responseJson);
            if (response.ok) {
                this.#logger.debug(`Retrieved sheet dimensions:\n${JSON.stringify(responseJson, null, 3)}`);
                return responseJson;
            }
            if (response.status === 404) { // HTTP 404 - NOT FOUND
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
     * @param {Object} requestBody
     * @returns {Array<string>} List of download URLs of the suggested article JSON files.
     */
    async suggestArticleShapes(accessToken, brandId, sectionId, requestBody) {
        const url = `${this.#plaServiceUrl}/brands/${brandId}/sections/${sectionId}/suggest-article-shapes`
            + "?renditions=composition"; // ask for article JSON file
        try {
            const requestInit = this.#requestInitForPlaService(accessToken, 'PUT', JSON.stringify(requestBody));
            const request = new Request(url, requestInit);
            const response = await fetch(request);
            const responseJson = await response.json();
            this.#httpLogger.debugLogHttpTraffic(request, requestBody, response, responseJson);
            if (response.ok) {
                this.#logger.debug(`Retrieved ${responseJson.length} shape suggestions.`);
                const downloadUrls = [];
                responseJson.forEach(suggestion => {
                    suggestion.renditions.forEach(rendition => {
                        downloadUrls.push(rendition.presigned_url);
                    });
                });
                return downloadUrls;
            }
            if (response.status === 404) { // HTTP 404 - NOT FOUND
                if (responseJson?.message.includes("is not registered")) {
                    throw new Error(responseJson.message); // client not registered
                }
                return [];
            }
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        } catch (error) {
            throw new Error(`Could not retrieve shape suggestions - ${error.message}`);
        }
    }
}

module.exports = PlaService;