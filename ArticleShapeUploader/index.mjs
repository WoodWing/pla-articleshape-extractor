/**
 * See README.md for installation and usage of this script.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import minimist from 'minimist';
import dotenv from 'dotenv';
import Ajv from 'ajv';

import { AppSettings } from "./modules/AppSettings.mjs";
import { ColoredLogger } from "./modules/ColoredLogger.mjs";
import { CliOptionAsker, DeleteOldArticleShapesQuestion, DeleteOldArticleShapesEnum } from "./modules/CliOptionAsker.mjs";
import { DocumentSettingsReader } from "./modules/DocumentSettingsReader.mjs";
import { ElementLabelMapper } from './modules/ElementLabelMapper.mjs';
import { ArticleShapeHasher } from "./modules/ArticleShapeHasher.mjs";
import { PlaService } from "./modules/PlaService.mjs";

import { uploaderDefaultConfig } from "./config/config.mjs";
let uploaderLocalConfig = {}
try {
    const localModule = await import("./config/config-local.mjs");
    uploaderLocalConfig = localModule.uploaderLocalConfig;
} catch (error) {
}
const appSettings = new AppSettings(uploaderDefaultConfig, uploaderLocalConfig);
const logger = new ColoredLogger();
const documentSettingsReader = new DocumentSettingsReader(logger, appSettings.getGrid());
const articleShapeSchema = JSON.parse(fs.readFileSync('./article-shape.schema.json', 'utf-8'));
const elementLabelMapper = new ElementLabelMapper(appSettings.getElementLabels());
const hasher = new ArticleShapeHasher(elementLabelMapper);
const plaService = new PlaService(appSettings.getPlaServiceUrl(), appSettings.getLogNetworkTraffic(), logger);

/**
 * Top level execution path of this script.
 */
async function main() {
    try {
        dotenv.config();
        const inputPath = resolveInputPath();
        documentSettingsReader.readSettings(inputPath);
        const accessToken = resolveAccessToken();
        const brandId = appSettings.getBrandId(); // TODO: resolve from JSON
        const layoutSettings = await plaService.getPageLayoutSettings(accessToken, brandId); // TODO: validate against JSON
        if (layoutSettings === null) {
            // TODO: save settings, taken from JSON
        }
        switch (await askDeleteArticleShapesDecision()) {
            case DeleteOldArticleShapesEnum.QUIT:
                logger.warning("Script aborted!");
                return;
            case DeleteOldArticleShapesEnum.KEEP:
                // nothing to do; skip deletion of article shapes
                break;
            case DeleteOldArticleShapesEnum.DELETE:
                await plaService.deleteArticleShapes(accessToken, brandId);
                break;
        }
        await scanDirAndUploadFiles(inputPath, accessToken, brandId);
    } catch(error) {
        logger.error(error.message);
    }
}

/**
 * Take the PLA access token from the environment variables.
 * This token should give access to the PLA service.
 * @returns {string}
 */
function resolveAccessToken() {
    const accessToken = process.env.PLA_ACCESS_TOKEN;
    if (typeof accessToken === "undefined") {
        throw new Error("No PLA_ACCESS_TOKEN environment variable set.");
    }
    logger.debug(`PLA access token: ${accessToken}`);
    return accessToken;
}

/**
 * Take the directory path from the CLI arguments.
 * This directory should contain the article shapes to upload.
 * @returns {string}
 */
function resolveInputPath() {
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
    logger.debug("Input directory: {}", inputPath);
    return inputPath;
}

/**
 * @returns DeleteOldArticleShapesEnum
 */
async function askDeleteArticleShapesDecision() {
    const question = new DeleteOldArticleShapesQuestion();
    const asker = new CliOptionAsker(question);
    return await asker.ask();
}

/**
 * Scans through a given for for article shape JSON files. For each file it creates 
 * an article shape configuration in the PLA service and uploads 3 files to S3.
 * The basename of each set of 3 files should be the same and represents the article shape name.
 * The JSON file holds the definition, the JPEG holds the preview and IDMS holds the snippet.
 * @param {string} folderPath 
 * @param {string} accessToken 
 * @param {string} brandId 
 */
async function scanDirAndUploadFiles(folderPath, accessToken, brandId) {
    await scanDirForArticleShapeJson(folderPath, async (baseName) => {
        const jsonFilePath = composePathAndAssertExists(folderPath, baseName, 'json');
        const articleShapeJson = validateArticleShapeJson(jsonFilePath);
        const compositionHash = hasher.hash(articleShapeJson);
        const localFiles = {
            json: jsonFilePath,
            jpeg: composePathAndAssertExists(folderPath, baseName, 'jpg'),
            idms: composePathAndAssertExists(folderPath, baseName, 'idms'),
        };
        const fileRenditions = [
            composeFileRenditionDto('composition', 'application/json; charset=utf-8', 'json'),
            composeFileRenditionDto('snapshot', 'image/jpeg', 'jpg'),
            composeFileRenditionDto('definition', 'application/xml', 'idms'),
        ]
        await uploadArticleShapeWithFiles(
            accessToken, brandId, baseName, localFiles, fileRenditions, compositionHash);        
        return true;
    });
}

