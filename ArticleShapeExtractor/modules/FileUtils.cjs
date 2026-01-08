class FileUtils {

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
}

module.exports = FileUtils;
