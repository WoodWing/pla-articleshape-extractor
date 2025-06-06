const { app } = require("indesign");
const idd = require("indesign");

/**
 * Understands the batch wise process of opening layouts to (re)extract all placed article shapes from them.
 */
class RegenerateArticleShapesService {

    /** @type {Logger} */
    #logger;
    
    /** @type {VersionUtils} */
    #versionUtils;
    
    /** @type {{{brand: <string>, issue: <string>, category: <string>, status: <string>}, layoutStatusOnSuccess: <string>, layoutStatusOnError: <string>}} */
    #settings;
    
    /** @type {ExportInDesignArticlesToFolder} */
    #exportInDesignArticlesToFolder;
    
    /** @type {StudioJsonRpcClient} */
    #studioJsonRpcClient;
    
    /** @type {string|null} */
    #layoutStatusIdOnSuccess;
    
    /** @type {string|null} */
    #layoutStatusIdOnError;

    /**
     * @param {Logger} logger
     * @param {VersionUtils} versionUtils
     * @param {{{brand: <string>, issue: <string>, category: <string>, status: <string>}, layoutStatusOnSuccess: <string>, layoutStatusOnError: <string>}} settings
     * @param {ExportInDesignArticlesToFolder} exportInDesignArticlesToFolder
     * @param {StudioJsonRpcClient} studioJsonRpcClient
     */
    constructor(logger, versionUtils, settings, exportInDesignArticlesToFolder, studioJsonRpcClient) {
        this.#logger = logger;
        this.#versionUtils = versionUtils;
        this.#settings = settings;
        this.#exportInDesignArticlesToFolder = exportInDesignArticlesToFolder;
        this.#studioJsonRpcClient = studioJsonRpcClient;
        this.#layoutStatusIdOnSuccess = null;
        this.#layoutStatusIdOnError = null;
    }

