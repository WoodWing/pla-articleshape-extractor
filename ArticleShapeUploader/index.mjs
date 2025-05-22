/**
 * See README.md for installation and usage of this script.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import diff from 'deep-diff';

import { AppSettings } from "./modules/AppSettings.mjs";
import { ColoredLogger } from "./modules/ColoredLogger.mjs";
import { CliParams } from "./modules/CliParams.mjs";
import { PageLayoutSettingsReader } from "./modules/PageLayoutSettingsReader.mjs";
import { ElementLabelMapper } from './modules/ElementLabelMapper.mjs';
import { ArticleShapeHasher } from "./modules/ArticleShapeHasher.mjs";
import { JsonValidator } from "./modules/JsonValidator.mjs";
import { PlaService } from "./modules/PlaService.mjs";

import { uploaderDefaultConfig } from "./config/config.mjs";
let uploaderLocalConfig = {}
try {
    const localModule = await import("./config/config-local.mjs");
    uploaderLocalConfig = localModule.uploaderLocalConfig;
} catch (error) {
}
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appSettings = new AppSettings(uploaderDefaultConfig, uploaderLocalConfig);
const logger = new ColoredLogger(appSettings.getLogLevel());
const cliParams = new CliParams(logger);
const jsonValidator = new JsonValidator(logger, path.join(__dirname, 'schemas'));
const pageLayoutSettingsReader = new PageLayoutSettingsReader(logger, jsonValidator);
const elementLabelMapper = new ElementLabelMapper(logger, jsonValidator);
const hasher = new ArticleShapeHasher(elementLabelMapper);
const plaService = new PlaService(appSettings.getPlaServiceUrl(), appSettings.getLogNetworkTraffic(), logger);

/**
 * Top level execution path of this script.
 */
