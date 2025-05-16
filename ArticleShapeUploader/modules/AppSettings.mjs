/**
 * Understands how to merge the local settings into the default settings.
 * Provides a getter function for each individual setting.
 */
export class AppSettings {

    /**
     * @constructor
     * @param {Object} defaultConfig Factory default settings.
     * @param {Object} localConfig Local override settings.
     */
    constructor(defaultConfig, localConfig) {
        this._configData = this._deepMerge(defaultConfig, localConfig);
    }

    _deepMerge(defaultData, localData) {
        let merged = {};
        for (let key in defaultData) {
            if (defaultData.hasOwnProperty(key)) {
                merged[key] = defaultData[key];
            }
        }
        for (let key in localData) {
            if (localData.hasOwnProperty(key)) {
                if (typeof localData[key] === "object" && typeof defaultData[key] === "object") {
                    merged[key] = this._deepMerge(defaultData[key], localData[key]);
                } else {
                    merged[key] = localData[key];
                }
            }
        }
        return merged;
    }

    getPlaServiceUrl() { return this._configData.plaServiceUrl; }
    getDestination() { return this._configData.destination; }
    getGrid() { return this._configData.grid; }
    getElementLabels() { return this._configData.elementLabels; }
    getLogNetworkTraffic() { return this._configData.logNetworkTraffic; }
    getLogLevel() { return this._configData.logLevel; }
}