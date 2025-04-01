if (!String.prototype.trim) {
    (function() {
        // Make sure we trim BOM and NBSP
        var rtrim = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g;
        String.prototype.trim = function() {
            return this.replace(rtrim, '');
        };
    })();
}

String.prototype.trimEndChars = function(chars) {
    if (!chars || chars.length === 0) return this;
    var escapedChars = chars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    var regExpression = new RegExp("[" + escapedChars + "]+$", "g");
    return this.replace(regExpression, "");
};
