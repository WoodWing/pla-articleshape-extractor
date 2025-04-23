function PreferencesManager(appPreferences) {
    this._appPreferences = appPreferences;

    /**
     * @param {object} updates Preferences to adjust.
     * @returns {object} Original preferences.
     */
    this.overridePreferences = function (updates) {
        originalPreferences = {};
        for (const key in updates) {
            originalPreferences[key] =  this._appPreferences[key];
            this._appPreferences[key] = updates[key]; 
        }
        return originalPreferences;
    };

    /**
     * @param {object} originalPreferences
     */
    this.restoreOriginalPreferences = function (originalPreferences) {
        for (const key in originalPreferences) {
            this._appPreferences[key] = originalPreferences[key];
        }
    };
}

module.exports = PreferencesManager;