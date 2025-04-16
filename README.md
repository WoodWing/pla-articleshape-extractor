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
3. Attach the following keyboard shortcuts:
   * `Cmd-1` to `ArticleShapeExtractor:command:CreateLeadArticle.idjs`
   * `Cmd-2` to `ArticleShapeExtractor:command:CreateSecondaryArticle.idjs`
   * `Cmd-3` to `ArticleShapeExtractor:command:CreateThirdArticle.idjs`
   * `Cmd-4` to `ArticleShapeExtractor:command:CreateFillerArticle.idjs`
   * `Shift-Cmd-E` to `ArticleShapeExtractor:command:ExtractArticleShapes.idjs`
4. Save it as a new set.

# Usage
Extract Article Shapes from a layout in InDesign:
1. Open a new or existing layout in InDesign.
2. Click menu `Window > Articles` to open the `Articles` panel.
3. For the frames on the layout you would like to export:
   1. Make a selection of frames that belong to the same article.
   2. Press one of the following shortcut keys:
      * `Cmd-1` to create a `Lead` article.
      * `Cmd-2` to create a `Secondary` article.
      * `Cmd-3` to create a `Third` article.
      * `Cmd-4` to create a `Filler` article.
   * In the `Articles` panel, a new InDesign Article should be created.
   * When manually editing the article name, assure it contains at least either `Lead`, `Secondary`, `Third` or `Filler`.
   3. Repeat the steps above for each article to export.
4. Select menu `WoodWing Studio > Extract article shapes` (or press the `Shift-Cmd-E` shortcut key) and select a folder to export the shapes to.
   * For each InDesign Article a `idms`, `jpg` and `json` file is created.
   * You can use the `jpg` files to verify if the export was correct.

The extracted Article Shapes can be converted to a Print Layout Automation configuration file (`csv` or `xls`) using [this link](https://woodwing.github.io/pla-articleshape-extractor/create-pla-config.html).

# Configuration
Look up the plugin data folder:
* Plugins Installed from CCD or Plugin Market Place (External)
  * Windows: AppData\Roaming\Adobe\UXP\PluginsStorage\IDSN\{App Version}\External
  * MacOSX: Library/Application Support/Adobe/UXP/PluginsStorage/IDSN/{App Version}/External
* Plugins Installed from UDT or Developer Plugins (Developer)
  * Windows: AppData\Roaming\Adobe\UXP\PluginsStorage\IDSN\{App Version}\Developer
  * MacOSX: Library/Application Support/Adobe/UXP/PluginsStorage/IDSN/{App Version}/Developer
See [source](https://developer.adobe.com/indesign/uxp/resources/recipes/persistent-storage-migration/)

In the plugin data folder, create a new file named `config-local.json` (if not exists yet).
Copy the following structure into the file:
```json
{
    "plaServiceUrl": "https://service.pla-poc.woodwing.cloud",
    "regenerateArticleShapesQueryName": "RegenerateArticleShapes",
    "offlineFallback": {
        "brand": {
            "id": "1",
            "name": "WW News"
        },
        "category": {
            "id": "1",
            "name": "News"
        }
    },
    "logger": {
        "level": "ERROR",
        "filename": "pla.log",
        "folder": "plugin-data:",
        "wipe": true
    },
    "includeErrorDetailInAlerts": true
}
```
The values shown are the factory defaults. Any modification to this file will override the factory defaults. For example adjust the logger level from ERROR into DEBUG to see all log messages.

> **Developer note:** The factory defaults can be found in the [config.js](ArticleShapeExtractor/config/config.js) file. If you want to temporary change settings, do ___not___ edit that file. Instead, adjust the `config-local.json` file which will locally override the factory defaults.