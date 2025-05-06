/**
 * Understands how to merge the local settings into the default settings.
 * Provides a getter function for each individual setting.
 * 
 * @constructor
 * @param {Object} defaultConfig Factory default settings.
 * @param {Object} localConfig Local override settings.
 */
function Settings(defaultConfig, localConfig) {

    this._deepMerge = function(defaultData, localData) {
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

    this._configData = this._deepMerge(defaultConfig, localConfig);

    /**
     * @returns {Object}
     */
    this.getOfflineFallbackConfig = function() {
        return this._configData.offlineFallback;
    }

    /**
     * @returns {String}
     */    
    this.getRegenerateArticleShapesQueryName = function() {
        return this._configData.regenerateArticleShapesQueryName;
    }

    /**
     * @returns {Object}
     */
    this.getLoggerConfig = function() {
        return this._configData.logger;
    }
    
    /**
     * @returns {String}
     */
    this.getMinimumRequiredInDesignVersion = function() {
        return this._configData.minimumRequiredInDesignVersion;
    }
}

module.exports = Settings;