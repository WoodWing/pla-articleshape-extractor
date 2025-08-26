const PathMatcher = require("../modules/PathMatcher.js");

describe("findBestMatch", () => {
    let pathMatcher;

    beforeAll(async () => {
        pathMatcher = new PathMatcher();
    });

    const patterns = [
        "foo/bar/*",
        "foo/*/bar",
        "*/foo/bar",
        "foo/bar/baz",
        "baz",
    ];

    test("single item matches", () => {
        expect(pathMatcher.findBestMatch(patterns, "baz")).toBe("baz");
    });

    test("exact match wins", () => {
        expect(pathMatcher.findBestMatch(patterns, "foo/bar/baz")).toBe("foo/bar/baz");
    });

    test("wildcard at end matches", () => {
        expect(pathMatcher.findBestMatch(patterns, "foo/bar/xyz")).toBe("foo/bar/*");
    });

    test("wildcard in middle matches", () => {
        expect(pathMatcher.findBestMatch(patterns, "foo/xyz/bar")).toBe("foo/*/bar");
    });

    test("wildcard at beginning matches", () => {
        expect(pathMatcher.findBestMatch(patterns, "xyz/foo/bar")).toBe("*/foo/bar");
    });

    test("returns null for depth mismatch", () => {
        expect(pathMatcher.findBestMatch(patterns, "foo/bar")).toBeNull();
    });
});
