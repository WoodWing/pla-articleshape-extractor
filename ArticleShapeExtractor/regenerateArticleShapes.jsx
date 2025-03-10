//@include "ExtractArticleShapesLibrary.inc.jsx";

//=======================================
// Identify the desired query to use
//=======================================
var articleQueryName = "RegenerateArticleShapes";

//=======================================
// Set the user interaction level to 'never interact' this is set back to 'normal' 
// at the end of the script
//=======================================
app.scriptPreferences.userInteractionLevel = UserInteractionLevels.neverInteract;

var totalEntries = -1;
var listedEntries = 0;

// Prompt the user to select the folder for saving the ArticleShapes
var folder = Folder.selectDialog("Select a folder to save the ArticleShapes:");
if (folder) {
    //=======================================
    // Begin the work of the script...do the query and get the results back...
    //=======================================
    try {

      while (totalEntries != listedEntries) {
            //=======================================
            // Send a query to Enterprise
            //=======================================
            var query = app.storedUserQuery(articleQueryName);
            if(query == undefined) {
                alert(" User Query '" + articleQueryName + "' does not exist.");
                exit();
            }
            
            //=======================================
            //Push the query results into an array using new lines as the value to split by
            //=======================================
            var stringToArray = new Array();
            var stringToArray = query.split(/\n/g);

            //=======================================
            //Count the number of objects in the array
            //=======================================
            var countOfObjects = stringToArray.length;

            //=======================================
            // Iterate through the array, do a regular expression to find the records
            // Remove the < and > characters and push the record into another array
            //=======================================
            if (countOfObjects > 0) {
                var b = 0;
                var newArrayOfRecords = new Array();

                for (var a = 1; a < countOfObjects; ++a) {
                    //=======================================
                    // Look for records in the query result
                    // This is done by looking at the returning query, parsing it by 
                    // Regular Expression, pushing the found records into a new
                    // array and then grabbing the ID of each record
                    //=======================================				

                    //=======================================
                    // Regular Expression looks for items surrounded by brackets
                    // The regular expression is pretty simple...look for anything surrounded by brackets
                    //=======================================
                    var recordExists = new RegExp("<.*>");

                    //=======================================
                    //Perform the regular expression search
                    //=======================================
                    var regExpSearchResult = recordExists.test(stringToArray[a]);

                    //=======================================
                    // If the RegEx search finds a result process it
                    //=======================================
                    if (regExpSearchResult == true) {

                        //=======================================
                        //Set two variable for the brackets
                        //=======================================
                        var strOne = "<";
                        var strTwo = ">";

                        var finalValueA = stringToArray[a].replace(strOne, "");

                        var finalValueB = finalValueA.replace(strTwo, "");

                        newArrayOfRecords[b] = finalValueB.split(",")

                        b = b + 1;

                        myRecord = newArrayOfRecords[b];

                    }
                    else {
                        if (stringToArray[a].indexOf ("Total Entries: ") != -1) {
                            totalEntries = Number (stringToArray[a].replace("Total Entries: ", "")); 
                        }

                        if (stringToArray[a].indexOf ("Listed Entries: ") != -1) {
                            listedEntries = Number (stringToArray[a].replace("Listed Entries: ", "")); 
                        }
                    }
                }

                //=======================================
                // Count the size of the newly created array
                //=======================================
                var countOfNewArrayOfRecords = newArrayOfRecords.length;

                //=======================================
                // If the count of the array is greater than zero...let's do our stuff
                //=======================================

                if (countOfNewArrayOfRecords > 0) {

                    for (var x = 0; x < countOfNewArrayOfRecords; ++x) {
                        //=======================================
                        // Get the id of the file
                        //=======================================
                        var objectId = newArrayOfRecords[x][0];
                        var openTheObject = app.openObject(objectId);
                        var theOpenDoc = app.documents.item(app.documents.length - 1);
                        var exportCounter = exportArticlesAsSnippets(theOpenDoc, folder);
                        theOpenDoc.close(SaveOptions.no);
                        app.sendObjectToNext(objectId);
                    }

                } 
            }
        }
    }
    catch (e) {
        desc = e.description;
        num = e.number;
        alert('error ' + num + ': ' + desc);
    }


    //=======================================
    // Set the user interaction level
    //=======================================		
    app.scriptPreferences.userInteractionLevel = UserInteractionLevels.interactWithAll;
}
else {
    alert("No folder selected. Export cancelled.");
}