async function main() {
    try {
        dotenv.config();
        const inputPath = cliParams.resolveInputPath();
        const pageLayoutSettings = pageLayoutSettingsReader.readSettings(inputPath);
        const accessToken = resolveAccessToken();
        const articleShapeJson = await takeFirstArticleShapeJson(inputPath);
        const { brandId, sectionId } = cliParams.resolveBrandAndSectionToUse(articleShapeJson.brandId, articleShapeJson.sectionId);
        const pageGrid = await assureBlueprintsConfiguredAndDerivePageGrid(accessToken, brandId);
        pageLayoutSettingsReader.setPageGrid(pageGrid);
        await assureTallyPageLayoutSettings(accessToken, brandId, pageLayoutSettings)
        elementLabelMapper.init(await plaService.getElementLabelMapping(accessToken, brandId));
        if (await cliParams.shouldDeletePreviouslyConfiguredArticleShapes()) {
             await plaService.deleteArticleShapes(accessToken, brandId);
        }
        await scanDirAndUploadFiles(inputPath, accessToken, brandId, sectionId);
        await validateBrandConfiguration(accessToken, brandId);
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

    const [, payload] = accessToken.split('.');
    const decoded = Buffer.from(payload, 'base64').toString();
    logger.info(`Targeting for systemId "${JSON.parse(decoded).systemId}".`);

    return accessToken;
}

/**
 * Aborts when there are no blueprints configured yet.
 * Derive the page grid from the blueprint sheets and return it.
 * Blueprints should be configured already in a normal flow.
 * Having blueprints, enables us to validate the shapes after.
 * @param {string} accessToken 
 * @param {string} brandId 
 * @returns {{columnCount: number, rowCount: number}} Page grid.
 */
async function assureBlueprintsConfiguredAndDerivePageGrid(accessToken, brandId) {
    const sheetDimensions = await plaService.getSheetDimensions(accessToken, brandId);
    if (sheetDimensions.length === 0) {
        throw new Error("There are no blueprints configured yet.");
    }
    logger.info("Found configured blueprints for this brand.");

    let pageGrid = null;
    for (const sheetDimension of sheetDimensions) {
        if (sheetDimension.sheet_type === "page") {
            pageGrid = { columnCount: sheetDimension.width, rowCount: sheetDimension.height };
            break;
        } else if (sheetDimension["sheet_type"] === "spread") {
            pageGrid = { columnCount: sheetDimension.width / 2, rowCount: sheetDimension.height };
            continue; // prefer picking from sheet type "page"
        }
    }
    if (pageGrid === null) { // should never happen; blueprints always have pages/spreads
        throw new Error("Could not resolve page dimensions from blueprint sheets.");
    }
    logger.info(`Derived page grid ${pageGrid.columnCount}x${pageGrid.rowCount} from blueprint sheet dimensions.`);
    return pageGrid;
}

/**
 * Retrieve the page layout settings from the PLA service and validate them.
 * Raise error when they differ with the ones read from input folder.
 * @param {string} accessToken 
 * @param {string} brandId 
 * @param {string} inputPageLayoutSettings Read from input path.
 */
async function assureTallyPageLayoutSettings(accessToken, brandId, inputPageLayoutSettings) {
    const plaPageLayoutSettings = await plaService.getPageLayoutSettings(accessToken, brandId);
    if (plaPageLayoutSettings === null) {
        throw new Error("There are no page layout settings configured yet. "
            + "Please import the PLA Config Excel file and try again.");
    }
    jsonValidator.validate('page-layout-settings', plaPageLayoutSettings);
    if (diff(plaPageLayoutSettings, inputPageLayoutSettings)) {
        logger.error("The page layout settings retrieved from PLA service differ from the ones "
            + "read from input folder. ", plaPageLayoutSettings, inputPageLayoutSettings);
    }
}

/**
 * 
 * @param {string} folderPath 
 * @returns {Object} Article shape JSON.
 */
async function takeFirstArticleShapeJson(folderPath) {
    let articleShapeJson = null;
    await scanDirForArticleShapeJson(folderPath, async (baseName) => {
        const jsonFilePath = composePathAndAssertExists(folderPath, baseName, 'json');
        articleShapeJson = validateArticleShapeJson(jsonFilePath);
        return false;
    });
    if (articleShapeJson === null) {
        new Error(`The "${folderPath}" folder does not contain JSON files.`);
    }
    return articleShapeJson;
}

/**
 * Scans through a given for for article shape JSON files. For each file it creates 
 * an article shape configuration in the PLA service and uploads 3 files to S3.
 * The basename of each set of 3 files should be the same and represents the article shape name.
 * The JSON file holds the definition, the JPEG holds the preview and IDMS holds the snippet.
 * @param {string} folderPath 
 * @param {string} accessToken 
 * @param {string} brandId 
 * @param {string} sectionId 
 */
async function scanDirAndUploadFiles(folderPath, accessToken, brandId, sectionId) {
    await scanDirForArticleShapeJson(folderPath, async (baseName) => {
        const jsonFilePath = composePathAndAssertExists(folderPath, baseName, 'json');
        const articleShapeJson = validateArticleShapeJson(jsonFilePath);
        const shouldUploadFiles = cliParams.shouldUploadFiles();
        const localFiles = shouldUploadFiles ? {
            json: jsonFilePath,
            jpeg: composePathAndAssertExists(folderPath, baseName, 'jpg'),
            idms: composePathAndAssertExists(folderPath, baseName, 'idms'),
        } : {};
        const fileRenditions = shouldUploadFiles ? [
            composeFileRenditionDto('composition', 'application/json; charset=utf-8', 'json'),
            composeFileRenditionDto('snapshot', 'image/jpeg', 'jpg'),
            composeFileRenditionDto('definition', 'application/xml', 'idms'),
        ] : [];
        await uploadArticleShapeWithFiles(
            accessToken, brandId, sectionId, baseName, articleShapeJson, localFiles, fileRenditions);        
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
        if (file.toLowerCase().endsWith('.json') && file !== pageLayoutSettingsReader.getFilename()) {
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
    jsonValidator.validate('article-shape',jsonData);
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
 * @param {string} sectionId 
 * @param {string} articleShapeName 
 * @param {Object} articleShapeJson
 * @param {Array<Object>} localFiles
 * @param {Array<string>} fileRenditions 
 */
async function uploadArticleShapeWithFiles(
    accessToken, brandId, sectionId, articleShapeName, articleShapeJson, localFiles, fileRenditions
) {
    logger.info(`Processing article shape "${articleShapeName}".`);
    const compositionHash = hasher.hash(articleShapeJson);
    const articleShapeDto = articleShapeJsonToDto(articleShapeJson, articleShapeName, compositionHash);
    articleShapeDto.section_id = sectionId;
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
    const actualFoldLineInPoints = sanitizeFoldLineInPoints(articleShapeJson.foldLine);
    const articleWidthInColumns = calculateArticleWidthInColumns(articleShapeJson.geometricBounds.width, actualFoldLineInPoints);
    const rowHeightInPoints = pageLayoutSettingsReader.getRowHeight();
    const articleHeightInRows = Math.max(1, Math.round(articleShapeJson.geometricBounds.height / rowHeightInPoints));

    let articleShapeDto = {
        name: articleShapeName,
        section_id: articleShapeJson.sectionId,
        genre_id: articleShapeJson.genreId,
        shape_type: articleShapeJson.shapeTypeId,
        width: articleWidthInColumns,
        height: articleHeightInRows,
        body_length: 0,
        quote_count: 0,
        image_count: articleShapeJson.imageComponents?.length || 0,
        fold_line: determineFoldLineInColumns(actualFoldLineInPoints, articleWidthInColumns),
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
 * If the article is placed to near to the fold line, assume the article is placed at the fold line.
 * In that case, assume there is no fold line, so return null. Otherwise, just use the fold line as provided. 
 * @param {number|null} foldLineInPoints 
 * @returns {number|null} Fold line, or null if no fold line.
 */
function sanitizeFoldLineInPoints(foldLineInPoints) {
    const columnWidthInPoints = pageLayoutSettingsReader.getColumnWidth();
    // If article is technically placed on the LHS page but too near to the fold line,
    // assume it supposed to be placed at the very left of the RHS page, so no fold line.
    if (foldLineInPoints < (pageLayoutSettingsReader.getPageMarginInside() + (columnWidthInPoints/2))) {
        foldLineInPoints = null;
    }
    return foldLineInPoints;
}

/**
 * Convert the article width from InDesign points into PLA page grid columns.
 * @param {number} actualWidthInPoints 
 * @param {number} foldLineInPoints 
 * @returns {number}
 */
function calculateArticleWidthInColumns(actualWidthInPoints, foldLineInPoints) {
    const columnGutterInPoints = pageLayoutSettingsReader.getColumnGutter();
    let uniformWidthInPoints = actualWidthInPoints;
    // When there is a fold line, exclude right margin of LHS page and left margin of RHS page.
    // Instead, add the size of a column gutter. So in fact, 'replace' page margins with a gutter.
    // As a result, further calculations will then work the same as without a fold line.
    if (foldLineInPoints !== null) {
        uniformWidthInPoints -= (2 * pageLayoutSettingsReader.getPageMarginInside());
        uniformWidthInPoints += columnGutterInPoints;
    }
    const columnWidthInPoints = pageLayoutSettingsReader.getColumnWidth();
    const preciseWidthInColumns = (uniformWidthInPoints + columnGutterInPoints) / (columnWidthInPoints + columnGutterInPoints);
    const roundedWidthInColumns = Math.max(1, Math.round(preciseWidthInColumns));
    logger.debug(`Column count calculation:\n`
        + ` - actualWidthInPoints = ${actualWidthInPoints}\n`
        + ` - uniformWidthInPoints = ${uniformWidthInPoints}\n`
        + ` - columnWidthInPoints = ${columnWidthInPoints}\n`
        + ` - preciseWidthInColumns = ${preciseWidthInColumns}\n`
        + ` - roundedWidthInColumns = ${roundedWidthInColumns}`
    );
    return roundedWidthInColumns;
}

/**
 * Calculate the fold line of the article in terms of whole columns (of page grid).
 * E.g. the value 1 means, the fold line appears between the 1st and 2nd column of the article.
 * @param {number|null} actualFoldLineInPoints Position of the fold line in the article (from its left side) in points. Null when no fold line.
 * @param {number} articleWidthInColumns Article width in number of columns.
 * @returns {number|null} The Nth column whereafter the fold line occurs, or null when no fold line.
 */ 
function determineFoldLineInColumns(actualFoldLineInPoints, articleWidthInColumns) {
    if (actualFoldLineInPoints === null) {
        return null; // No fold line provided, no fold line determined.
    }
    if (articleWidthInColumns <= 1) {
        return null; // For a single column article there can never be a fold line.
    }
    const columnGutterInPoints = pageLayoutSettingsReader.getColumnGutter();
    const columnWidthInPoints = pageLayoutSettingsReader.getColumnWidth();
    const insidePageMarginInPoints = pageLayoutSettingsReader.getPageMarginInside();
    const uniformFoldLineInPoints = actualFoldLineInPoints - insidePageMarginInPoints;
    const preciseFoldLineInColumns = (uniformFoldLineInPoints + columnGutterInPoints) / (columnWidthInPoints + columnGutterInPoints);
    const roundedFoldLineInColumns = Math.round(preciseFoldLineInColumns);
    logger.debug(`Fold line calculation:\n`
        + ` - articleWidthInColumns = ${articleWidthInColumns}\n`
        + ` - actualFoldLineInPoints = ${actualFoldLineInPoints}\n`
        + ` - insidePageMarginInPoints = ${insidePageMarginInPoints}\n`
        + ` - preciseFoldLineInColumns = ${preciseFoldLineInColumns}\n`
        + ` - roundedFoldLineInColumns = ${roundedFoldLineInColumns}`
    );
    if (roundedFoldLineInColumns <= 0 || roundedFoldLineInColumns >= articleWidthInColumns) {
        // The fold line may occur near to the left or right flank of the article frame due to malpositioned frames.
        // After rounding the fold line will then occur exactly on a flank. Then conclude there is no fold line.
        return null;
    }
    return roundedFoldLineInColumns;
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
 * Request for the brand setup validation report composed by the PLA service.
 * @param {string} accessToken 
 * @param {string} brandId 
 */
async function validateBrandConfiguration(accessToken, brandId) {
    const validationReport = await plaService.validateBrandConfiguration(accessToken, brandId);
    let logReport = '';
    for (const validationItem of validationReport) {
        logReport += ` - ${validationItem.severity}: ${validationItem.description}\n`;
    }
    if (logReport) {
        logger.error(`Brand setup seems invalid:\n${logReport}`);
    } else {
        logger.info("Brand setup is valid.");
    }
}

main();