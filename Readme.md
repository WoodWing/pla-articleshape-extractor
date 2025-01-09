# Introduction
ArticleShapeExtractor is a set of InDesign scripts that export the content of existing layout as ArticleShapes used for Print Layout Automation

# Installation
The scripts can be used from either the user or the application Scripts folder. To locate the folder start InDesign, select `Window > Utilities > Scripts` to display the Scripts panel, right click the Application or User folder and select Reveal in Finder. This will take you to the Scripts Panel folder which is located in the Scripts folder. 

Copy the `ArticleShapeExtractor` folder to `Scripts\Scripts Panel` folder. 
Copy the files in `Startup Scripts` to `Scripts\Startup Scripts` folder.

After (re)starting InDesign the main menu has an Extract article shapes menu is added to  the WoodWing Studio menu 

# Configure keyboard shortcuts
Open keyboards shortcuts dialog Edit->Keyboard Shortcuts...
Select product area scripts
Attach the following keyboard shortcuts
- Shift-Cmd-J to ArticleShapeExtractor:CreateLeadArticle.jsx
- Shift-Cmd-K to ArticleShapeExtractor:CreateSecondaryArticle.jsx
- Shift-Cmd-L to ArticleShapeExtractor:CreateThirdArticle.jsx
- Shift-Cmd-; to ArticleShapeExtractor:CreateFillerArticle.jsx
- Shift-Cmd-E to ArticleShapeExtractor:ExtractArticleShapes.jsx
Save it as a new set

# Usage
- Create InDesign Articles with frames for each ArticleShape you would like to export, the name should contain: Lead, Secondary, Third, Filler 
    - Shift-Cmd-J to create a Lead article
    - Shift-Cmd-K to create a Secondary article
    - Shift-Cmd-L to create a Third article
    - Shift-Cmd-; to create a Filler article
- Select "Extract article shapes" (Shift-Cmd-E) from the WoodWing Studio menu
- Select a folder to export the shapes to
- For each Indesign article a idms, jpg and json file is created
- You can use the generated images to verify if the export was correct



The extracted Article Shapes can be converted to a Print Layout Automation csv/xls using this [link](https://woodwing.github.io/pla-articleshape-extractor/create-pla-config.html)