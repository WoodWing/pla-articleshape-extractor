class PreferencesManager {

    /**
     * @param {Object} appPreferences 
     */
    constructor(appPreferences) {
        this._appPreferences = appPreferences;
    }

    /**
     * @param {Object} updates Preferences to adjust.
     * @returns {Object} Original preferences.
     */
    overridePreferences(updates) {
        originalPreferences = {};
        for (const key in updates) {
            originalPreferences[key] =  this._appPreferences[key];
            this._appPreferences[key] = updates[key]; 
        }
        return originalPreferences;
    };

    /**
     * @param {Object} originalPreferences
     */
    restoreOriginalPreferences(originalPreferences) {
        for (const key in originalPreferences) {
            this._appPreferences[key] = originalPreferences[key];
        }
    };
}

module.exports = PreferencesManager;