/**
 * Scans for article shape files and calls the callback with the basename, which represents the shape name.
 * @param {string} folderPath - Folder to scan.
 * @param {CallableFunction} callback
 */
async function scanDirForArticleShapeJson(folderPath, callback) {
    const files = fs.readdirSync(folderPath);
    for (const file of files) {
        if (file.toLowerCase().endsWith('.json') && file !== documentSettingsReader.getFilename()) {
            const baseName = path.basename(file, '.json');
            try {
                const shouldContinue = await callback(baseName);
                if (!shouldContinue) {
                    break;
                }
            } catch (error) {
                logger.error(`Failed to process article shape "${baseName}" - ` + error.message);
            }
        }
    }
}

/**
 * Validates an article shape JSON file against the schema.
 * @param {string} jsonFilePath 
 * @returns {Object} The valid article shape JSON.
 */
function validateArticleShapeJson(jsonFilePath) {
    const basename = path.basename(jsonFilePath);
    let jsonData = null;
    try {
        jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
    } catch(error) {
        throw new Error(`The file "${basename}" is not valid JSON - ${error.message}`);
    }
    const ajv = new Ajv();
    const validate = ajv.compile(articleShapeSchema);
    if (!validate(jsonData)) {
        let errorMessage = `The file "${basename}" is not valid according to the article-shape.schema.json file:\n`;
        for (const validationError of validate.errors) {
            errorMessage +=
                `- [${validationError.instancePath || '/'}] ${validationError.message}. Details:\n`
                + `  keyword: ${validationError.keyword}\n`
                + `  params: ${JSON.stringify(validationError.params, null, 2)}\n`
                + `  schemaPath: ${validationError.schemaPath}`
        }
        throw new Error(errorMessage);
    }
    return jsonData;
}

/**
 * Compose a full filepath (from given parts) that exists on local disk.
 * @param {string} folderPath 
 * @param {string} baseName 
 * @param {string} fileExtension 
 * @returns {string} An existing filepath, else raise an Error.
 */
function composePathAndAssertExists(folderPath, baseName, fileExtension) {
    const filePath = path.join(folderPath, `${baseName}.${fileExtension}`);
    if (!fs.existsSync(filePath) || !fs.lstatSync(filePath).isFile()) {
        throw new Error(`File "${filePath}" does not exist.`);
    }
    return filePath
}

/**
 * An article shape extract consists of 3 files:
 * - Definition (IDMS):
 *   - The full definition of an article, exported from page.
 *   - Contains all InDesign details, alike InCopy format.
 *   - InDesign snippet: application/vnd.adobe.indesign-idms
 *   - https://fileformatfinder.com/extension/idms/
 *   - Can be used for future purposes to extract more info.
 *   - E.g. the JSON files can be enriched with that info.
 * - Composition (JSON):
 *   - Extract of article components, text and geometric info.
 *   - Can be used to plot abstract preview (boxes) in the UI.
 *   - Prevents the need to understand complex IDMS format.
 *   - WW format, created with ArticleShapeExtractor tool.
 *   - Used for AWS project to build LLM of article shapes.
 *   - Supersedes the article shapes configuration files (CSV).
 * - Snapshot (JPEG):
 *   - Illustration of article text- and graphic components.
 *   - Preview of the initial article (not the actual one).
 *   - Gives an impression, but shown content is misleading.
 *   - Can be used to help user pick a shape (from a list). 
 *   - Can not be used to preview the actual article.
 *
 * @param {string} renditionName  'definition', 'composition' or 'snapshot'
 * @param {string} contentType e.g. 'application/json; charset=utf-8'
 * @param {string} fileExtension  without the dot
 * @returns {Object} DTO for communication with the PLA service.
 */
function composeFileRenditionDto(renditionName, contentType, fileExtension) {
    return {
        rendition_name: renditionName, 
        content_type: contentType, 
        file_extension: fileExtension, 
        presigned_url: null, // S3 upload URLs, to be provided by PLA service
    };
}

/**
 * Callback function, to be called for each article shape to upload.
 * Create a new article shape configuration in the PLA service and upload files to S3.
 * @param {string} accessToken 
 * @param {string} brandId 
 * @param {string} articleShapeName 
 * @param {Array<Object>} localFiles
 * @param {Array<string>} fileRenditions 
 * @param {string} compositionHash
 */
