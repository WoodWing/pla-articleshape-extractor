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
ln -s ~/git/pla-articleshape-extractor/ArticleShapeExtractor

cd /Applications/Adobe\ InDesign\ 2024/Scripts/startup\ scripts
ln -s ~/git/pla-articleshape-extractor/ArticleShapeExtractor/startup\ scripts/ArticleShapeExtractorStartup.jsx
```
Now your modifications to the scripts are directly reflected to both GitHub and InDesign.

## Known Adobe limitations for UXP/IDJS
1. An IDJS script requires InDesign 18.0 and an UXP plugin requires InDesign 18.5.
2. InDesign 18.5 does not make the WoodWing InDesign plugin API available. InDesign 19.0 is required.
3. There are no startup/shutdown or init/exit events for UXP plugins.
4. A JSX script can not invoke an IDJS script (e.g. via `app.doScript(...)`).
5. IDJS scripts in the `Startup Scripts` folder are not recognized/executed by InDesign.
6. Bullets 3, 4 and 5 make it impossible to add a menu item or shortcut key for a UXP/IDJS script.

## Code checker and formatter

### Installation

Install `ESLint` for code validation and its `stylistic` plugin for code formatting:
```bash
cd ArticleShapeExtractor
npm ci
```

Make sure you have the `ESLint` VS Code extension installed:
* Publisher: `Microsoft`
* ID: `dbaeumer.vscode-eslint`

### Configuration

Settings are made in:
* ESLint configuration and rules: [eslint.config.mjs](eslint.config.mjs)
* VSCode settings to use ESLint: [settings.json](../.vscode/settings.json)
* Node dependencies and scripts: [package.json](package.json)

### Usage

Validate whole project at once:
```bash
cd ArticleShapeExtractor
npm run lint
```

Auto fix whole project at once:
```bash
cd ArticleShapeExtractor
npm run lint:fix
```

In VS Code:
* ESLint errors are reported via red curly underlines in the editor.
* When saving a source file, it gets auto formatted by ESLint's stylistic plugin.
