/**
 * Understands how to merge the local settings into the default settings.
 * Provides a getter function for each individual setting.
 */
export class AppSettings {

    #configData;
    
    /**
     * @constructor
     * @param {Object} defaultConfig Factory default settings.
     * @param {Object} localConfig Local override settings.
     */
    constructor(defaultConfig, localConfig) {
        this.#configData = this.#deepMerge(defaultConfig, localConfig);
    }

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

    getPlaServiceUrl() { return this.#configData.plaServiceUrl; }
    getDestination() { return this.#configData.destination; }
    getLogNetworkTraffic() { return this.#configData.logNetworkTraffic; }
    getLogLevel() { return this.#configData.logLevel; }
}