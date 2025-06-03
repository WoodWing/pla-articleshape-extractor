const { app } = require("indesign");

/**
 * Understands how to communicate with Studio Server using the JSON-RPC protocol.
 * 
 * @constructor
 * @param {Logger} logger 
 * @param {boolean} logNetworkTraffic
 * @param {string|null} serverUrl 
 * @param {string|null} ticket 
 */
function StudioJsonRpcClient(logger, logNetworkTraffic, serverUrl, ticket) {
    this._logger = logger;
    this._logNetworkTraffic = logNetworkTraffic;
    this._serverUrl = serverUrl;
    this._ticket = ticket;

    /**
     * Whether or not a session with the Studio Server has been setup.
     * @returns {boolean}
     */
    this.hasSession = function() {
        return this._serverUrl && this._ticket;
    }

    /**
     * Call the GetPublications workflow service provided by Studio Server.
     * @param {Array<string>|null} brandIds List of ids, or null for all brands.
     * @param {Array<string>|null} requestInfo Brand setup info to resolve: "FeatureAccessList", "ObjectTypeProperties", "ActionProperties", "States", "CurrentIssue", "PubChannels", "Categories"
     * @returns {Array<Object>} List of PublicationInfo data objects.
     */
    this.getPublicationInfos = function(brandIds, requestInfo) {
        const request = {
            Ticket: this._ticket
        }
        if (brandIds) {
            request["IDs"] = brandIds;
        }
        if (requestInfo) {
            request["RequestInfo"] = requestInfo;
        }
        const response = this._callWebService(request, "GetPublications");
        return response.Publications;
    }

    /**
     * Calls a workflow service provided by Studio Server.
     * Uses the JSON-RPC communication protocol.
     * @param {Object} request
     * @param {string} serviceName
     * @returns {Object} Response
     */
    this._callWebService = function(request, serviceName) {
        const separator = this._serverUrl.indexOf("?") === -1 ? '?' : '&';
        const serverUrlJson = `${this._serverUrl}${separator}protocol=JSON`;
        const rpcRequest = {
            "method": serviceName,
            "id": "1",
            "params": [request],
            "jsonrpc": "2.0"
        };
        const rawRequest = JSON.stringify(rpcRequest);
        const rawResponse = app.jsonRequest(serverUrlJson, rawRequest);
        try {
            const rpcResponse = JSON.parse(rawResponse);
            this._logHttpTraffic(serverUrlJson, rpcRequest, rpcResponse);
            return rpcResponse.result;
        } catch (SyntaxError) {
            this._logger.error("Could not parse response: {}", rawResponse);
            const { StudioServerCommunicationError } = require('./Errors.js');
            throw new StudioServerCommunicationError();
        }
    };

    /**
     * Log the URL, request JSON-RPC body and response JSON-RPC body.
     * @param {string} serverUrlJson
     * @param {Object} rpcRequest 
     * @param {Object} rpcResponse 
     */
    this._logHttpTraffic = function(serverUrlJson, rpcRequest, rpcResponse) {
        if (!this._logNetworkTraffic) {
            return;
        }
        const dottedLine = "- - - - - - - - - - - - - - - - - - - - - - -";
        this._logger.debug(
            `Network traffic:\n${dottedLine}\n${serverUrlJson}\nRequest:\n`
            + `${JSON.stringify(rpcRequest, null, 3)}\n`
            + `${dottedLine}\nResponse:\n`
            + `${JSON.stringify(rpcResponse, null, 3)}\n`
            + dottedLine);
    }

    /**
     * Calls the QueryObjects service in paged manner until all objects are retrieved.
     * @param {Array<Object>} searchParams List of QueryParam objects.
     * @param {Array<string>} resolveProperties List of workflow object property names to resolve.
     * @param {CallableFunction} callbackObjectsResolved This function is called for each page of retrieved objects.
     */
    this.queryObjects = async function(searchParams, resolveProperties, callbackObjectsResolved) {
        let firstEntry = 1;
        let queryCount = 0; 
        const maxQueryHit = 100; // paranoid prevention of endless loops
        let response = null;
        do {
            queryCount++;
            this._logger.info(`Running QueryObjects page#${queryCount}...`);
            response = await this._queryObjectsOneResultPage(
                searchParams, resolveProperties, firstEntry);
            // firstEntry = response.FirstEntry + response.ListedEntries;
            //  L> Assumed is that the status of a processed layout is changed; Hence it does NOT page
            //     the results because processed layouts already disappear from the search results.
            const wflObjects = this._getObjectsFromQueryObjectsResponse(response, resolveProperties);
            if (wflObjects.length > 0) {
                await callbackObjectsResolved(wflObjects);
            }
        } while (response.ListedEntries > 0 && queryCount < maxQueryHit);
        if (queryCount === maxQueryHit) {
            const { PrintLayoutAutomationError } = require('./Errors.js');
            throw new PrintLayoutAutomationError(`Too many QueryObjects executed: ${maxQueryHit}.`);
        }
    };

    /**
     * Calls the QueryObjects service.
     * @param {Array<Object>} searchParams List of QueryParam objects.
     * @param {Array<string>} resolveProperties List of workflow object property names to resolve.
     * @param {number} firstEntry Object index to start reading from (in paged results).
     * @returns {Object} QueryObjectsResponse
     */
    this._queryObjectsOneResultPage = async function(searchParams, resolveProperties, firstEntry) {
        const startsWithProps = ['ID', 'Type', 'Name']; // service rule: must start with this sequence of props
        if( !startsWithProps.every((value, index) => resolveProperties[index] === value) ) {
            const { ArgumentError } = require('./Errors.js');
            throw new ArgumentError("The 'resolveProperties' param should start with 'ID', 'Name' and 'Type' values.");
        }
        const request = {
            "Ticket": this._ticket,
            "Params": searchParams,
            "FirstEntry": firstEntry,
            "MaxEntries": 25,
            "RequestProps": resolveProperties,
            "Order": [{ Property: "ID", Direction: true, __classname__: "QueryOrder" }], // oldest first
        };
        const response = this._callWebService(request, "QueryObjects");
        return response;
    };

    /**
     * Build a list of workflow objects from the Columns and Rows of a given QueryObjectsResponse.
     * @param {Object} response 
     * @param {Array<string>} resolveProperties Names of workflow object properties to expect.
     * @returns {Array<Object>} List of resolved objects, each having the properties assigned.
     */
    this._getObjectsFromQueryObjectsResponse = function(response, resolveProperties) {
        const wflObjects = [];
        const columnIndexes = new Map()
        for (var columnIndex = 0; columnIndex < response.Columns.length; columnIndex++) {
            const columnName = response.Columns[columnIndex].Name;
            if (resolveProperties.includes(columnName)) {
                columnIndexes.set(columnName, columnIndex);
            }
        }
        for (var rowIndex = 0; rowIndex < response.Rows.length; rowIndex++) {
            let wflObject = {};
            for (const property of resolveProperties) {
                wflObject[property] = response.Rows[rowIndex][columnIndexes.get(property)]
            }
            wflObjects.push(wflObject);
        }
        return wflObjects;
    }

    /**
     * Call the MultiSetObjectProperties service to move objects to another status.
     * @param {string} status
     * @param {Array<string>} objectIds 
     */
    this.sendObjectsToStatus = function(objectIds, statusId) {
        const request = {
            Ticket: this._ticket,
            IDs: objectIds,
            MetaData: [{
                Property: "StateId",
                PropertyValues: [{
                    Value: statusId,
                    __classname__: "PropertyValue"
                }],
                __classname__: "MetaDataValue"
            }]
        }
        this._callWebService(request, "MultiSetObjectProperties");
    }
}

module.exports = StudioJsonRpcClient;