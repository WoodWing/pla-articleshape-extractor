class PreferencesManager {

    /** @type {Object} */
    #appPreferences;

    /**
     * @param {Object} appPreferences 
     */
    constructor(appPreferences) {
        this.#appPreferences = appPreferences;
    }

    /**
     * @param {Object} updates Preferences to adjust.
     * @returns {Object} Original preferences.
     */
    overridePreferences(updates) {
        originalPreferences = {};
        for (const key in updates) {
            originalPreferences[key] =  this.#appPreferences[key];
            this.#appPreferences[key] = updates[key]; 
        }
        return originalPreferences;
    };

    /**
     * @param {Object} originalPreferences
     */
    restoreOriginalPreferences(originalPreferences) {
        for (const key in originalPreferences) {
            this.#appPreferences[key] = originalPreferences[key];
        }
    };
}

module.exports = PreferencesManager;