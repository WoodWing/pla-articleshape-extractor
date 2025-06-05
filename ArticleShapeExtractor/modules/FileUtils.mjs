class FileUtils {

    /**
     * Creates a subfolder under a given parent folder. Returns the subfolder if already exists.
     * @param {Folder} parentFolder
     * @param {string} subfolderName
     * @returns {{entry: Folder, created: boolean}}
     */
    async getOrCreateSubFolder(parentFolder, subfolderName) {
        try {
            return {entry: await parentFolder.getEntry(subfolderName), created: false};
        } catch (e) {
            return {entry: await parentFolder.createFolder(subfolderName, { overwrite: false }), created: true};
        }
    }

    /**
     * Creates a file in a given folder. Returns the file if already exists.
     * @param {Folder} folder 
     * @param {string} filename 
     * @returns {{entry: File, created: boolean}}
     */
    async getOrCreateFile(folder, filename) {
        try {
            return {entry: await folder.getEntry(filename), created: false};
        } catch (e) {
            return {entry: await folder.createFile(filename, { overwrite: false }), created: true};
        }
    }    
}

module.exports = FileUtils;