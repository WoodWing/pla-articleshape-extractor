/**
 * Understands the syntax of a version string.
 * 
 * @constructor
 */
function VersionUtils() {

    /**
     * Compare two versions.
     * @param {String} versionLhs Left Hand Side.
     * @param {String} versionRhs Right Hand Side.
     * @returns {Number} Zero when equal, or -1 when versionLhs is smaller or 1 when bigger.
     */
    this.versionCompare = function(versionLhs, versionRhs) {
        const digitsLhs = versionLhs.split('.').map(Number);
        const digitsRhs = versionRhs.split('.').map(Number);
        const length = Math.max(digitsLhs.length, digitsRhs.length);
        for (let i = 0; i < length; i++) {
            const digitLhs = i < digitsLhs.length ? digitsLhs[i] : 0;
            const digitRhs = i < digitsRhs.length ? digitsRhs[i] : 0;
            if (digitLhs > digitRhs) return 1;
            if (digitRhs > digitLhs) return -1;
        }
        return 0;
    }
}

module.exports = VersionUtils;