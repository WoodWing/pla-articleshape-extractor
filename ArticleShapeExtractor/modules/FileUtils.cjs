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
     * @returns {Promise<UXP.storage.Folder>}
     */
    async getTempFolder () {
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
