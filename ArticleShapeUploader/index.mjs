/**
 * First, use the ArticleShapeExtractor tool in InDesign to extract the article shapes from 
 * the layouts and to save the article shape files on your local disk.
 * 
 * Second, use the ArticleShapeUploader tool on the CLI to pickup those files and to create 
 * article shape configurations in the PLA service and to upload the files to S3.
 * 
 * Execute this script on CLI, e.g. as follows:
 *    node index.mjs --input_path=~/extracted-article-shapes
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from "readline";
import { StatusCodes } from 'http-status-codes';
import minimist from 'minimist';
import dotenv from 'dotenv';
import { ColoredLogger } from "./ColoredLogger.mjs";

const logger = new ColoredLogger();
dotenv.config();

/**
 * Settings that are effective for this script.
 * Manually adjust any of the factory settings if needed.
 */
function getSettings() {
    return {

        // Connection URL to the PLA service.
        //plaServiceUrl: "https://service.pla-poc.woodwing.cloud",
        plaServiceUrl: "http://127.0.0.1:8000",

        // For PLA a layout page has a simple grid of rows and columns.
        // The space between the page borders in points divided by the column count
        // gives a rough column width in points to be configured here. Same for rows.
        columnWidth: 112,
        rowHeight: 90,

        // For text components 'body' and 'quote' the customer may use different terms.
        // The options below allow specifying which terms are used instead.
        bodyTypes: [ 'body' ],
        quoteTypes: ['quote'],
    };
}

/**
 * Top level execution path of this script.
 */
async function main() {

    const settings = getSettings();
    try {
        const accessToken = resolveAccessToken();
        const brandId = "1"; // TODO: resolve from JSON
        const layoutSettings = await getPageLayoutSettings(
            settings.plaServiceUrl, accessToken, brandId); // TODO: validate against JSON
        if (layoutSettings === null) {
            // TODO: save settings, taken from JSON
        }
        const confirmed = await askConfirmation("Do you want to permanently delete all previously configured article shapes at PLA service?");
        if (!confirmed) {
            logger.warn("Script aborted!");
            return;
        }
        await deleteArticleShapes(settings.plaServiceUrl, accessToken, brandId);
        await scanAndGenerateFilenames(
            resolveInputPath(), 
            await uploadArticleShapeWithFiles(settings, accessToken, brandId)
        );
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
 * Take the directory path from the CPI arguments.
 * This directory should contain the article shapes to upload.
 * @returns {string}
 */
function resolveInputPath() {
    const args = minimist(process.argv.slice(2)); // 2: exclude node and script
    if (typeof args.input_path === "undefined") {
        throw new Error("Argument missing: --input_path=[your_input_path]");
    }
    let inputPath = args.input_path;
    if (inputPath.startsWith('~')) {
        inputPath = path.join(os.homedir(), inputPath.slice(1));
    }
    if (!fs.existsSync(inputPath) || !fs.lstatSync(inputPath).isDirectory()) {
        throw new Error(`Directory "${inputPath}" does not exist.`);
    }
    logger.debug("Input directory:", inputPath);
    return inputPath;
}

/**
 * Retrieve the Document Setup settings from PLA service.
 * These settings are configured per brand.
 * When settings have not been made yet, it returns null.
 * @param {string} plaServiceUrl 
 * @param {string} accessToken 
 * @param {string} brandId 
 * @returns {{margins: {top: Number, bottom: Number, inside: Number, outside: Number}, columns: {gutter: Number}}|null} Settings, or null when not found.
 */
async function getPageLayoutSettings(plaServiceUrl, accessToken, brandId) {
    const url = `${plaServiceUrl}/brands/${brandId}/admin/setting/page-layout`;
    try {
        const request = new Request(url, requestInitForPlaService(accessToken, 'GET'));
        const response = await fetch(request);
        const settings = await response.json();
        logHttpTraffic(request, null, response, settings);
        if (response.ok) {
            const settingsValue = JSON.parse(settings.value);
            logger.debug("Retrieved page layout settings: ", settingsValue);
            return settingsValue;
        }
        if (response.status === StatusCodes.NOT_FOUND) {
            logger.warn("Page layout settings not defined yet.");
            return null;
        }
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
    } catch (error) {
        throw new Error(`Could not retrieve page layout settings - ${error}`);
    }    
}

/**
 * Compose request options for the PLA service.
 * @param {string} accessToken 
 * @param {string} method 
 * @param {String|null} body 
 * @returns {RequestInit}
 */
function requestInitForPlaService(accessToken, method, body=null) {
    return {
        mode: 'cors',
        withCredentials: false,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'content-type': 'application/json'
        },
        body: body,
        method: method
    }
}

/**
 * Ask user for confirmation (y/n) on CLI.
 * @param {string} question 
 * @returns 
 */
function askConfirmation(question) {
    const userPrompt = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => {
        userPrompt.question(`${question} (y/n): `, answer => {
            userPrompt.close();
            resolve(answer.trim().toLowerCase() === 'y');
        });
    });
}

