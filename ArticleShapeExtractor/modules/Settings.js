/**
 * Understands how to merge the local settings into the default settings.
 * Provides a getter function for each individual setting.
 * 
 * @constructor
 * @param {Object} defaultConfig Factory default settings.
 * @param {Object} localConfig Local override settings.
 */
class Settings {
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
    };

    /**
     * @returns {Object}
     */
    getOfflineFallbackConfig() {
        return this._configData.offlineFallback;
    }

    /**
     * @returns {{{brand: string, issue: string, category: string, status: string}, layoutStatusOnSuccess: string, layoutStatusOnError: string}}
     */    
    getRegenerateArticleShapesSettings() {
        const { ConfigurationError } = require('./Errors.js');
        const settings = this._configData.regenerateArticleShapesSettings;
        const tip = "Please check your 'config/config.js' and your 'config/config-local.js' files.";
        for (const paramName of ["brand", "issue", "category", "status"]) {
            if (!settings.filter.hasOwnProperty(paramName) || typeof settings.filter[paramName] !== "string") {
                throw new ConfigurationError(`The regenerateArticleShapesSettings → filter → ${paramName} option is not set.\n${tip}`);
            }
            if (!["issue", "category"].includes(paramName) && settings.filter[paramName].length === 0) { // these filters may be left empty
                throw new ConfigurationError(`The regenerateArticleShapesSettings → filter → ${paramName} option is empty.\n${tip}`);
            }
        }
        const layoutStatusFilter = this._configData.regenerateArticleShapesSettings.filter;
        for (const setting of ["layoutStatusOnSuccess", "layoutStatusOnError"]) {
            if (!settings.hasOwnProperty(setting) || typeof settings[setting] !== "string" || settings[setting].length === 0) {
                throw new ConfigurationError(`The regenerateArticleShapesSettings → ${setting} option is not set.\n${tip}`);
            }
            if (layoutStatusFilter === settings[setting]) {
                throw new ConfigurationError(`The status configured for the regenerateArticleShapesSettings → ${setting} `
                    + `option should differ from the regenerateArticleShapesSettings → filter → status option.\n${tip}`);
            }
        }
        return this._configData.regenerateArticleShapesSettings;
    }

    /**
     * @returns {Object}
     */
    getLoggerConfig() {
        return this._configData.logger;
    }

    /**
     * @returns {boolean}
     */
    getLogNetworkTraffic() {
        return this._configData.logger.logNetworkTraffic;
    }
    
    /**
     * @returns {String}
     */
    getMinimumRequiredInDesignVersion() {
        return this._configData.minimumRequiredInDesignVersion;
    }
}

module.exports = Settings;