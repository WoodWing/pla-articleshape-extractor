import os from 'os';
import fs from 'fs';
import minimist from 'minimist';

export class CliParams {

    /**
     * @param {Logger} logger 
     */
    constructor(logger) {
        this._logger = logger;
    }

    /**
     * Take the directory path from the CLI arguments.
     * This directory should contain the article shapes to upload.
     * @returns {string}
     */
    resolveInputPath() {
        const args = minimist(process.argv.slice(2)); // 2: exclude node and script
        if (typeof args['input-path'] === "undefined") {
            throw new Error("Argument missing: --input-path=[your_input_path]");
        }
        let inputPath = args['input-path'];
        if (inputPath.startsWith('~')) {
            inputPath = path.join(os.homedir(), inputPath.slice(1));
        }
        if (!fs.existsSync(inputPath) || !fs.lstatSync(inputPath).isDirectory()) {
            throw new Error(`Directory "${inputPath}" does not exist.`);
        }
        this._logger.debug("Input directory: {}", inputPath);
        return inputPath;
    }
}