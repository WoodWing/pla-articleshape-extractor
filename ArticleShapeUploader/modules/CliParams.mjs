import os from 'os';
import fs from 'fs';
import minimist from 'minimist';

export class CliParams {

    /** @type {ColoredLogger} */
    #logger;

    /**
     * @param {ColoredLogger} logger 
     */
    constructor(logger) {
        this.#logger = logger;
    }

    /**
     * Whether the user has asked to show help on usage only.
     * @returns {boolean}
     */
    userHasAskedForHelpOnly() {
        const args = this.#getArguments();
        const askedForHelp = args.hasOwnProperty('help');
        if (askedForHelp) {
            this.#showUsage();
        }
        return askedForHelp;
    }

    /**
     * Take the directory path from the CLI arguments.
     * This directory should contain the article shapes to upload.
     * @returns {string}
     */
    resolveInputPath() {
        const args = this.#getArguments();
        if (!args.hasOwnProperty('input-path') || typeof args['input-path'] !== 'string' || args['input-path'].length === 0) {
            this.#showUsage();
            throw new Error("Argument or value missing: --input-path");
        }
        let inputPath = args['input-path'];
        if (inputPath.startsWith('~')) {
            inputPath = path.join(os.homedir(), inputPath.slice(1));
        }
        if (!fs.existsSync(inputPath) || !fs.lstatSync(inputPath).isDirectory()) {
            throw new Error(`Directory "${inputPath}" does not exist.`);
        }
        this.#logger.info(`Input directory: ${inputPath}`);
        return inputPath;
    }

    /**
     * Returns the script arguments given on the CLI.
     * @returns {string[]}
     */
    #getArguments() {
        // Define a CLI flag that can be pass in as --uploads or --no-uploads.
        const options = {
            boolean: ['uploads'],
            default: {
                uploads: true
            }
        };
        return minimist(process.argv.slice(2), options); // 2: exclude node and script
    }

    #showUsage() {
        const usage = "Usage: node index.mjs [arguments]\n\n"
            + "Options:\n"
            + "  --input-path=...          Path of folder that contains article shapes to upload.\n"
            + "  --old-shapes=...          How to handle the previously configured shapes. Options: 'keep' or 'delete'.\n"
            + "  --target-brand=...        Optional. Name of the brand to upload to. Overrides the brand provided by the shapes.\n"
            + "  --no-uploads              Optional. Skip uploading files for the article shapes. Don't use for production."
        ;
        console.log(usage);
    }

    /**
     * Tells whether the user wants to delete the previously configured article shapes.
     * @returns {boolean} True to delete, false to keep.
     */
    shouldDeletePreviouslyConfiguredArticleShapes() {
        const args = this.#getArguments();
        if (!args.hasOwnProperty('old-shapes') || typeof args['old-shapes'] !== 'string') {
            this.#showUsage();
            throw new Error("Argument of value is missing: --old-shapes");
        }        
        const handleOldShapes = args['old-shapes'];
        if (!['keep', 'delete'].includes(handleOldShapes)) {
            this.#showUsage();
            throw new Error(`Unsupported value provided for argument --old-shapes: ${handleOldShapes}.`);
        }
        this.#logger.info(`Handling previously configured article shapes: ${handleOldShapes}`);
        return handleOldShapes === 'delete';
    }

    /**
     * Returns a different brand to be used (to upload for) than the brand used to download from.
     * @returns {string|null} The different brand, or null to use the same brand (as downloaded from).
     */
    getTargetBrandName() {
        const args = this.#getArguments();
        return args.hasOwnProperty('target-brand') ? String(args['target-brand']) : null;
    }

    /**
     * Tells whether the user wants to upload files. Suppressing this could be useful e.g. to speedup debugging.
     * @returns {boolean}
     */
    shouldUploadFiles() {
        const args = this.#getArguments();
        return args.uploads === true;
    }
}