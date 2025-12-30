const fs = require("fs");

/**
 * Understands how to write messages of given severity to a log file.
 */
class Logger {

    /** @type {string} */
    #path;

    /** @type {string} */
    #name;

    /** @type {string} */
    #level;

    /** @type {boolean} */
    #wipe;

    /**
	 * @param {String} filePath
	 * @param {String} filename
	 * @param {String} logLevel
	 * @param {Boolean} wipe
	 */
    constructor (filePath, filename, logLevel, wipe) {

        this.LOGLEVEL = ["DISABLED", "CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"];

        this.#path = filePath;
        this.#name = filename;
        this.#level = this.LOGLEVEL.indexOf(logLevel);
        this.#wipe = wipe;

        if (this.#level > 0 && (!filePath || !logLevel)) {
            throw new Error("No log folder or filename provided.");
        }
        if (this.#level === -1) {
            throw new Error(`Unknown log level '${logLevel}' provided.`);
        }
    }

    /**
	 * Log a debug message, to provide diagnostically helpful information.
	 * @param {String} message
	 * @param {String|Object} [replacements] Can take any number of replacements, to be passed along to str.format()
	 */
    debug () {
        if (!this.isDebug())
            return;
        const args = Array.prototype.slice.call(arguments);
        this.#log(5, args);
    };

    /**
	 * @returns {boolean}
	 */
    isDebug () {
        return this.#level >= 5;
    }

    /**
	 * Log an info message, in case of an achievement or major state changes.
	 * @param {String} message
	 * @param {String|Object} [replacements] Can take any number of replacements, to be passed along to str.format()
	 */
    info () {
        if (!this.isInfo())
            return;
        const args = Array.prototype.slice.call(arguments);
        this.#log(4, args);
    };

    /**
	 * @returns {boolean}
	 */
    isInfo () {
        return this.#level >= 4;
    }

    /**
	 * Log a warning message, in case of an unwanted state.
	 * @param {String} message
	 * @param {String|Object} [replacements] Can take any number of replacements, to be passed along to str.format()
	 */
    warning () {
        if (!this.isWarning())
            return;
        const args = Array.prototype.slice.call(arguments);
        this.#log(3, args);
    };

    /**
	 * @returns {boolean}
	 */
    isWarning () {
        return this.#level >= 3;
    }

    /**
	 * Log an error message, in case the process can not continue.
	 * @param {String} message
	 * @param {String|Object} [replacements] Can take any number of replacements, to be passed along to str.format()
	 */
    error () {
        if (!this.isError())
            return;
        const args = Array.prototype.slice.call(arguments);
        this.#log(2, args);
    };

    /**
	 * @returns {boolean}
	 */
    isError () {
        return this.#level >= 2;
    }

    /**
	 * Log a critical message, in case the application can not continue.
	 * @param {String} message
	 * @param {String|Object} [replacements] Can take any number of replacements, to be passed along to str.format()
	 */
    critical () {
        if (!this.isCritical())
            return;
        const args = Array.prototype.slice.call(arguments);
        this.#log(1, args);
    };

    /**
	 * @returns {boolean}
	 */
    isCritical () {
        return this.#level >= 1;
    }

    /**
	 * @param {String} logLevel
	 * @param {String} args
	 */
    #log (logLevel, args) {
        const template = args.shift();
        // Replace undefined arguments with '*undefined*' to distinguish from ''
        args.forEach(function (replacement, i) {
            if (typeof replacement === "undefined") {
                args[i] = "*undefined*";
            }
        });
        const message = template.includes("{") && template.includes("}")
            ? template.replace(/{}/g, () => args.shift())
            : template;
        this.#writeLine(logLevel, message);
    };

    /**
	 * @param {String} logLevel
	 * @param {String} message
	 */
    #writeLine (logLevel, message) {
        const logLine = `[${this.#getDateTimeWithMsAsString()}] [${this.LOGLEVEL[logLevel].padEnd(8)}] ${message}\n`;
        const logPath = this.#getLogFilepath();
        try {
            let mode = "a"; // append or create
            if (this.#wipe) {
                mode = "w"; // overwrite or create
                this.#wipe = false;
            }
            fs.writeFileSync(logPath, logLine, { encoding: "utf-8", flag: mode });
        }
        catch (error) {
            alert(`Failed to write into log file '${logPath}' - ${error.message}`);
        }
    };

    /**
	 * @returns {String} UTC date and time with milliseconds in ISO 8601 format.
	 */
    #getDateTimeWithMsAsString () {
        return new Date().toISOString();
    };

    #getLogFilepath () {
        return `file:${this.#path.rtrim("/")}/${this.#name}`;
    };

    /**
	 * Log an Error object.
	 * @param {Error} error
	 * @returns
	 */
    logError (error) {
        let message = error.message + " (" + error.name + ")";
        if (error.stack) {
            message += "\n- stack:\n" + error.stack;
        }
        this.error(message);
    }
}

module.exports = Logger;
