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
 * @param {StudioJsonRpcClient} studioJsonRpcClient
 */
function RegenerateArticleShapesService(logger, versionUtils, settings, exportInDesignArticlesToFolder, studioJsonRpcClient) {
    this._logger = logger;
    this._versionUtils = versionUtils;
    this._settings = settings;
    this._exportInDesignArticlesToFolder = exportInDesignArticlesToFolder;
    this._studioJsonRpcClient = studioJsonRpcClient;

    /**
     * Run the pre-configured Used Query to make an inventory of the layouts to be processed. The layouts are
     * opened (and closed) one-by-one and the placed article shape files are extracted to the given folder.
     * When a shape files already exist for a certain layout id and version, that layout is skipped for performance 
     * optimization. All processed layouts (regardless whether skipped) are sent to their next status in the workflow.
     * @param {Folder} folder 
     */
    this.run = async function(folder) {

        // Bail out when user is currently not logged in.
        if (!this._studioJsonRpcClient.hasSession() ) {
            const { NoStudioSessionError } = require('./Errors.js');
            throw new NoStudioSessionError();
        }

        // Build a layout id-version map from the JSON files that have been extracted before into the folder.
        const fileMap = await this._buildMapOfLayoutIdsVersionsAndFiles(folder);

        // Run QueryObjects to filter layouts, and for each page of search results, let callback process them.
        const resolveProperties = [ "ID", "Type", "Name", "Version" ];
        const queryParams = this._composeQueryParams();
        await this._studioJsonRpcClient.queryObjects(
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
            this._studioJsonRpcClient.sendObjectsToStatus(handledLayoutIds, this._settings.layoutStatusOnSuccess);
        }
        if (failedLayoutIds) {
            this._studioJsonRpcClient.sendObjectsToStatus(failedLayoutIds, this._settings.layoutStatusOnError);
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
                if (['issue', 'category'].includes(setting) 
                    && this._settings.filter[setting].length === 0) {
                    continue; // these filters can be left empty, which refers to 'all'
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
}

module.exports = RegenerateArticleShapesService;