/**
 * Make an alert() function available on global level.
 * @param {string} msg
 * @param {string} [caption]
 * @returns
 */
globalThis.alert = function (msg, caption) {
    const ind = require("indesign");
    const theDialog = ind.app.dialogs.add({ name: caption || "Alert" });
    const col = theDialog.dialogColumns.add();
    const lines = ("" + msg).split("\n");
    for (const line of lines) {
        const row = col.dialogRows.add();
        row.staticTexts.add({ staticLabel: line });
    }
    theDialog.canCancel = false;
    theDialog.show();
    theDialog.destroy();
    return;
};
