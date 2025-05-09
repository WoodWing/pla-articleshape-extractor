# Introduction
Article Shape Uploader tool for the Print Layout Automation (PLA) project.
Refer to [here](../README.md) for an overview of the available tools.

# Installation
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
2. Copy the `elementLabels` structure from the `config.js` file to your `config-local.js` file:
   ```javascript
   export const uploaderLocalConfig = {
      elementLabels: {
         body: null,
      }
   };
   ```
3. Inside the `elementLabels` structure, copy the `body` setting and adjust values:
   ```javascript
   export const uploaderLocalConfig = {
      elementLabels: {
         body: '^brood \\d$',
      }
   };
   ```

# Usage
```bash
cd ArticleShapeUploader
node index.mjs --input_path=[your_extracted_article_shapes_folder]
```
