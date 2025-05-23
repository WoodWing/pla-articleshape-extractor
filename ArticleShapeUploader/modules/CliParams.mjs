import os from 'os';
import fs from 'fs';
import minimist from 'minimist';

export class CliParams {

    #logger;

    /**
     * @param {Logger} logger 
     */
    constructor(logger) {
        this.#logger = logger;
    }

    /**
     * Take the directory path from the CLI arguments.
     * This directory should contain the article shapes to upload.
     * @returns {string}
     */
    resolveInputPath() {
        const args = this.#getArguments();
        if (!'input-path' in args) {
            this.#showUsage();
            throw new Error("Argument missing: --input-path");
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
            + "  --target-brand=...        Optional. Name of the brand to upload to. Overrides the brand provided by the shapes. Requires a _manifest/brand-section-map.json file.\n"
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
        if (!'old-shapes' in args) {
            this.#showUsage();
            throw new Error("Argument missing: --old-shapes");
        }        
        const handleOldShapes = args['old-shapes'];
        if (!handleOldShapes in ['keep', 'delete']) {
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
        return 'target-brand' in args ? String(args['target-brand']) : null;
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