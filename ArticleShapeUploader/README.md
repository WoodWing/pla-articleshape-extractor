# Introduction
Article Shape Uploader tool for the Print Layout Automation (PLA) project.
Refer to [here](../README.md) for an overview of the available tools.

# Installation
Assure you have Node v23 or higher installed:
```bash
node -v
```

Install the Article Shape Uploader tool:
```bash
cd ArticleShapeUploader
npm install
echo "PLA_ACCESS_TOKEN=[your_token_here]" >> .env
```

# Configuration
The [config.mjs](ArticleShapeUploader/config/config.mjs) file contains factory settings. All supported settings are listed and explained in that file. Don't edit this file directly, but first copy any setting to your [config-local.mjs](ArticleShapeUploader/config/config-local.mjs) file and make adjustments in that file instead. Make sure you also copy the surrounding/parental structure elements, if any.

Note that settings added to your `config-local.mjs` file will override the factory settings provided in the `config.mjs` file. Keep an eye on both files to understand which setting is effective.

An example - By default, only standard element labels are supported. To allow custom element labels:
1. First time only - If the `config-local.mjs` file does not exist yet, create a new one with the following content:
   ```javascript
   export const uploaderLocalConfig = {
   };
   ```
2. Copy any settings from the `config.js` file to your `config-local.js` file, e.g:
   ```javascript
   export const uploaderLocalConfig = {
      logLevel: 'WARNING',
   };
   ```
3. Adjust the value of the copied setting in your `config-local.js` file, e.g:
   ```javascript
   export const uploaderLocalConfig = {
      logLevel: 'INFO',
   };
   ```

# Usage
```bash
cd ArticleShapeUploader
node index.mjs --input-path=[your_extracted_article_shapes_folder] --old-shapes=[delete|keep]
```

Explanation for the above and support for additional parameters can be shown as follows:
```bash
cd ArticleShapeUploader
node index.mjs --help
```

# Upload shapes to a different brand (than extracted from)

The Article Shape Uploader allows 'copying' shapes from one brand to another. Assumed is that you have two similar brands, and that you have prepared both brands; You have setup the blueprints and configured additional the settings via the PLA Config Excel file and imported this in both brands. For the source brand you already have setup the article shapes and you have executed the Article Shapes Extractor tool to download all to local disk.

In the export folder created by the Article Shape Extractor tool, there is a file named `_manifest/brand-section-map.json` which contains all the ids and names of the brands and sections of the Studio installation. The Article Shape Uploader will use this file in case you want to upload the article shapes for a different brand than you have extracted from. With an optional parameter named `--target-brand` you can specify the brand name to upload for:

```bash
cd ArticleShapeUploader
node index.mjs --input-path=[your_extracted_article_shapes_folder] --old-shapes=[delete|keep] --target-brand=[brand_name]
```

Inside the article shape JSON files, the id and name of the brand and section is embedded. This represents the brand/section where you have extracted the article shape from. When specifying a different brand to upload to, the Article Shape Uploader will use the `_manifest/brand-section-map.json` file to lookup the provided brand name and resolve its id. And, it will take the section name from each article shape JSON file and lookup the section id that is configured under the target brand. Note that the tool assumes that the section names exist in both brands; source and target.