async function uploadArticleShapeWithFiles(
    accessToken, brandId, articleShapeName, localFiles, fileRenditions, compositionHash
) {
    logger.info(`Processing article shape "${articleShapeName}".`);
    const raw = fs.readFileSync(localFiles.json, 'utf8');
    const articleShapeJson = JSON.parse(raw);
    const articleShapeDto = articleShapeJsonToDto(articleShapeJson, articleShapeName, compositionHash);
    const articleShapeWithRenditionsDto = {
        article_shape: articleShapeDto,
        renditions: fileRenditions,
    };
    const fileRenditionsWithUploadUrls = await plaService.createArticleShape(
        accessToken, brandId, articleShapeName, articleShapeWithRenditionsDto
    );
    if (fileRenditionsWithUploadUrls === null) {
        return;
    }
    for (const fileRendition of fileRenditionsWithUploadUrls) {
        const localFilePath = lookupLocalFileByRendition(fileRendition.rendition_name, localFiles);
        if (!fileRendition.presigned_url) {
            throw Error(`No pre-signed upload URL for the "${fileRendition.rendition_name} file rendition."`);
        }
        await plaService.uploadFileToS3(localFilePath, fileRendition.presigned_url, fileRendition.content_type);
    }
}

/**
 * Convert an article shape definition taken from a JSON file into a DTO.
 * The DTO is used to communicate an article shape configuration with the PLA service.
 * @param {Object} articleShapeJson 
 * @param {string} articleShapeName
 * @param {string} compositionHash
 * @returns {Object} DTO
 */
function articleShapeJsonToDto(articleShapeJson, articleShapeName, compositionHash) {
    const columnWidth = documentSettingsReader.getColumnWidth();
    const rowHeight = documentSettingsReader.getRowHeight();
    let articleShapeDto = {
        name: articleShapeName,
        section_id: articleShapeJson.sectionId,
        genre_id: articleShapeJson.genreId,
        shape_type: articleShapeJson.shapeTypeId,
        width: Math.max(1, Math.round(articleShapeJson.geometricBounds.width / columnWidth)),
        height: Math.max(1, Math.round(articleShapeJson.geometricBounds.height / rowHeight)),
        body_length: 0,
        quote_count: 0,
        image_count: articleShapeJson.imageComponents?.length || 0,
        fold_line: determineFoldLineApproximately(articleShapeJson.foldLine, columnWidth), // TODO: make accurate by taking page borders into account
        composition_hash: compositionHash,
    };

    // Count text components in the JSON.
    if (articleShapeJson.textComponents) {
        articleShapeJson.textComponents.forEach(textComponent => {
            const standardLabel = elementLabelMapper.mapCustomToStandardLabel(textComponent.type);
            switch(standardLabel) {
                case 'body':
                    articleShapeDto.body_length += textComponent.characters;
                break;
                case 'quote':
                    articleShapeDto.quote_count++;
                break;
            }
        });
    }
    return articleShapeDto;
}

/**
 * Calculate the fold line of the article.
 * This is approximately, because it does NOT respect the Column Gutter and Inside Page Margin.
 * In practice this won't lead into troubles as the gutters/margins are much smaller than the columns.
 * @param {number|null} foldLineInPoints Position of the fold line in the article (from its left side) in points. Null when no fold line.
 * @param {number} columnWidthInPoints Width of a page column in points. Preferably including the column gutter.
 * @param {number} articleWidthInColumns Article width in number of columns.
 * @returns {number|null} The Nth column whereafter the fold line occurs, or null when no fold line.
 */ 
function determineFoldLineApproximately(foldLineInPoints, columnWidthInPoints, articleWidthInColumns) {
    if (foldLineInPoints === null) {
        return null; // No fold line provided, no fold line determined.
    }
    if (articleWidthInColumns <= 1) {
        return null; // For a single column article there can never be a fold line.
    }
    if (columnWidthInPoints === 0) {
        return null; // Bad configuration. Bail out to prevent division by zero.
    }
    let foldLine = Math.round(foldLineInPoints / columnWidthInPoints);
    if (foldLine <= 0 || foldLine >= articleWidthInColumns) {
        // The fold line may occur near to the left or right flank of the article frame due to malpositioned frames.
        // After rounding the fold line will then occur exactly on a flank. Then conclude there is no fold line.
        return null;
    }
    return foldLine;
}

/**
 * Lookup the local filepath based on a given file rendition name.
 * @param {string} fileRenditionName 
 * @param {Array<Object>} localFiles 
 * @returns {string} Local filepath.
 */
function lookupLocalFileByRendition(fileRenditionName, localFiles) {
    let localFilePath = null;
    switch (fileRenditionName) {
        case 'composition':
            localFilePath = localFiles.json;
            break;
        case 'snapshot':
            localFilePath = localFiles.jpeg;
            break;
        case 'definition':
            localFilePath = localFiles.idms;
            break;
        default:
            throw new Error(`Unsupported file rendition "${fileRenditionName}".`);
    }
    return localFilePath;
}

main();