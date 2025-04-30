import chalk from "chalk";

export class ColoredLogger {
    _timestamp() {
        return new Date().toISOString(); // e.g., "2025-04-28T12:34:56.789Z"
    }

    _format(prefix, colorFn, message) {
        console.log(`${chalk.gray(`[${this._timestamp()}]`)} ${colorFn(prefix)} ${message}`);
    }

    info(message) {
        this._format("[INFO]", chalk.blue, message);
    }

    warn(message) {
        this._format("[WARN]", chalk.yellow, message);
    }

    error(message) {
        this._format("[ERROR]", chalk.red, message);
    }

    success(message) {
        this._format("[SUCCESS]", chalk.green, message);
    }

    debug(message) {
        this._format("[DEBUG]", chalk.gray, message);
    }

    json(obj, level = "info") {
        const str = JSON.stringify(obj, null, 2);
        this[level](str);
    }
}