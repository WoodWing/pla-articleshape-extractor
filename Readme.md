# Introduction
ArticleShapeExtractor is a set of InDesign scripts that export the content of existing layout as ArticleShapes used for Print Layout Automation

# Installation
The scripts can be used from either the user or the application Scripts folder. To locate the folder start InDesign, select `Window > Utilities > Scripts` to display the Scripts panel, right click the Application or User folder and select Reveal in Finder. This will take you to the Scripts Panel folder which is located in the Scripts folder. 

Copy the `ArticleShapeExtractor` and the `Startup Scripts` folders to the `Scripts` folder. `Startup Scripts` might have to be merged with an existing `Startup Scripts` folder.

After (re)starting InDesign the main menu has an Extract article shapes menu is added to  the WoodWing Studio menu 

# Usage
- Create InDesign Articles with frames for each ArticleShape you would like to export, use one of the following names: lead, secondary, third, filler 
- Select "Extract article shapes" from the WoodWing Studio menu
- Select a folder to export the shapes to
- For each Indesign article a idms, jpg and json file is created

The extracted Article Shapes can be converted to a Print Layout Automation csv/xls using this [link]()