/**
 * Remove all article shapes from the PLA service that were previously configured for a brand.
 * @param {string} plaServiceUrl 
 * @param {string} accessToken
 * @param {string} brandId 
 */
async function deleteArticleShapes(plaServiceUrl, accessToken, brandId) {
    const url = `${plaServiceUrl}/brands/${brandId}/admin/article-shapes`;
    try {
        const request = new Request(url, requestInitForPlaService(accessToken, 'DELETE'));
        const response = await fetch(request);
        logHttpTraffic(request, null, response, null);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        logger.info("Deleted previously configured article shapes.");
    } catch (error) {
        throw new Error(`Could not deleted previously configured article shapes." - ${error.message}`);
    }
}

/**
 * Scans for article shape files and calls the callback with corresponding basename and file paths.
 * The basename of each set of 3 files should be the same and represents the article shape name.
 * The JSON file holds the definition, the JPEG holds the preview and IDMS holds the snippet.
 * @param {string} folderPath - Folder to scan.
 * @param {(baseName: String, files: {json: String, jpeg: String, idms: String}) => void} callback
 */
async function scanAndGenerateFilenames(folderPath, callback) {
    const files = fs.readdirSync(folderPath);
    for (const file of files) {
        if (file.toLowerCase().endsWith('.json')) {
            const baseName = path.basename(file, '.json');
            const localFiles = {
                json: composePathAndAssertExists(folderPath, baseName, 'json'),
                jpeg: composePathAndAssertExists(folderPath, baseName, 'jpg'),
                idms: composePathAndAssertExists(folderPath, baseName, 'idms'),
            };
            const fileRenditions = [
                composeFileRenditionDto('composition', 'application/json; charset=utf-8', 'json'),
                composeFileRenditionDto('snapshot', 'image/jpeg', 'jpg'),
                composeFileRenditionDto('definition', 'application/xml', 'idms'),
            ]
            await callback(baseName, localFiles, fileRenditions);
        }
    }
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
 * @param {Object} settings 
 * @param {string} accessToken 
 * @param {string} brandId 
 */
async function uploadArticleShapeWithFiles(settings, accessToken, brandId) {
    return async function (articleShapeName, localFiles, fileRenditions) {
        logger.info(`Processing article shape "${articleShapeName}".`);
        const raw = fs.readFileSync(localFiles.json, 'utf8');
        const articleShapeJson = JSON.parse(raw);
        const articleShapeDto = articleShapeJsonToDto(
            articleShapeJson, articleShapeName,
            settings.columnWidth, settings.rowHeight, // TODO: take these from the layout settings
            settings.bodyTypes, settings.quoteTypes
        );
        const articleShapeWithRenditionsDto = {
            article_shape: articleShapeDto,
            renditions: fileRenditions,
        };
        const fileRenditionsWithUploadUrls = await createArticleShape(
            settings.plaServiceUrl, accessToken, brandId,
            articleShapeName, articleShapeWithRenditionsDto
        );
        if (fileRenditionsWithUploadUrls === null) {
            return;
        }
        for (const fileRendition of fileRenditionsWithUploadUrls) {
            const localFilePath = lookupLocalFileByRendition(fileRendition.rendition_name, localFiles);
            if (!fileRendition.presigned_url) {
                throw Error(`No pre-signed upload URL for the "${fileRendition.rendition_name} file rendition."`);
            }
            uploadFileToS3(localFilePath, fileRendition.presigned_url, fileRendition.content_type);
        }
    };
}

/**
 * Convert an article shape definition taken from a JSON file into a DTO.
 * The DTO is used to communicate an article shape configuration with the PLA service.
 * @param {Object} articleShapeJson 
 * @param {string} articleShapeName
 * @param {number} columnWidth
 * @param {number} rowHeight
 * @param {Object} bodyTypes
 * @param {Object} quoteTypes
 * @returns {Object} DTO
 */
function articleShapeJsonToDto(articleShapeJson, articleShapeName, columnWidth, rowHeight, bodyTypes, quoteTypes) {
    let articleShapeDto = {
        name: articleShapeName,
        section_id: articleShapeJson.sectionId,
        genre_id: articleShapeJson.genreId,
        shape_type: articleShapeJson.shapeTypeId,
        width: Math.round(articleShapeJson.geometricBounds.width / columnWidth),
        height: Math.round(articleShapeJson.geometricBounds.height / rowHeight),
        body_length: 0,
        quote_count: 0,
        image_count: articleShapeJson.imageComponents?.length || 0,
        fold_line: determineFoldLineApproximately(articleShapeJson.foldLine, columnWidth),
    }

    // Count text components in the JSON.
    if (articleShapeJson.textComponents) {
        articleShapeJson.textComponents.forEach(textComponent => {
            if (bodyTypes.includes(textComponent.type)) {
                articleShapeDto.body_length += textComponent.characters;
            } else if (quoteTypes.includes(textComponent.type)) {
                articleShapeDto.quote_count++;
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
 * Create an article shape configuration in the PLA service.
 * @param {string} plaServiceUrl 
 * @param {string} accessToken 
 * @param {string} brandId 
 * @param {string} articleShapeName 
 * @param {Object} articleShapeWithRenditionsDto
 * @returns {Array<Object>|null} File renditions, with pre-signed URLs, otherwise null.
 */
async function createArticleShape(plaServiceUrl, accessToken, brandId, articleShapeName, articleShapeWithRenditionsDto) {
    const url = `${plaServiceUrl}/brands/${brandId}/admin/article-shape/${articleShapeName}`;
    try {
        const requestBody = JSON.stringify(articleShapeWithRenditionsDto);
        const request = new Request(url, requestInitForPlaService(accessToken, 'POST', requestBody));
        const response = await fetch(request);
        const responseJson = await response.json();
        logHttpTraffic(request, articleShapeWithRenditionsDto, response, responseJson);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        logger.info(`Created article shape "${articleShapeName}".`);
        return responseJson.renditions;
    } catch (error) {
        logger.error(`Could not create article shape "${articleShapeName}" - ${error.message}`);
        return null;
    }
}

/**
 * Log the URL, request JSON body (optional), response status and response JSON body (optional).
 * @param {Request} request
 * @param {string|null} requestJson 
 * @param {Response} response 
 * @param {string|null} responseJson 
 */
function logHttpTraffic(request, requestJson, response, responseJson) {
    const dottedLine = "- - - - - - - - - - - - - - - - - - - - - - -";
    let message = `Network traffic:\n${dottedLine}\nRequest: HTTP ${request.method} ${request.url}\n`;
    if (requestJson) {
        message += `${JSON.stringify(requestJson, null, 3)}\n`;
    }
    message += `${dottedLine}\nResponse: HTTP ${response.status} ${response.statusText}\n`;
    if (responseJson) {
        message += `${JSON.stringify(responseJson, null, 3)}\n`;
    }
    message += dottedLine;
    logger.debug(message);
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

/**
 * Upload a local file to S3 using a pre-signed URL.
 * @param {string} localFilePath
 * @param {string} presignedUrl
 * @param {string} contentType
 * @returns {boolean} Whether the upload was successful.
 */
async function uploadFileToS3(localFilePath, presignedUrl, contentType) {
    try {
        const fileStream = fs.createReadStream(localFilePath);
        const stats = fs.statSync(localFilePath);
        const request = new Request(presignedUrl, {
            method: 'PUT',
            body: fileStream,
            headers: {
                "Content-Length": stats.size,
                'Content-Type': contentType,
            },
            duplex: "half" // Required when sending a stream
        });
        const response = await fetch(request);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        logHttpTraffic(request, null, response, null);
        logger.info(`Uploaded file "${path.basename(localFilePath)}" successfully to S3.`);
        return true;
    } catch (error) {
        logger.error(`Error uploading file "${path.basename(localFilePath)}" - ${error.message}`);
        return false;
    }
}

main();