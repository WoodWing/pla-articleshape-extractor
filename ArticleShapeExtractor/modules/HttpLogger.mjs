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
     * Log the HTTP URL, request headers and JSON body.
     * @param {Request} httpRequest
     * @param {Object|null} jsonRequestBody 
     */
    debugLogHttpRequest(httpRequest, jsonRequestBody) {
        if (!this.#logNetworkTraffic || !this.#logger.isDebug()) {
            return;
        }
        const message = `HTTP request:\n${this.#dottedLine()}\n`
            +`Status: HTTP ${httpRequest.method} ${httpRequest.url}\n`
            + this.#composeHttpHeaders(httpRequest.headers)
            + this.#composeJsonBody(jsonRequestBody)
            + `${this.#dottedLine()}`;
        this.#logger.debug(message);
    }

    #dottedLine() {
        return "- - - - - - - - - - - - - - - - - - - - - - -";
    }

    /**
     * Log the HTTP status, response headers and JSON body.
     * @param {Response|null} httpResponse 
     * @param {Object|null} jsonResponseBody 
     */
    debugLogHttpResponse(httpResponse, jsonResponseBody) {
        if (!this.#logNetworkTraffic || !this.#logger.isDebug()) {
            return;
        }
        if (!httpResponse) {
            return;
        }
        const message = `HTTP response:\n${this.#dottedLine()}\n`
            + `Status: HTTP ${httpResponse.status} ${httpResponse.statusText}\n`
            + this.#composeHttpHeaders(httpResponse.headers)
            + this.#composeJsonBody(jsonResponseBody)
            + `${this.#dottedLine()}`;
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
                message += `- ${key}: ${value}\n`;
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