    /**
     * Run the pre-configured Used Query to make an inventory of the layouts to be processed. The layouts are
     * opened (and closed) one-by-one and the placed article shape files are extracted to the given folder.
     * When a shape files already exist for a certain layout id and version, that layout is skipped for performance 
     * optimization. All processed layouts (regardless whether skipped) are sent to their next status in the workflow.
     * @param {Folder} folder 
     */
    async run(folder) {

        // Bail out when user is currently not logged in.
        if (!this.#studioJsonRpcClient.hasSession() ) {
            const { NoStudioSessionError } = require('./Errors.mjs');
            throw new NoStudioSessionError();
        }

        // Build a layout id-version map from the JSON files that have been extracted before into the folder.
        const fileMap = await this.#buildMapOfLayoutIdsVersionsAndFiles(folder);

        // Run QueryObjects to filter layouts, and for each page of search results, let callback process them.
        const report = { extracted: 0, skipped: 0, failed: 0 };
        const resolveProperties = [ "ID", "Type", "Name", "Version", "PublicationId" ];
        const queryParams = this.#composeQueryParams();
        await this.#studioJsonRpcClient.queryObjects(
            queryParams, 
            resolveProperties, 
            (wflObjects) => this.#processQueriedLayouts(wflObjects, fileMap, folder, report)
        );
        return report;
    };

    /**
     * Process queried layout objects, compare against disk state, export if needed.
     * @param {Array<Object>} wflObjects Workflow layout objects.
     * @param {Map<string,{layoutVersion:string,shapeFiles:Array<File>}>} fileMap Indexed by layout ids.
     * @param {Folder} folder Target folder for exporting.
     * @param {{extracted: number, skipped: number, failed: number}} report
     */
    async #processQueriedLayouts(wflObjects, fileMap, folder, report) {
        const extractedLayoutIds = [];
        const skippedLayoutIds = [];
        const failedLayoutIds = [];
        for (const wflObject of wflObjects) {
            //this.#logger.debug('QueryObjects resolved object: {}', JSON.stringify(wflObject, null, 4));
            this.#resolveLayoutStatusIds(wflObject.PublicationId);
            const mapItem = fileMap.get(wflObject.ID);
            if (mapItem && mapItem.layoutVersion === wflObject.Version) {
                this.#logger.info(`Skipped extracting InDesign Articles for layout '${wflObject.Name}'; ` + 
                    `Article Shapes (JSON files) for layout id ${wflObject.ID} with version ${wflObject.Version} ` +
                    'already exists in export folder.');
                skippedLayoutIds.push(wflObject.ID);
            } else {
                // If query has newer layout version, remove files of old version from disk.
                if (mapItem) for (const oldFile of mapItem.shapeFiles) {
                    await this.#deleteFile(oldFile);
                }
                const theOpenDoc = app.openObject(wflObject.ID, false); // false: no checkout
                const shapeCount = await this.#exportInDesignArticlesToFolder.run(theOpenDoc, folder);
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
        if (handledLayoutIds.length > 0) {
            this.#studioJsonRpcClient.sendObjectsToStatus(handledLayoutIds, this.#layoutStatusIdOnSuccess);
        }
        if (failedLayoutIds.length > 0) {
            this.#studioJsonRpcClient.sendObjectsToStatus(failedLayoutIds, this.#layoutStatusIdOnError);
        }
        report.extracted += extractedLayoutIds.length;
        report.skipped += skippedLayoutIds.length;
        report.failed += failedLayoutIds.length;
    }

    /**
     * @param {string} brandId 
     */
    #resolveLayoutStatusIds(brandId) {
        if (this.#layoutStatusIdOnSuccess !== null && this.#layoutStatusIdOnError !== null) {
            return;
        }
        const publicationInfos = this.#studioJsonRpcClient.getPublicationInfos([brandId], ["States"]);
        const publicationInfo = publicationInfos.find(pub => pub.Id === brandId);
        const layoutStatuses = publicationInfo.States.filter(state => state.Type === "Layout");
        for (const layoutStatus of layoutStatuses) {
            if (layoutStatus.Name === this.#settings.layoutStatusOnSuccess) {
                this.#layoutStatusIdOnSuccess = layoutStatus.Id;
            } else if (layoutStatus.Name === this.#settings.layoutStatusOnError) {
                this.#layoutStatusIdOnError = layoutStatus.Id;
            }
        }
        if (this.#layoutStatusIdOnSuccess === null) {
            this.#raiseStatusConfigError(this.#settings.layoutStatusOnSuccess);
        }
        if (this.#layoutStatusIdOnError === null) {
            this.#raiseStatusConfigError(this.#settings.layoutStatusOnError);
        }
    }

    /**
     * Informs the status name in local config file is not setup for the brand.
     * @param {string} statusName 
     */
    #raiseStatusConfigError(statusName) {
        const { ConfigurationError } = require('./Errors.mjs');
        const message = `\nStatus '${statusName}' seems not configured for `
            + `brand '${this.#settings.filter.brand}'.\n`
            + "Please check the 'regenerateArticleShapesSettings' option "
            + "in your 'config/config.js' or 'config/config-local.js' file.";
        throw new ConfigurationError(message);        
    }

    /**
     * Collect article shape files from a given folder and build a structure map.
     * Those files assumed to have a postfix "(<layout_id>.v<major>.<minor>).".
     * @param {Folder} folder 
     * @returns {Promise<Map<string,{layoutVersion:<string>,shapeFiles:Array<File>}>>} Structured map, indexed by layout id.
     */
    async #buildMapOfLayoutIdsVersionsAndFiles(folder) {
        const shapeFiles = await this.#filterArticleShapeFiles(folder);
        //this.#logger.info('Resolved layouts from files: {}', JSON.stringify(Object.fromEntries(shapeFiles), null, 4));
        const fileMap = new Map();
        for (const { shapeFile: shapeFile, layoutId, layoutVersion } of shapeFiles) {
            const mapItem = fileMap.get(layoutId);
            if (!mapItem) {
                fileMap.set(layoutId, {layoutVersion: layoutVersion, shapeFiles: [shapeFile]});
                continue;
            }
            // Only allow one version per layout. Assure that version is the latest.
            // Compare the file version against the version tracked in the map.
            switch (this.#versionUtils.versionCompare(layoutVersion, mapItem.layoutVersion)) {
                case 0: // File on disk has same version.
                    mapItem.shapeFiles.push(shapeFile);
                    break;
                case 1: // File on disk is newer.
                    for (const oldFile of mapItem.shapeFiles) {
                         await this.#deleteFile(oldFile);
                    }
                    mapItem.shapeFiles = [shapeFile];
                    mapItem.layoutVersion = layoutVersion;
                    break;
                case -1: // File on disk is older.
                    await this.#deleteFile(shapeFile);
                    break;
            }
        }
        //this.#logger.info('Resolved layouts from files: {}', JSON.stringify(Object.fromEntries(fileMap), null, 4));
        return fileMap;
    }

    /**
     * Return a list of article shape files (from the given folder) having postfix "(<layout_id>.v<major>.<minor>).".
     * @param {Folder} folder
     * @returns {Promise<Array<{shapeFile: File, layoutId: string, layoutVersion: string}>>}
     */
    async #filterArticleShapeFiles(folder) {
        const entriesInFolder = await folder.getEntries();
        const filesInFolder = entriesInFolder.filter(entry => entry.isFile);
        const result = [];
        for (const shapeFile of filesInFolder) {
            const match = this.#extractLayoutIdAndVersionFromFilename(shapeFile.name);
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
    #extractLayoutIdAndVersionFromFilename(filename) {
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
    async #deleteFile(file) {
        this.#logger.debug(`Deleting file: ${file.name}`);
        try {
            await file.delete();
        } catch (err) {
            this.#logger.warning(`Failed to delete file: ${file.name}`, err);
        }
    }

    /**
     * Use the local filter settings to compose search params (applicable to the QueryObjects workflow service).
     * @returns {Array<{Property: string, Operation: string, Value: string, __classname__: string}>} List of QueryParam objects.
     */
    #composeQueryParams() {
        // Map the local filter settings onto the workflow object property names.
        const settingToProperty = { brand: "Publication", issue: "Issue", category: "Category", status: "State" };
        const queryParams = [];
        for (const setting in settingToProperty) {
            if (settingToProperty.hasOwnProperty(setting)) {
                if (['issue', 'category'].includes(setting) 
                    && this.#settings.filter[setting].length === 0) {
                    continue; // these filters can be left empty, which refers to 'all'
                }
                const queryParam = this.#composeQueryParam(
                    settingToProperty[setting], 
                    "=", 
                    this.#settings.filter[setting]);
                queryParams.push(queryParam);
            }
        }
        queryParams.push(this.#composeQueryParam("Type", "=", "Layout"));
        return queryParams;
    };

    /**
     * Compose a QueryParam data object (applicable to the QueryObjects workflow service).
     * @param {string} property 
     * @param {string} operation 
     * @param {string} value 
     * @returns {{Property: string, Operation: string, Value: string, __classname__: string}} QueryParam object.
     */
    #composeQueryParam(property, operation, value) {
        return {
            Property: property,
            Operation: operation,
            Value: value,
            __classname__: "QueryParam",
        } 
    }
}

module.exports = RegenerateArticleShapesService;