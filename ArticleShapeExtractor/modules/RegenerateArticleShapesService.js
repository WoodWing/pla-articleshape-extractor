const { app } = require("indesign");
const idd = require("indesign");

/**
 * Understands the batch wise process of opening layouts to (re)extract all placed article shapes from them.
 * 
 * @constructor
 * @param {Logger} logger
 * @param {VersionUtils} versionUtils
 * @param {{{brand: <string>, issue: <string>, category: <string>, status: <string>}, layoutStatusOnSuccess: <string>, layoutStatusOnError: <string>}} settings
 * @param {ExportInDesignArticlesToFolder} exportInDesignArticlesToFolder
 * @param {boolean} logNetworkTraffic
 */
function RegenerateArticleShapesService(logger, versionUtils, settings, exportInDesignArticlesToFolder, logNetworkTraffic) {
    this._logger = logger;
    this._versionUtils = versionUtils;
    this._settings = settings;
    this._exportInDesignArticlesToFolder = exportInDesignArticlesToFolder;
    this._logNetworkTraffic = logNetworkTraffic;

    /**
     * Run the pre-configured Used Query to make an inventory of the layouts to be processed. The layouts are
     * opened (and closed) one-by-one and the placed article shape files are extracted to the given folder.
     * When a shape files already exist for a certain layout id and version, that layout is skipped for performance 
     * optimization. All processed layouts (regardless whether skipped) are sent to their next status in the workflow.
     * @param {Folder} folder 
     */
    this.run = async function(folder) {

        // Bail out when user is currently not logged in.
        if (!app.entSession || app.entSession.activeServer === '' || app.entSession.activeUser === '') {
            const { NoStudioSessionError } = require('./Errors.js');
            throw new NoStudioSessionError();
        }

        // Build a layout id-version map from the JSON files that have been extracted before into the folder.
        const fileMap = await this._buildMapOfLayoutIdsVersionsAndFiles(folder);

        // Run QueryObjects to filter layouts, and for each page of search results, let callback process them.
        const resolveProperties = [ "ID", "Type", "Name", "Version" ];
        const queryParams = this._composeQueryParams();
        await this._queryObjects(
            queryParams, 
            resolveProperties, 
            (wflObjects) => this._processQueriedLayouts(wflObjects, fileMap, folder)
        );
    };

    /**
     * Process queried layout objects, compare against disk state, export if needed.
     * @param {Array} wflObjects Workflow layout objects.
     * @param {Map<string,{layoutVersion:string,shapeFiles:Array<File>}>} fileMap Indexed by layout ids.
     * @param {Folder} folder Target folder for exporting.
     */
    this._processQueriedLayouts = async function (wflObjects, fileMap, folder) {
        const extractedLayoutIds = [];
        const skippedLayoutIds = [];
        const failedLayoutIds = [];
        for (const wflObject of wflObjects) {
            //this._logger.debug('QueryObjects resolved object: {}', JSON.stringify(wflObject, null, 4));
            const mapItem = fileMap.get(wflObject.ID);
            if (mapItem && mapItem.layoutVersion === wflObject.Version) {
                this._logger.info(`Skipped extracting InDesign Articles for layout '${wflObject.Name}'; ` + 
                    `Article Shapes (JSON files) for layout id ${wflObject.ID} with version ${wflObject.Version} ` +
                    'already exists in export folder.');
                skippedLayoutIds.push(wflObject.ID);
            } else {
                // If query has newer layout version, remove files of old version from disk.
                if (mapItem) for (const oldFile of mapItem.files) {
                    await this._deleteFile(oldFile);
                }
                const theOpenDoc = app.openObject(wflObject.ID, false); // false: no checkout
                const shapeCount = await this._exportInDesignArticlesToFolder.run(theOpenDoc, folder);
                theOpenDoc.close(idd.SaveOptions.no);
                if (shapeCount > 0) {
                    extractedLayoutIds.push(wflObject.ID);
                } else { // no article shapes extracted means error; this layout has nothing for us
                    failedLayoutIds.push(wflObject.ID);
                }
            }
            if (mapItem) { // Remove item from map to mark it as handled.
                fileMap.delete(wflObject.ID);
            }
        }
        const handledLayoutIds = [...extractedLayoutIds, ...skippedLayoutIds];
        if (handledLayoutIds) {
            this._sendObjectsToStatus(handledLayoutIds, this._settings.layoutStatusOnSuccess);
        }
        if (failedLayoutIds) {
            this._sendObjectsToStatus(failedLayoutIds, this._settings.layoutStatusOnError);
        }
    }

    /**
     * Collect article shape files from a given folder and build a structure map.
     * Those files assumed to have a postfix "(<layout_id>.v<major>.<minor>).".
     * @param {Folder} folder 
     * @returns {Promise<Map<string,{layoutVersion:<string>,shapeFiles:Array<File>}>>} Structured map, indexed by layout id.
     */
    this._buildMapOfLayoutIdsVersionsAndFiles = async function (folder) {
        const shapeFiles = await this._filterArticleShapeFiles(folder);
        //this._logger.info('Resolved layouts from files: {}', JSON.stringify(Object.fromEntries(shapeFiles), null, 4));
        const fileMap = new Map();
        for (const { shapeFile: shapeFile, layoutId, layoutVersion } of shapeFiles) {
            const mapItem = fileMap.get(layoutId);
            if (!mapItem) {
                fileMap.set(layoutId, {layoutVersion: layoutVersion, shapeFiles: [shapeFile]});
                continue;
            }
            // Only allow one version per layout. Assure that version is the latest.
            // Compare the file version against the version tracked in the map.
            switch (this._versionUtils.versionCompare(layoutVersion, mapItem.layoutVersion)) {
                case 0: // File on disk has same version.
                    mapItem.shapeFiles.push(shapeFile);
                    break;
                case 1: // File on disk is newer.
                    for (const oldFile of mapItem.shapeFiles) {
                         await this._deleteFile(oldFile);
                    }
                    mapItem.shapeFiles = [shapeFile];
                    mapItem.layoutVersion = layoutVersion;
                    break;
                case -1: // File on disk is older.
                    await this._deleteFile(shapeFile);
                    break;
            }
        }
        //this._logger.info('Resolved layouts from files: {}', JSON.stringify(Object.fromEntries(fileMap), null, 4));
        return fileMap;
    }

    /**
     * Return a list of article shape files (from the given folder) having postfix "(<layout_id>.v<major>.<minor>).".
     * @param {Folder} folder
     * @returns {Promise<Array<{shapeFile: File, layoutId: string, layoutVersion: string}>>}
     */
    this._filterArticleShapeFiles = async function (folder) {
        const entriesInFolder = await folder.getEntries();
        const filesInFolder = entriesInFolder.filter(entry => entry.isFile);
        const result = [];
        for (const shapeFile of filesInFolder) {
            const match = this._extractLayoutIdAndVersionFromFilename(shapeFile.name);
            if (!match) {
                continue;
            }
            const [layoutId, layoutVersion] = match;
            result.push({ shapeFile, layoutId, layoutVersion });
        }
        return result;
    };    

    /**
     * Extract the layout id and version from a filename with postfix "(<layout_id>.v<major>.<minor>).".
     * @param {string} filename
     * @returns {[string, string] | null} Tuple of [layoutId, version] if matching postfix, null otherwise.
     */
    this._extractLayoutIdAndVersionFromFilename = function(filename) {
        const filenameRegex = /\(([^)]+)\.v(\d+)\.(\d+)\)\./;
        const match = filename.match(filenameRegex);
        if (!match) {
            return null;
        }
        const layoutId = match[1];
        const layoutVersion = `${match[2]}.${match[3]}`;
        return [layoutId, layoutVersion];
    }

    /**
     * Remove a file from disk. Log warning on failure.
     * @param {File} file 
     */
    this._deleteFile = async function(file) {
        this._logger.debug(`Deleting file: ${file.name}`);
        try {
            await file.delete();
        } catch (err) {
            this._logger.warning(`Failed to delete file: ${file.name}`, err);
        }
    }

    /**
     * Use the local filter settings to compose search params (applicable to the QueryObjects workflow service).
     * @returns {Array<{Property: string, Operation: string, Value: string, __classname__: string}>} List of QueryParam objects.
     */
    this._composeQueryParams = function() {
        // Map the local filter settings onto the workflow object property names.
        const settingToProperty = { brand: "Publication", issue: "Issue", category: "Category", status: "State" };
        const queryParams = [];
        for (const setting in settingToProperty) {
            if (settingToProperty.hasOwnProperty(setting)) {
                if (setting === 'issue' && this._settings.filter[setting].length === 0) {
                    continue; // the issue filter can be left empty, which refers to 'all' issues
                }
                const queryParam = this._composeQueryParam(
                    settingToProperty[setting], 
                    "=", 
                    this._settings.filter[setting]);
                queryParams.push(queryParam);
            }
        }
        queryParams.push(this._composeQueryParam("Type", "=", "Layout"));
        return queryParams;
    };

    /**
     * Compose a QueryParam data object (applicable to the QueryObjects workflow service).
     * @param {string} property 
     * @param {string} operation 
     * @param {string} value 
     * @returns {{Property: string, Operation: string, Value: string, __classname__: string}} QueryParam object.
     */
    this._composeQueryParam = function(property, operation, value) {
        return {
            Property: property,
            Operation: operation,
            Value: value,
            __classname__: "QueryParam",
        } 
    }

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
        this._logHttpTraffic(serverUrlJson, rpcRequest, rpcResponse);
        return rpcResponse.result;
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
            //  L> Assumed is that the status of a processed layout is changed; Hence it does NOT page
            //     the results because processed layouts already disappear from the search results.
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
        const request = {
            "Params": searchParams,
            "FirstEntry": firstEntry,
            "MaxEntries": 25,
            "RequestProps": resolveProperties,
            "Order": [{ Property: "ID", Direction: true, __classname__: "QueryOrder" }], // oldest first
            "Ticket": app.entSession.activeTicket
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
    this._sendObjectsToStatus = function(objectIds, statusId) {
        const request = {
            Ticket: app.entSession.activeTicket,
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

module.exports = RegenerateArticleShapesService;