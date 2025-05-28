const { app } = require("indesign");
const idd = require("indesign");

/**
 * @constructor
 * @param {Logger} logger
 * @param {String} userQueryName
 * @param {ExportInDesignArticlesToFolder} exportInDesignArticlesToFolder
 */
function RegenerateArticleShapesService(logger, userQueryName, exportInDesignArticlesToFolder) {
    this._logger = logger;
    this._userQueryName = userQueryName;
    this._exportInDesignArticlesToFolder = exportInDesignArticlesToFolder;

    /**
     * @param {Folder} folder 
     */
    this.run = async function(folder) {

        // Bail out when user is currently not logged in.
        if (!app.entSession || app.entSession.activeServer === '' || app.entSession.activeUser === '') {
            const { NoStudioSessionError } = require('./Errors.js');
            throw new NoStudioSessionError();
        }

        let totalEntries = -1;
        let listedEntries = 0;
        
        //=======================================
        // Begin the work of the script...do the query and get the results back...
        //=======================================
        while (totalEntries != listedEntries) {
            //=======================================
            // Send a query to Enterprise
            //=======================================
            const query = app.storedUserQuery(this._userQueryName);
            if(query == undefined) {
                const { ConfigurationError } = require('./Errors.js');
                throw new ConfigurationError("User Query '" + this._userQueryName + "' does not exist.");
            }
            
            //=======================================
            //Push the query results into an array using new lines as the value to split by
            //=======================================
            let stringToArray = query.split(/\n/g);

            //=======================================
            //Count the number of objects in the array
            //=======================================
            const countOfObjects = stringToArray.length;

            //=======================================
            // Iterate through the array, do a regular expression to find the records
            // Remove the < and > characters and push the record into another array
            //=======================================
            if (countOfObjects > 0) {
                let b = 0;
                let newArrayOfRecords = new Array();

                for (let a = 1; a < countOfObjects; ++a) {
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
                    const recordExists = new RegExp("<.*>");

                    //=======================================
                    //Perform the regular expression search
                    //=======================================
                    const regExpSearchResult = recordExists.test(stringToArray[a]);

                    //=======================================
                    // If the RegEx search finds a result process it
                    //=======================================
                    if (regExpSearchResult == true) {

                        //=======================================
                        //Set two variable for the brackets
                        //=======================================
                        const finalValueA = stringToArray[a].replace("<", "");
                        const finalValueB = finalValueA.replace(">", "");
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
                const countOfNewArrayOfRecords = newArrayOfRecords.length;

                //=======================================
                // If the count of the array is greater than zero...let's do our stuff
                //=======================================

                if (countOfNewArrayOfRecords > 0) {

                    for (let x = 0; x < countOfNewArrayOfRecords; ++x) {
                        //=======================================
                        // Get the id of the file
                        //=======================================
                        const objectId = newArrayOfRecords[x][0];
                        const theOpenDoc = app.openObject(objectId);
                        await this._exportInDesignArticlesToFolder.run(theOpenDoc, folder);
                        theOpenDoc.close(idd.SaveOptions.no);
                        app.sendObjectToNext(objectId);
                    }

                } 
            }
        }
    };
}

module.exports = RegenerateArticleShapesService;