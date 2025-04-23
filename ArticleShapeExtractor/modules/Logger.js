const fs = require('fs');

/**
 * Understands how to write messages of given severity to a log file.
 * 
 * @constructor
 * @param {String} filePath 
 * @param {String} filename 
 * @param {String} logLevel 
 * @param {Boolean} wipe 
 */
function Logger(filePath, filename, logLevel, wipe) {

	this.LOGLEVEL = ["DISABLED", "CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"];

	this.path = filePath;
	this.name = filename;
	this.level = this.LOGLEVEL.indexOf(logLevel);
	this.wipe = wipe;

	if (this.level > 0 && (!filePath || !logLevel) ) {
        throw new Error("No log folder or filename provided.");
    }
	if (this.level === -1) {
		throw new Error(`Unknown log level '${logLevel}' provided.`);
	}

	/**
	 * Log a debug message, to provide diagnostically helpful information.
	 * @param {String} message
	 * @param {String|Object} [replacements] Can take any number of replacements, to be passed along to str.format()
	 */
	this.debug = function () {
		if(5 > this.level)
			return;
		const args = Array.prototype.slice.call(arguments);
		this._log(5, args);
	};

	/**
	 * Log an info message, in case of an achievement or major state changes.
	 * @param {String} message
	 * @param {String|Object} [replacements] Can take any number of replacements, to be passed along to str.format()
	 */
	this.info = function () {
		if(4 > this.level)
			return;
		const args = Array.prototype.slice.call(arguments);
		this._log(4, args);
	};

	/**
	 * Log a warning message, in case of an unwanted state.
	 * @param {String} message
	 * @param {String|Object} [replacements] Can take any number of replacements, to be passed along to str.format()
	 */
	this.warning = function () {
		if(3 > this.level)
			return;
		const args = Array.prototype.slice.call(arguments);
		this._log(3, args);
	};

	/**
	 * Log an error message, in case the process can not continue.
	 * @param {String} message
	 * @param {String|Object} [replacements] Can take any number of replacements, to be passed along to str.format()
	 */
	this.error = function () {
		if(2 > this.level)
			return;
		const args = Array.prototype.slice.call(arguments);
		this._log(2, args);
	};

	/**
	 * Log a critical message, in case the application can not continue.
	 * @param {String} message
	 * @param {String|Object} [replacements] Can take any number of replacements, to be passed along to str.format()
	 */
	this.critical = function () {
		if(1 > this.level)
			return;
		const args = Array.prototype.slice.call(arguments);
		this._log(1, args);
	};

	/**
	 * @param {String} logLevel 
	 * @param {String} args 
	 */
	this._log = function (logLevel, args) {
		const template = args.shift();
		// Replace undefined arguments with '*undefined*' to distinguish from ''
		args.forEach(function(replacement, i) {
			if (typeof replacement === 'undefined') {
			  args[i] = '*undefined*';
			}
		  });		
		const message = template.includes('{') && template.includes('}')
			? template.replace(/{}/g, () => args.shift())
			: template;		
		this._writeLine(logLevel, message);
	};

	/**
	 * @param {String} logLevel 
	 * @param {String} message 
	 */
	this._writeLine = function (logLevel, message) {
		const logLine = `[${this._getDateTimeWithMsAsString()}] [${this.LOGLEVEL[logLevel].padEnd(8)}] ${message}\n`;
		const logPath = this._getLogFilepath();
		try {
			let mode = "a"; // append or create
			if (this.wipe) {
				mode = "w"; // overwrite or create
				this.wipe = false;
			}
        	fs.writeFileSync(logPath, logLine, {encoding: "utf-8", flag: mode});		
		} catch(error) {
			alert(`Failed to write into log file '${logPath}' - ${error}`);
		}
	};

	/**
	 * @returns {String} UTC date and time with milliseconds in ISO 8601 format.
	 */
	this._getDateTimeWithMsAsString = function() {
		const date = new Date();
		const dateString = date.getUTCFullYear() 
			+ '-' + date.getUTCMonth().toString().padStart(2, "0") 
			+ '-' + date.getUTCDay().toString().padStart(2, "0");
		const timeString = date.getUTCHours().toString().padStart(2, "0") 
			+ ':' + date.getUTCMinutes().toString().padStart(2, "0") 
			+ ':' + date.getUTCSeconds().toString().padStart(2, "0")
			+ '.' + date.getUTCMilliseconds().toString().padStart(3, "0");
		return dateString + 'T' + timeString + 'Z';
	};

	this._getLogFilepath = function() {
		return `file:${this.path.rtrim('/')}/${this.name}`;
	};

	/**
	 * Log an Error object.
	 * @param {Error} error 
	 * @returns 
	 */
	this.logError = function(error) {
		let message = error.message + " (" + error.name + ")";
		if (error.stack) {
			message += "\n- stack:\n" + error.stack;
		}
		this.error(message);
	}	
}

module.exports = Logger;