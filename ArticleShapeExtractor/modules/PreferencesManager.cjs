class PreferencesManager {

    /** @type {IDD.Preference} */
    #appPreferences;

    /**
     * @param {IDD.Preference} appPreferences
     */
    constructor (appPreferences) {
        this.#appPreferences = appPreferences;
    }

    /**
     * @param {IDD.Preference} updates Preferences to adjust.
     * @returns {IDD.Preference} Original preferences.
     */
    overridePreferences (updates) {
        const originalPreferences = {};
        for (const key in updates) {
            originalPreferences[key] =  this.#appPreferences[key];
            this.#appPreferences[key] = updates[key];
        }
        return originalPreferences;
    };

    /**
     * @param {IDD.Preference} originalPreferences
     */
    restoreOriginalPreferences (originalPreferences) {
        for (const key in originalPreferences) {
            this.#appPreferences[key] = originalPreferences[key];
        }
    };
}

module.exports = PreferencesManager;
