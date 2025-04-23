# Introduction
Article Shape Extractor tool for the Print Layout Automation (PLA) project. The tool exports the content of a layout file (opened in Adobe InDesign) to Article Shapes. The shapes are used to configure the project. The tool is a set of scripts to be installed in your InDesign application.

# Installation
Install the tool in your InDesign application:
1. Start InDesign.
2. Locate the `Scripts/Scripts Panel` folder:
   1. Select menu `Window > Utilities > Scripts` to display the `Scripts` panel.
   2. Right-click either the `Application` or `User` item and select the `Reveal in Finder` item from the context menu. 
3. Copy the [ArticleShapeExtractor](ArticleShapeExtractor) folder to the `Scripts/Scripts Panel` folder. 
4. Copy the files from [Startup Scripts](<Startup Scripts>) to the `Scripts/startup scripts` folder.
5. Restart InDesign.
   * The `WoodWing Studio` menu should now list an additional menu item, named `Extract article shapes`.

# Configure keyboard shortcuts
In InDesign, configure shortcut keys to the installed scripts:
1. Click menu `Edit > Keyboard Shortcuts...` to open the `Keyboards Shortcuts` dialog.
2. For the `Product Area` field, select the `Scripts` item.
3. Attach any keyboard shortcuts you prefer, for example:
   * `Cmd+1` to `ArticleShapeExtractor:command:CreateLeadArticle.idjs`
   * `Cmd+2` to `ArticleShapeExtractor:command:CreateSecondaryArticle.idjs`
   * `Cmd+3` to `ArticleShapeExtractor:command:CreateThirdArticle.idjs`
   * `Cmd+4` to `ArticleShapeExtractor:command:CreateFillerArticle.idjs`
   * `Shift+Cmd+E` to `ArticleShapeExtractor:command:ExtractArticleShapes.idjs`
4. Save it as a new set.

# Usage
Extract Article Shapes from a layout in InDesign:
1. Open a new or existing layout in InDesign.
2. Click menu `Window > Articles` to open the `Articles` panel.
3. For the frames on the layout you would like to export:
   1. Make a selection of frames that belong to the same article.
   2. Press one of the following shortcut keys:
      * `Cmd+1` to create a `Lead` article.
      * `Cmd+2` to create a `Secondary` article.
      * `Cmd+3` to create a `Third` article.
      * `Cmd+4` to create a `Filler` article.
   * In the `Articles` panel, a new InDesign Article should be created.
   * When manually editing the article name, assure it contains at least either `Lead`, `Secondary`, `Third` or `Filler`.
   3. Repeat the steps above for each article to export.
4. Press the `Shift+Cmd+E` shortcut key to run the `ExtractArticleShapes.idjs` script and select a folder to export the shapes to.
   * For each InDesign Article a `idms`, `jpg` and `json` file is created.
   * You can use the `jpg` files to verify if the export was correct.

The extracted Article Shapes can be converted to a Print Layout Automation configuration file (`csv` or `xls`) using [this link](https://woodwing.github.io/pla-articleshape-extractor/create-pla-config.html).

# Configuration
The [config.js](ArticleShapeExtractor/config/config.js) file contains factory settings. All supported settings are listed and explained in that file. Don't edit this file directly, but first copy any setting to your [config-local.js](ArticleShapeExtractor/config/config-local.js) file and make adjustments in that file instead. Make sure you also copy the surrounding/parental structure elements, if any.

Note that settings added to your `config-local.js` file will override the factory settings provided in the `config.js` file. Keep an eye on both files to understand which setting is effective.

An example - By default, the logging feature is disabled. To enable it:
1. First time only - If the `config-local.js` file does not exist yet, create a new one with the following content:
   ```javascript
   const plaLocalConfig = {
   };
   module.exports = plaLocalConfig;
   ```
2. Copy the `logger` structure from the `config.js` file to your `config-local.js` file:
   ```javascript
   const plaLocalConfig = {
      logger: {
      },
   };
   module.exports = plaLocalConfig;
   ```
3. Inside the `logger` structure, copy the `level` and `folder` settings and adjust their values:
   ```javascript
   const plaLocalConfig = {
      logger: {
         level: "INFO",
         folder: "/Users/[YOUR-NAME]/Desktop",
      },
   };
   module.exports = plaLocalConfig;
   ```
   > Note that in the provided example your should replace `[YOUR-NAME]` with your actual user name as known on your machine. 

4. Optionally - In case you want to automatically clean the log file before each script execution, also include the `wipe` setting and set it to `true`.

# Development notes

## How to debug an IDJS script?
1. Open the `Adobe UXP Developer Tools` application.
2. Click on the `Connected Apps` icon in the side panel.
3. InDesign should be listed. Click the `Debug Script` button.
4. Drag & Drop any of the IDJS scripts from the `commands` folder onto the dialog.
5. Add your breakpoints and/or step through the code.
> Note that in this context, accessing `host` and `os` properties cause fatal errors.

## How to link the GitHub project straight into InDesign?
Assumed that `~/git` is your local GitHub root folder:
```bash
cd /Applications/Adobe\ InDesign\ 2024/Scripts/Scripts\ Panel
ln -s ~/git/pla-articleshape-extractor/Startup\ Scripts

cd /Applications/Adobe\ InDesign\ 2025/Scripts/Scripts\ Panel
ln -s ~/git/pla-articleshape-extractor/Startup\ Scripts
```
Now your modifications to the scripts are directly reflected to both GitHub and InDesign.

## Known Adobe limitations for UXP/IDJS
1. An IDJS script requires InDesign 18.0 and an UXP plugin requires InDesign 18.5.
2. InDesign 18.5 does not make the WoodWing InDesign plugin API available. InDesign 19.0 is required.
3. There are no startup/shutdown or init/exit events for UXP plugins.
4. A JSX script can not invoke an IDJS script (e.g. via `app.doScript(...)`).
5. IDJS scripts in the `Startup Scripts` folder are not recognized/executed by InDesign.
6. Bullets 3, 4 and 5 make it impossible to add a menu item or shortcut key for a UXP/IDJS script.
