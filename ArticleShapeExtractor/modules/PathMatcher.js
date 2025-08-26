class PathMatcher {
    /**
     * Find the most specific matching pattern for a given path.
     *
     * @param {string[]} patterns - List of patterns (e.g. ["foo/bar/＊", "foo/＊/bar", "＊/foo/bar"])
     * @param {string} actualPath - The actual path (e.g. "foo/bar/baz")
     * @returns {string|null} - The most specific matching pattern, or null if none match
     */
    findBestMatch(patterns, actualPath) {
        const pathParts = actualPath.split("/");
        const matches = patterns
            .map(pattern => {
                const patternParts = pattern.split("/");
                if (patternParts.length !== pathParts.length) return null; // must have same depth

                for (let i = 0; i < pathParts.length; i++) {
                    if (patternParts[i] !== "*" && patternParts[i] !== pathParts[i]) {
                        return null;
                    }
                }

                // score = number of non-wildcard matches (higher = more specific)
                const score = patternParts.filter(p => p !== "*").length;

                return { pattern, score };
            })
            .filter(Boolean);

        if (matches.length === 0) {
            return null;
        }

        // pick the most specific one
        matches.sort((a, b) => b.score - a.score);
        return matches[0].pattern;
    };
}

module.exports = PathMatcher;