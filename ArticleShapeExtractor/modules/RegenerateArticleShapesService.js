const { app } = require("indesign");
const idd = require("indesign");
const fs = require("fs");

/**
 * @constructor
 * @param {Logger} logger
 * @param {String} userQueryName
 * @param {ExportInDesignArticlesToFolder} exportInDesignArticlesToFolder
 */
function RegenerateArticleShapesService(logger, userQueryName, exportInDesignArticlesToFolder) {
    this._logger = logger;
    this._userQueryName = userQueryName;
    this._exportInDesignArticlesToFolder = exportInDesignArticlesToFolder;

    /**
     * @param {Folder} folder 
     */
    this.run = async function(folder) {

        // Bail out when user is currently not logged in.
        if (!app.entSession || app.entSession.activeServer === '' || app.entSession.activeUser === '') {
            const { NoStudioSessionError } = require('./Errors.js');
            throw new NoStudioSessionError();
        }

        // Bail out when the user query is not configured.
        const searchParams = this._getUserNamedQuery(this._userQueryName);
        if (searchParams === null) {
            const { ConfigurationError } = require('./Errors.js');
            throw new ConfigurationError("User Query '" + this._userQueryName + "' does not exist.");
        }

        // Build a layout id-version map from the JSON files that have been extracted before into the folder.
        const fileMap = await this._buildLayoutIdVersionMapFromJsonFiles(folder);
        //this._logger.info('Resolved layouts from files: {}', JSON.stringify(Object.fromEntries(fileMap), null, 4));

        // Run QueryObjects, but with the search parameters defined by the User Query.
        // Note that this is a work-around because the app.storedUserQuery API does not return the layout 
        // properties we are looking for. And because the returned format is hard to parse and its columns
        // are not alined with the row fields (=bug).
        const resolveProperties = [
            "ID", "Type", "Name", "Version", 
            "PublicationId", "Publication", "CategoryId",  "Category", "StateId", "State"];
        await this._queryObjects(searchParams, resolveProperties, async (wflObjects) => {
            const layoutIds = [];
            for (const wflObject of wflObjects) {
                //this._logger.debug('QueryObjects resolved object: {}', JSON.stringify(wflObject, null, 4));
                if (fileMap.get(wflObject.ID) === wflObject.Version) {
                    this._logger.info(`Skipped extracting InDesign Articles for layout '${wflObject.Name}'; ` + 
                        `Article Shapes (JSON files) for layout id ${wflObject.ID} with version ${wflObject.Version} ` +
                        'already exists in export folder.');
                } else {
                    const theOpenDoc = app.openObject(wflObject.ID);
                    await this._exportInDesignArticlesToFolder.run(theOpenDoc, folder);
                    theOpenDoc.close(idd.SaveOptions.no);
                }
                layoutIds.push(wflObject.ID);
            }
            this._sendObjectsToNextStatus(layoutIds); // faster than calling app.sendObjectToNext individually
        });
    };

    /**
     * Searches for files with postfix: "(<layout_id>.v<major>.<minor>).json".
     * For each file found, the layout id and version are added to the map.
     * @param {Folder} folder 
     * @returns {Map<string,string>} Layout id-version mapping.
     */
    this._buildLayoutIdVersionMapFromJsonFiles = async function (folder) {
        const entries = await folder.getEntries();
        const allFiles = entries.filter(entry => entry.isFile);
        const map = new Map(); // objectId -> Map of version -> entry
        // 
        const filenameRegex = /\(([^)]+)\.v(\d+)\.(\d+)\)\.json$/;
        for (const file of allFiles) {
            if (!file.name.endsWith('.json')) {
                continue;
            }
            const match = file.name.match(filenameRegex);
            if (!match) {
                continue;
            }
            const objectId = match[1];
            const objectVersion = `${match[2]}.${match[3]}`;
            map.set(objectId, objectVersion);
        }
        return map;
    }

    /**
     * Retrieves a User Query definition from Studio Server.
     * In case of making manual changes to the User Query, it is required to re-login Studio for InDesign 
     * to let it save the user queries in Studio Server. (All queries are saved during the logout operation.)
     * @param {string} queryName 
     * @returns {Array<Object>|null} List of QueryParam objects when query found, null otherwise.
     */
    this._getUserNamedQuery = function(queryName) {
        for (const userSetting of this._getUserSettings()) {
            if (userSetting.Setting === `UserQuery3_${queryName}` ) {
                const queryParams = this._parseQueryParamsFromXml(userSetting.Value);
                //this._logger.debug(`Resolved params for User Query ${queryName}: {}`, JSON.stringify(queryParams, null, 4));
                return queryParams;
            }
        }
        return null;
    };

    /**
     * Parses a User Query definition in XML format.
     * @param {string} userQueryXml 
     * @returns {Array<Object>} List of QueryParam objects.
     */
    this._parseQueryParamsFromXml = function(userQueryXml) {
        const queryParamRegex = /<QueryParam>([\s\S]*?)<\/QueryParam>/g;
        const xmlTagValueRegex = /<(\w+)[^>]*>(.*?)<\/\1>/g;
        //const nilRegex = /<Special[^>]*xsi:nil="true"[^>]*\/>/;
        const queryParams = [];
        let match;
        while ((match = queryParamRegex.exec(userQueryXml)) !== null) {
            const xmlTagValue = match[1];
            const queryParam = {};
            let tagMatch;
            while ((tagMatch = xmlTagValueRegex.exec(xmlTagValue)) !== null) {
                const [, tag, value] = tagMatch;
                queryParam[tag] = value;
            }
            //item["Special"] = nilRegex.test(innerXml) ? null : "non-nil";
            queryParams.push(queryParam);
        }
        return queryParams;
    };

    /**
     * Retrieves the user settings from Studio Server.
     * @returns {Array<Object>} List of Setting objects.
     */
    this._getUserSettings = function() {
        const request = {
            "Ticket": app.entSession.activeTicket,
            "Settings": null
        }
        const response = this._callWebService(request, "GetUserSettings");
        //this._logger.debug('Resolved settings: {}', JSON.stringify(response, null, 4));
        return response.Settings;
    };

    /**
     * Calls a workflow service provided by Studio Server.
     * Uses the JSON-RPC communication protocol.
     * @param {Object} request
     * @param {string} serviceName
     * @returns {Object} Response
     */
    this._callWebService = function(request, serviceName) {
        const serverUrl = app.entSession.activeUrl;
        const separator = serverUrl.indexOf("?") === -1 ? '?' : '&';
        const serverUrlJson = `${serverUrl}${separator}protocol=JSON`;
        const rpcRequest = {
            "method": serviceName,
            "id": "1",
            "params": [request],
            "jsonrpc": "2.0"
        };
        const rawRequest = JSON.stringify(rpcRequest);
        const rawResponse = app.jsonRequest(serverUrlJson, rawRequest);
        const rpcResponse = JSON.parse(rawResponse);
        return rpcResponse.result;
    };

    /**
     * Calls the QueryObjects service in paged manner until all objects are retrieved.
     * @param {Array<Object>} searchParams List of QueryParam objects.
     * @param {Array<string>} resolveProperties List of workflow object property names to resolve.
     * @param {CallableFunction} callbackObjectsResolved This function is called for each page of retrieved objects.
     */
    this._queryObjects = async function(searchParams, resolveProperties, callbackObjectsResolved) {
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
            //  L> Assumed is that the status of a processed layout is changed, and that
            //     the User Query has a layout status in its filters. Then we should NOT page
            //     results because processed layouts already disappear from the search results.
            const wflObjects = this._getObjectsFromQueryObjectsResponse(response, resolveProperties);
            await callbackObjectsResolved(wflObjects);
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
        for (let i = 0; i < searchParams.length; i++ ) {
            searchParams[i].__classname__ = "QueryParam";
        }
        const request = {
            "Params": searchParams,
            "FirstEntry": firstEntry,
            "MaxEntries": 25,
            "RequestProps": resolveProperties,
            "Order": [{ Property: "ID", Direction: true, __classname__: "QueryOrder" }], // oldest first
            "Ticket": app.entSession.activeTicket
        };
        //this._logger.debug('QueryObjects request: {}', JSON.stringify(request, null, 4));
        const response = this._callWebService(request, "QueryObjects");
        //this._logger.debug('QueryObjects response: {}', JSON.stringify(response, null, 4));
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
     * Calls the MultiSetObjectProperties service in special manner to move objects to their next status.
     * @param {Array<string>} objectIds 
     */
    this._sendObjectsToNextStatus = function(objectIds) {
        const request = {
            Ticket: app.entSession.activeTicket,
            IDs: objectIds,
            MetaData: [{
                Property: "StateId",
                PropertyValues: [{
                    Value: "", // special meaning: move to Next Status
                    __classname__: "PropertyValue"
                }],
                __classname__: "MetaDataValue"
            }]
        }
        this._callWebService(request, "MultiSetObjectProperties");
    }
}

module.exports = RegenerateArticleShapesService;