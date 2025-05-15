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
        const args = this._getArguments();
        if (!'input-path' in args) {
            this._showUsage();
            throw new Error("Argument missing: --input-path");
        }
        let inputPath = args['input-path'];
        if (inputPath.startsWith('~')) {
            inputPath = path.join(os.homedir(), inputPath.slice(1));
        }
        if (!fs.existsSync(inputPath) || !fs.lstatSync(inputPath).isDirectory()) {
            throw new Error(`Directory "${inputPath}" does not exist.`);
        }
        this._logger.info(`Input directory: ${inputPath}`);
        return inputPath;
    }

    /**
     * Returns the script arguments given on the CLI.
     * @returns {string[]}
     */
    _getArguments() {
        return minimist(process.argv.slice(2)); // 2: exclude node and script
    }

    _showUsage() {
        const usage = "Usage: node index.mjs [arguments]\n\n"
            + "Options:\n"
            + "  --input-path=...          Path of folder that contains article shapes to upload.\n"
            + "  --old-shapes=...          How to handle the previously configured shapes. Options: 'keep' or 'delete'.\n"
            + "  --brand-id=...            Optional. Override the brand. Overrides the brand provided by the shapes.\n"
            + "  --section-id=...          Optional. Override the section. Overrides the section provided by the shapes.\n"
        ;
        console.log(usage);
    }

    /**
     * Tells whether the user wants to delete the previously configured article shapes.
     * @returns {boolean} True to delete, false to keep.
     */
    shouldDeletePreviouslyConfiguredArticleShapes() {
        const args = this._getArguments();
        if (!'old-shapes' in args) {
            this._showUsage();
            throw new Error("Argument missing: --old-shapes");
        }        
        const handleOldShapes = args['old-shapes'];
        if (!handleOldShapes in ['keep', 'delete']) {
            this._showUsage();
            throw new Error(`Unsupported value provided for argument --old-shapes: ${handleOldShapes}.`);
        }
        this._logger.info(`Handling previously configured article shapes: ${handleOldShapes}`);
        return handleOldShapes === 'delete';
    }

    /**
     * Tells which brand/section id to use. If given on CLI, those will override the default provided ones.
     * @param {string} defaultBrandId
     * @param {string} defaultSectionId
     * @returns { brandId: string, sectionId: string }
     */
    resolveBrandAndSectionToUse(defaultBrandId, defaultSectionId) {
        const args = this._getArguments();
        const paramBrandId = 'brand-id' in args ? String(args['brand-id']) : null;
        const paramSectionId = 'section-id' in args ? String(args['section-id']) : null;
        if ((!paramBrandId && paramSectionId) || (paramBrandId && !paramSectionId)) {
            this._showUsage();
            throw new Error("Unsupported combination of arguments. Either --brand-id or --section-id is provided. Expected both or none.");
        }
        const useBrandId = paramBrandId || defaultBrandId;
        const useSectionId = paramSectionId || defaultSectionId;
        this._logger.info(`Targeting for brandId "${useBrandId}" and sectionId "${useSectionId}"`);
        return { brandId: useBrandId, sectionId: useSectionId };
    }
}