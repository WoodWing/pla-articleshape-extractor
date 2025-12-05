import { describe, it, expect } from 'vitest';
import { PageLayoutSettings } from '../modules/PageLayoutSettings.mjs';

// ---------- Test helpers ----------

/**
 * Merges two objects into a new object.
 * @param {Object} base Object with a full set of properties to use as a base.
 * @param {Object} override Object with some properties to override the base.
 * @returns {Object} The merge of the two objects. This is a new object.
 */
function deepMerge(base, override) {
    const result = structuredClone(base);
    for (const key of Object.keys(override)) {
        const o = override[key];
        if (o && typeof o === "object" && !Array.isArray(o)) {
            result[key] = deepMerge(result[key] || {}, o);
        } else {
            result[key] = o;
        }
    }
    return result;
}

/**
 * Composes a new PageLayoutSettings based on built-in factory defaults.
 * Allows overriding some properties.
 * @param {Object} overrideSettings Some (or none) properties to override the factory defaults for a PageLayoutSettings data structure.
 * @param {Object} overrideGrid Some (or none) properties to override the factory defaults for a PageGrid data structure.
 * @returns {PageLayoutSettings}
 */
function makeSettings(overrideSettings = {}, overrideGrid = {}) {
    const defaultSettings = {
        dimensions: { width: 612, height: 792 },
        margins: { top: 36, bottom: 36, inside: 18, outside: 36 },
        columns: { gutter: 12 },
        "baseline-grid": { start: 36, increment: 12 }
    };
    const mergedSettings = deepMerge(defaultSettings, overrideSettings);
    const defaultGrid = { columnCount: 5, rowCount: 8 };
    const mergedGrid = deepMerge(defaultGrid, overrideGrid);
    return new PageLayoutSettings(mergedSettings, mergedGrid);
}

// ---------- Tests ----------

describe('PageLayoutSettings.diffInDesignPageLayoutGrid', () => {

    it('returns null when compared properties match', () => {
        const local = makeSettings();
        const remote = makeSettings();
        expect(local.diffInDesignPageLayoutGrid(remote)).toBeNull();
    });

    it('detects difference in columns.gutter', () => {
        const local = makeSettings();
        const remote = makeSettings({ columns: { gutter: 999 } });
        expect(local.diffInDesignPageLayoutGrid(remote)).toEqual({
            propertyPath: "columns.gutter",
            lhsValue: 12,
            rhsValue: 999
        });
    });

    it('detects difference in baseline-grid.increment', () => {
        const local = makeSettings();
        const remote = makeSettings({ "baseline-grid": { increment: 999 } });
        expect(local.diffInDesignPageLayoutGrid(remote)).toEqual({
            propertyPath: "baseline-grid.increment",
            lhsValue: 12,
            rhsValue: 999
        });
    });

    it('ignores excluded properties even if different', () => {
        const local = makeSettings();
        const remote = makeSettings({
            dimensions: { width: 999 },
            margins: { top: 999 },
            "baseline-grid": { start: 999 }
        });

        expect(local.diffInDesignPageLayoutGrid(remote)).toBeNull();
    });

});

describe('PageLayoutSettings.getRowHeight', () => {

    it('correct calculation of usable page height divided by row count', () => {
        const settings = makeSettings();
        // Usable page height = 792pt - 36pt - 36pt = 720pt
        // Expected how height = 720pt / 8 rows = 90pt
        const expectedRowHeight = 90; 
        expect(settings.getRowHeight()).equals(expectedRowHeight);
    });

    it('throws error on negative row count', () => {
        const settings = makeSettings({}, { rowCount: -1 });
        expect(() => settings.getRowHeight())
            .toThrow(/The row count -1 is invalid./);
    });

    it('throws error on negative row height', () => {
        const settings = makeSettings(
            { 
                margins: { top: 60, bottom: 40 },
                dimensions: { height: 90 }
            },
            { rowCount: 2 }
        );
        // Row height = (90pt - (60pt + 40pt)) / 2 rows = -5pt
        expect(() => settings.getRowHeight())
            .toThrow(/The row height -5 is invalid./);
    });
});

describe('PageLayoutSettings.getColumnWidth', () => {

    it('correct calculation of usable page width divided by column count', () => {
        const settings = makeSettings();
        // Sum of gutters = (5 columns -1) * 12 = 48
        // Usable page width = 612pt - 36pt - 18pt - 48pt = 510pt
        // Expected column width = 510pt / 5 columns = 102pt
        const expectedColumnWidth = 102;
        expect(settings.getColumnWidth()).equals(expectedColumnWidth);
    });

    it('throws error on negative column count', () => {
        const settings = makeSettings({}, { columnCount: -1 });
        expect(() => settings.getColumnWidth())
            .toThrow(/The column count -1 is invalid./);
    });

    it('throws error on negative column width', () => {
        const settings = makeSettings(
            { 
                margins: { inside: 60, outside: 40 },
                dimensions: { width: 90 }
            },
            { columnCount: 4 }
        );
        // Sum of gutters = (4 columns -1) * 12 = 36
        // Column width = (90pt - (60pt + 40pt) - 36) / 4 columns = -11.5pt
        expect(() => settings.getColumnWidth())
            .toThrow(/The column width -11.5 is invalid./);
    });

});
