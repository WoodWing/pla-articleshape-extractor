class FileUtils {

    /** @type {Logger} */
    #logger;


    /**
     * @param {Logger} logger
     */
    constructor (logger) {
        this.#logger = logger;
    }

    /**
     * Creates a subfolder under a given parent folder. Returns the subfolder if already exists.
     * @param {UXP.storage.Folder} parentFolder
     * @param {string} subfolderName
     * @returns {Promise<{entry: UXP.storage.Folder, created: boolean}>}
     */
    async getOrCreateSubFolder (parentFolder, subfolderName) {
        try {
            return { entry: await parentFolder.getEntry(subfolderName), created: false };
        }
        catch {
            return { entry: await parentFolder.createFolder(subfolderName, { overwrite: false }), created: true };
        }
    }

    /**
     * Creates a file in a given folder. Returns the file if already exists.
     * @param {UXP.storage.Folder} folder
     * @param {string} filename
     * @returns {Promise<{entry: UXP.storage.File, created: boolean}>}
     */
    async getOrCreateFile (folder, filename) {
        try {
            return { entry: await folder.getEntry(filename), created: false };
        }
        catch {
            return { entry: await folder.createFile(filename, { overwrite: false }), created: true };
        }
    }

    /**
     * Create or retrieve a folder in the temporary files location.
     * When called for the first time of the current script execution:
     * - it creates a new structure like 10000/PluginData
     * When called for succeeding times within the same current script execution:
     * - it provides the same folder as created before
     * When called in succeeding script executions:
     * - it creates a new structure like 10001/PluginData, 10002/PluginData, etc.
     * @returns {Promise<UXP.storage.Folder>}
     */
    async getOrCreateTempFolder () {
        /** @type {UXP.storage.FileSystemProvider} */
        const lfs = require("uxp").storage.localFileSystem;
        const tempFolder = await lfs.getTemporaryFolder();
        return tempFolder;
    }

    /**
     * @param {UXP.storage.Folder} folder
     */
    async deleteFolderRecursively (folder) {
        /** @type {UXP.storage.Entry[]} */
        const entries = await folder.getEntries();
        for (let tempEntry of entries) {
            if (tempEntry.isFile) {
                this.#logger.debug(`Removing file '${tempEntry.nativePath}'.`);
                await tempEntry.delete();
            }
            else if (tempEntry.isFolder) {
                const tempFolder = /** @type {UXP.storage.Folder} */(tempEntry);
                await this.deleteFolderRecursively(tempFolder);
            }
        }
        this.#logger.debug(`Removing folder '${folder.nativePath}'.`);
        await folder.delete();
    }
}

module.exports = FileUtils;
