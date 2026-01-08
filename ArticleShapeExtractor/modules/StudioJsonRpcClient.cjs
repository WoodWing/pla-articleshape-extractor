const Errors = require("./Errors.cjs");

/**
 * Understands how to communicate with Studio Server using the JSON-RPC protocol.
 */
class StudioJsonRpcClient {

    /** @type {Logger} */
    #logger;

    /** @type {HttpLogger} */
    #httpLogger;

    /** @type {string|null} */
    #serverUrl;

    /** @type {string|null} */
    #ticket;

    /** @type {number} */
    #rpcSequenceId;

    /**
     * @param {Logger} logger
     * @param {HttpLogger} httpLogger
     * @param {string|null} serverUrl
     * @param {string|null} ticket
     */
    constructor (logger, httpLogger, serverUrl, ticket) {
        this.#logger = logger;
        this.#httpLogger = httpLogger;
        this.#serverUrl = serverUrl;
        this.#ticket = ticket;
        this.#rpcSequenceId = 0;
    }

    /**
     * Whether or not a session with the Studio Server has been setup.
     * @returns {boolean}
     */
    hasSession () {
        return this.#serverUrl && this.#ticket;
    }

    /**
     * Call the GetPublications workflow service provided by Studio Server.
     * @param {string[]|null} brandIds List of ids, or null for all brands.
     * @param {string[]|null} requestInfo Brand setup info to resolve: "FeatureAccessList", "ObjectTypeProperties", "ActionProperties", "States", "CurrentIssue", "PubChannels", "Categories"
     * @returns {Promise<Object[]>} List of PublicationInfo data objects.
     */
    async getPublicationInfos (brandIds, requestInfo) {
        const url = this.#getStudioServerUrl();
        const request = {
            Ticket: this.#ticket,
        };
        if (brandIds) {
            request["IDs"] = brandIds;
        }
        if (requestInfo) {
            request["RequestInfo"] = requestInfo;
        }
        const response = await this.#callWebService(url, request, "GetPublications");
        return response.Publications;
    }

    /**
     * Calls a workflow service provided by Studio Server.
     * Uses the JSON-RPC communication protocol.
     * @param {string} url
     * @param {Object} request
     * @param {string} serviceName
     * @returns {Promise<Object>} Response
     */
    async #callWebService (url, request, serviceName) {
        this.#rpcSequenceId += 1;
        const rpcRequest = {
            "method": serviceName,
            "id": `${this.#rpcSequenceId}`,
            "params": [request],
            "jsonrpc": "2.0",
        };
        const httpRequest = new Request(url, {
            mode: "cors",
            withCredentials: false,
            method: "POST",
            body: JSON.stringify(rpcRequest),
        });
        try {
            const rpcResponse = await this.#fetchRpc(httpRequest, rpcRequest);
            return rpcResponse.result;
        }
        catch (error) {
            throw new Errors.StudioServerCommunicationError(`${serviceName} service failed.\n${error.message}`);
        }

