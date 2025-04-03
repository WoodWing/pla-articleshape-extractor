//@include "libraries/_.jsx"

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

	this.file = null;
	this.SEVERITY = ["DISABLED", "CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"];

	this.path = filePath;
	this.name = filename;
	this.level = this.SEVERITY.indexOf(logLevel);
	this.wipe = wipe;

	/**
	 * Log a debug message, to provide diagnostically helpful information.
	 * @param {String} message
	 * @param {String|Object} [replacements] Can take any number of replacements, to be passed along to str.format()
	 */
	this.debug = function () {
		if(5 > this.level)
			return;
		var args = Array.prototype.slice.call(arguments);
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
		var args = Array.prototype.slice.call(arguments);
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
		var args = Array.prototype.slice.call(arguments);
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
		var args = Array.prototype.slice.call(arguments);
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
		var args = Array.prototype.slice.call(arguments);
		this._log(1, args);
	};

	/**
	 * @param {String} severity 
	 * @param {String} args 
	 */
	this._log = function (severity, args) {
		var template = args.shift();
		// Replace undefined arguments with '*undefined*' to distinguish from ''
		_.each(args, function(replacement, i){
			if(typeof replacement === 'undefined') {
				args[i] = '*undefined*';
			}
		});
		var message = template.contains('{}') ? template.format.apply(template, args) : template;
		this._writeLine(severity, message);
	};

	/**
	 * @param {String} severity 
	 * @param {String} message 
	 */
	this._writeLine = function (severity, message) {
		if (!this.file) {
			return;
		}
		this.file.open("a");
		this.file.writeln(
			'[' + this._getDateTimeWithMsAsString() + '] '
			+ '[' + this.SEVERITY[severity].padEnd(8) + '] '
			+ message);
		this.file.close();
	};

	/**
	 * @returns {String} UTC date and time with milliseconds in ISO 8601 format.
	 */
	this._getDateTimeWithMsAsString = function() {
		var date = new Date();
		var dateString = date.getUTCFullYear() 
			+ '-' + date.getUTCMonth().toString().padStart(2, "0") 
			+ '-' + date.getUTCDay().toString().padStart(2, "0");
		var timeString = date.getUTCHours().toString().padStart(2, "0") 
			+ ':' + date.getUTCMinutes().toString().padStart(2, "0") 
			+ ':' + date.getUTCSeconds().toString().padStart(2, "0")
			+ '.' + date.getUTCMilliseconds().toString().padStart(3, "0");
		return dateString + 'T' + timeString + 'Z';
	}

	this.init = function() {
		var folder = new Folder(this.path);
		if (!folder.exists) {
			if (!folder.create()) {
				alert("Could not create '" + this.path + "' log folder.");
				return null;
			}
		}
		this.file = new File(this.name).at(folder);
		if(this.wipe) {
			this.file.remove();
		}
		this.file.encoding = 'UTF-8';
	};	
}