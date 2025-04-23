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