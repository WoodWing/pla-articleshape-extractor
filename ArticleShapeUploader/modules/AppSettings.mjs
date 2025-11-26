/**
 * Understands how to merge the local settings into the default settings.
 * Provides a getter function for each individual setting.
 */
export class AppSettings {

    /** @type {Object} */
    #configData;
    
    /**
     * @param {Object} defaultConfig Factory default settings.
     * @param {Object} localConfig Local override settings.
     */
    constructor(defaultConfig, localConfig) {
        this.#configData = this.#deepMerge(defaultConfig, localConfig);
    }

    /**
     * Recursively merge two structural settings objects.
     * @param {Object} defaultData Default values.
     * @param {Object} localData Override values.
     * @returns {Object} Merged settings.
     */
    #deepMerge(defaultData, localData) {
        let merged = {};
        for (let key in defaultData) {
            if (defaultData.hasOwnProperty(key)) {
                merged[key] = defaultData[key];
            }
        }
        for (let key in localData) {
            if (localData.hasOwnProperty(key)) {
                if (typeof localData[key] === "object" && typeof defaultData[key] === "object") {
                    merged[key] = this.#deepMerge(defaultData[key], localData[key]);
                } else {
                    merged[key] = localData[key];
                }
            }
        }
        return merged;
    }

    /**
     * @returns {string}
     */
    getPlaServiceUrl() { 
        return this.#configData.plaServiceUrl; 
    }

    /**
     * @returns {boolean}
     */
    getLogNetworkTraffic() {
        return this.#configData.logNetworkTraffic; 
    }

    /**
     * @returns {string}
     */
    getLogLevel() {
        return this.#configData.logLevel;
    }

    /**
     * @returns {boolean}
     */    
    getEnforceServerSidePageLayoutSettings () {
        return this.#configData.enforceServerSidePageLayoutSettings;
    }
}