        // Don't simply use the app.jsonRequest() API provided by SC plugins; That does not seem to work
        // for JSON-RPC services provided by server plugins (like the ContentStation plugin).
        // For example:
        //    const rawRequest = JSON.stringify(rpcRequest);
        //    const rawResponse = app.jsonRequest(url, rawRequest);
        //    const rpcResponse = JSON.parse(rawResponse);
        //    return rpcResponse.result;
        //
        // Nevertheless, app.jsonRequest() caters for on-premise SSL certificate configuration in the
        // WWSettings.xml file. For now, this.#fetchRpc() calls fetch(), which is implemented by IDJS/UXP,
        // hence might lead into SSL problems in the future for on-premise customers using such config.
        // However, over time, most likely this will become less of a problem as we are moving to WW Cloud.
        // See also chapter "Known limitations" in the ../README.md file.
    };

    /**
     * @param {Request} httpRequest
     * @param {Object} rpcRequestBody JSON RPC request body.
     * @returns {Promise<Object>} JSON RPC response body.
     */
    async #fetchRpc (httpRequest, rpcRequestBody) {
        let httpResponse = null;
        let rpcResponseBody = null;
        try {
            this.#httpLogger.debugLogHttpRequest(httpRequest, rpcRequestBody);
            httpResponse = await fetch(httpRequest);
            const responseBodyText = await httpResponse.text();
            try {
                rpcResponseBody = JSON.parse(responseBodyText);
            }
            catch {
                // Intentionally ignored
            }
            if (!httpResponse.ok) {
                throw new Error(`HTTP ${httpResponse.status} ${httpResponse.statusText}`);
            }
            if (!rpcResponseBody) {
                this.#logger.error("Invalid JSON response:\n{}", responseBodyText);
                throw new Error("Response does not contain a (valid) JSON.");
            }
            if (rpcResponseBody?.error) {
                this.#logger.error("JSON RPC error:\n{}", JSON.stringify(rpcResponseBody, null, 3));
                throw new Error(rpcResponseBody.error.message);
            }
            if (!rpcResponseBody.result) {
                this.#logger.error("JSON RPC result missing:\n{}", JSON.stringify(rpcResponseBody, null, 3));
                throw new Error("Response has no JSON RPC result.");
            }
        }
        finally {
            this.#httpLogger.debugLogHttpResponse(httpResponse, rpcResponseBody);
        }
        return rpcResponseBody;
    }

    /**
     * Calls the QueryObjects service in paged manner until all objects are retrieved.
     * @param {Object[]} searchParams List of QueryParam objects.
     * @param {string[]} resolveProperties List of workflow object property names to resolve.
     * @param {CallableFunction} callbackObjectsResolved This function is called for each page of retrieved objects.
     */
    async queryObjects (searchParams, resolveProperties, callbackObjectsResolved) {
        let firstEntry = 1;
        let queryCount = 0;
        const maxQueryHit = 100; // paranoid prevention of endless loops
        let response = null;
        do {
            queryCount++;
            this.#logger.info(`Running QueryObjects page#${queryCount}...`);
            response = await this.#queryObjectsOneResultPage(
                searchParams, resolveProperties, firstEntry);
            // firstEntry = response.FirstEntry + response.ListedEntries;
            //  L> Assumed is that the status of a processed layout is changed; Hence it does NOT page
            //     the results because processed layouts already disappear from the search results.
            const wflObjects = this.#getObjectsFromQueryObjectsResponse(response, resolveProperties);
            if (wflObjects.length > 0) {
                await callbackObjectsResolved(wflObjects);
            }
        } while (response.ListedEntries > 0 && queryCount < maxQueryHit);
        if (queryCount === maxQueryHit) {
            throw new Errors.PrintLayoutAutomationError(`Too many QueryObjects executed: ${maxQueryHit}.`);
        }
    };

    /**
     * Calls the QueryObjects service.
     * @param {Object[]} searchParams List of QueryParam objects.
     * @param {string[]} resolveProperties List of workflow object property names to resolve.
     * @param {number} firstEntry Object index to start reading from (in paged results).
     * @returns {Promise<Object>} QueryObjectsResponse
     */
    async #queryObjectsOneResultPage (searchParams, resolveProperties, firstEntry) {
        const startsWithProps = ["ID", "Type", "Name"]; // service rule: must start with this sequence of props
        if (!startsWithProps.every((value, index) => resolveProperties[index] === value)) {
            throw new Errors.ArgumentError("The 'resolveProperties' param should start with 'ID', 'Name' and 'Type' values.");
        }
        const url = this.#getStudioServerUrl();
        const request = {
            "Ticket": this.#ticket,
            "Params": searchParams,
            "FirstEntry": firstEntry,
            "MaxEntries": 25,
            "RequestProps": resolveProperties,
            "Order": [{ Property: "ID", Direction: true, __classname__: "QueryOrder" }], // oldest first
        };
        const response = await this.#callWebService(url, request, "QueryObjects");
        return response;
    };

    /**
     * Build a list of workflow objects from the Columns and Rows of a given QueryObjectsResponse.
     * @param {Object} response
     * @param {string[]} resolveProperties Names of workflow object properties to expect.
     * @returns {Object[]} List of resolved objects, each having the properties assigned.
     */
    #getObjectsFromQueryObjectsResponse (response, resolveProperties) {
        const wflObjects = [];
        const columnIndexes = new Map();
        for (var columnIndex = 0; columnIndex < response.Columns.length; columnIndex++) {
            const columnName = response.Columns[columnIndex].Name;
            if (resolveProperties.includes(columnName)) {
                columnIndexes.set(columnName, columnIndex);
            }
        }
        for (var rowIndex = 0; rowIndex < response.Rows.length; rowIndex++) {
            let wflObject = {};
            for (const property of resolveProperties) {
                wflObject[property] = response.Rows[rowIndex][columnIndexes.get(property)];
            }
            wflObjects.push(wflObject);
        }
        return wflObjects;
    }

    /**
     * Call the MultiSetObjectProperties service to move objects to another status.
     * @param {string[]} objectIds
     * @param {string} statusId
     */
    async sendObjectsToStatus (objectIds, statusId) {
        const url = this.#getStudioServerUrl();
        const request = {
            Ticket: this.#ticket,
            IDs: objectIds,
            MetaData: [{
                Property: "StateId",
                PropertyValues: [{
                    Value: statusId,
                    __classname__: "PropertyValue",
                }],
                __classname__: "MetaDataValue",
            }],
        };
        await this.#callWebService(url, request, "MultiSetObjectProperties");
    }

    /**
     * Retrieve a new access token that can be used for WW cloud services.
     * @param {string} brandId
     * @returns {Promise<string>}
     */
    async getAccessToken (brandId) {
        const url = this.#getStudioClientServerPluginUrl();
        const request = {
            BrandIds: [brandId],
            __classname__: "CsPubGetAccessTokenRequest",
            Ticket: this.#ticket,
        };
        const response = await this.#callWebService(url, request, "GetAccessToken");
        return response.Token;
    }

    /**
     * Compose an entry point for the JSON-RPC publishing web services provided by the CS plugin.
     * @returns {string}
     */
    #getStudioClientServerPluginUrl () {
        const pluginUrl = this.#serverUrl.replace("index.php", "pluginindex.php");
        const separator = this.#getUrlParamSeparator(pluginUrl);
        return `${pluginUrl}${separator}plugin=ContentStation&interface=pub&protocol=JSON`;
    }

    /**
     * Compose an entry point for the JSON-RPC workflow services provided by Studio Server.
     * @returns {string}
     */
    #getStudioServerUrl () {
        const separator = this.#getUrlParamSeparator(this.#serverUrl);
        return `${this.#serverUrl}${separator}protocol=JSON`;
    }

    /**
     * @param {string} url
     * @returns {string}
     */
    #getUrlParamSeparator (url) {
        return url.indexOf("?") === -1 ? "?" : "&";
    }
}

module.exports = StudioJsonRpcClient;
