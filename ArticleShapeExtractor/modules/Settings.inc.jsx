//@include "String.inc.jsx"; // trimEndChars

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
        var merged = {};
        for (var key in defaultData) {
            if (defaultData.hasOwnProperty(key)) {
                merged[key] = defaultData[key];
            }
        }
        for (var key in localData) {
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
     * @returns {String}
     */
    this.getPlaServiceUrl = function() {
        return this._configData.plaServiceUrl.trimEndChars('/')
    };

    /**
     * @returns {Object}
     */
    this.getFallbackBrand = function() {
        return this._configData.fallback.brand;
    }

    /**
     * @returns {Object}
     */
    this.getFallbackCategory = function() {
        return this._configData.fallback.category;
    }

    /**
     * @returns {String}
     */    
    this.getRegenerateArticleShapesQueryName = function() {
        return this._configData.regenerateArticleShapesQueryName;
    }
}