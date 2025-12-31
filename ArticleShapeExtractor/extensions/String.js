/**
 * @description Remove characters or whitespaces from the start of string.
 * @this {string}
 * @param {string|undefined} characters If given, remove characters, otherwise remove whitespaces.
 * @returns {string}
 */
String.prototype.ltrim = function (characters) {
    const escaped = characters ? this._escapeRegExChars(characters) : "\\s";
    const regex = new RegExp(`^[${escaped}]+`, "g");
    return this.replace(regex, "");
};

String.prototype._escapeRegExChars = function (characters) {
    return characters.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&");
};

/**
 * @description Remove characters or whitespaces from the end of string.
 * @this {string}
 * @param {string|undefined} characters If given, remove characters, otherwise remove whitespaces.
 * @returns {string}
 */
String.prototype.rtrim = function (characters) {
    const escaped = characters ? this._escapeRegExChars(characters) : "\\s";
    const regex = new RegExp(`[${escaped}]+$`, "g");
    return this.replace(regex, "");
};

