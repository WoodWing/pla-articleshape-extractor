/**
 * Make an alert() function available on global level.
 * @param {String} msg 
 * @param {String|undefined} caption 
 * @returns 
 */
globalThis.alert = function(msg, caption) {
    const { app } = require("indesign");
    const theDialog = app.dialogs.add({ name: caption || "Alert" });
    const col = theDialog.dialogColumns.add();
    const colText = col.staticTexts.add();
    colText.staticLabel = "" + msg;
    theDialog.canCancel = false;
    theDialog.show();
    theDialog.destroy();
    return;
}

/**
 * Compare two versions.
 * @param {String} versionLhs Left Hand Side.
 * @param {String} versionRhs Right Hand Side.
 * @returns {Number} Zero when equal, or -1 when versionLhs is smaller or 1 when bigger.
 */
globalThis.versionCompare = function(versionLhs, versionRhs) {
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