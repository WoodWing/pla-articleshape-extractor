/**
 * Understands how to stream HTTP traffic to the log.
 */
class HttpLogger {

    /** @type {Logger} */
    #logger;

    /** @type {boolean} */
    #logNetworkTraffic;

    /**
     * @param {Logger} logger 
     * @param {boolean} logNetworkTraffic 
     */
    constructor(logger, logNetworkTraffic) {
        this.#logger = logger;
        this.#logNetworkTraffic = logNetworkTraffic;
    }

    /**
     * Log the URL, request JSON body (optional), response status and response JSON body (optional).
     * @param {Request} request
     * @param {Object|null} requestJson 
     * @param {Response|null} response 
     * @param {Object|null} responseJson 
     */
    debugLogHttpTraffic(request, requestJson, response, responseJson) {
        if (!this.#logNetworkTraffic || !this.#logger.isDebug()) {
            return;
        }
        const dottedLine = "- - - - - - - - - - - - - - - - - - - - - - -";
        let message = `Network traffic:\n${dottedLine}\n`
            +`Request: HTTP ${request.method} ${request.url}\n`
            + this.#composeHttpHeaders(request.headers)
            + this.#composeJsonBody(requestJson);
        if (response) {
            message += `${dottedLine}\n`
            + `Response: HTTP ${response.status} ${response.statusText}\n`
            + this.#composeHttpHeaders(response.headers)
            + this.#composeJsonBody(responseJson)
            + dottedLine;
        }
        this.#logger.debug(message);
    }

    /**
     * @param {Headers} headers
     * @returns {string}
     */
    #composeHttpHeaders(headers) {
        let message = '';
        if (headers && typeof headers.forEach === "function") {
            message += "Headers:\n";
            headers.forEach((value, key) => {
                message += `- '${key}': '${value}'\n`;
            });
        }
        return message;
    }

    /**
     * @param {Object|null} jsonBody 
     * @returns {string}
     */
    #composeJsonBody(jsonBody) {
        let message = '';
        if (jsonBody) {
            message += `Body:\n`;
            message += `${JSON.stringify(jsonBody, null, 3)}\n`;
        }
        return message;
    }
}

module.exports = HttpLogger;