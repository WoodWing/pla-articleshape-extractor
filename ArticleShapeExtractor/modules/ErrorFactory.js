/**
 * Understands how to define a custom error class.
 * 
 * @constructor
 * @param {Logger} logger 
 * @param {Boolean} includeErrorDetailInAlerts 
 */
function ErrorFactory(logger, includeErrorDetailInAlerts) {

    this._logger = logger;
    this._includeErrorDetailInAlerts = includeErrorDetailInAlerts;

    /**
     * 
     * @param {String} errorClassname 
     * @param {String} defaultMessage
     * @returns {Error}
     */
	this.make = function (errorClassname, defaultMessage) {
        let error = function (msg) {
            this.name = errorClassname;
            this.message = msg || defaultMessage || "";
            logger.error(this._detailsAsString());
        }
        error.prototype = new Error();
        error.prototype.name = errorClassname;
        return error;
    };
}

/**
 * @param  {Constructor} constructor
 * @returns {Boolean}
 */    
Error.prototype.isInstanceOf = function (constructor) {
    const thatClassname = this._getClassnameOfBuiltinError(constructor) || constructor.prototype.name;
    return this.name === thatClassname;
}

/**
 * @param  {Constructor} constructor
 * @returns {String|null} Classname for builtin error, or null for custom error.
 */    
Error.prototype._getClassnameOfBuiltinError = function (constructor) {
    const match = constructor.toString().match(/function\s+([^\s(]+)/);
    return match ? match[1] : null;
}

Error.prototype.alert = function () {
    const message = this._includeErrorDetailInAlerts ? this._detailsAsString() : this.message;
    alert(message);
}

/**
 * @returns {String}
 */
Error.prototype._detailsAsString = function() {
    let detail = this.message + " (" + this.name + ")";
    if (this.stack) {
        detail += "\n- stack:\n" + this.stack;
    }
    return detail;
}

module.exports = ErrorFactory;