import chalk from "chalk";

export class ColoredLogger {

    /**
     * @returns {string} ISO formatted datetime e.g., "2025-04-28T12:34:56.789Z"
     */
    _timestamp() {
        return new Date().toISOString();
    }

    /**
     * 
     * @param {string} level 
     * @param {ChalkFunction} colorFn 
     * @param {string} args 
     */
    _format(level, colorFn, args) {
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
        console.log(`${chalk.gray(`[${this._timestamp()}]`)} [${colorFn(level.padEnd(8))}] ${message}`);
    }

	/**
	 * Log a debug message, to provide diagnostically helpful information.
	 * @param {string} message
	 * @param {string|Object} [replacements] Can take any number of replacements, to be passed along to str.format()
	 */
    debug() {
		const args = Array.prototype.slice.call(arguments);
        this._format("DEBUG", chalk.gray, args);
    }

	/**
	 * Log an info message, in case of an achievement or major state changes.
	 * @param {string} message
	 * @param {string|Object} [replacements] Can take any number of replacements, to be passed along to str.format()
	 */
    info() {
		const args = Array.prototype.slice.call(arguments);
        this._format("INFO", chalk.blue, args);
    }

	/**
	 * Log a warning message, in case of an unwanted state.
	 * @param {string} message
	 * @param {string|Object} [replacements] Can take any number of replacements, to be passed along to str.format()
	 */
    warning() {
		const args = Array.prototype.slice.call(arguments);
        this._format("WARN", chalk.yellow, args);
    }

	/**
	 * Log an error message, in case the process can not continue.
	 * @param {string} message
	 * @param {string|Object} [replacements] Can take any number of replacements, to be passed along to str.format()
	 */
    error() {
		const args = Array.prototype.slice.call(arguments);
        this._format("ERROR", chalk.red, args);
    }

	/**
	 * Log a critical message, in case the application can not continue.
	 * @param {string} message
	 * @param {string|Object} [replacements] Can take any number of replacements, to be passed along to str.format()
	 */
    critical() {
		const args = Array.prototype.slice.call(arguments);
        this._format("CRITICAL", chalk.red, args);
    }

	/**
	 * Log an Error object.
	 * @param {Error} error 
	 */
	logError(error) {
		let message = error.message + " (" + error.name + ")";
		if (error.stack) {
			message += "\n- stack:\n" + error.stack;
		}
		this.error(message);
	}    
}