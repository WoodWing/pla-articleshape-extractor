/**
 * This script creates the 'Fit Article with AI' context menu item when InDesign starts.
 */

#target InDesign
#targetengine 'wwArticleShapeExtractor'
// L> ExtendScript preprocessor directives that create a named, persistent engine that stays 
//    alive as long as InDesign is running.

(function(){
	var _customMenus = [];
	try {
		extendContextMenu();
	} catch(error) {
		removeMenuItems();
		alert(error.message);
	}

	/**
	 * Add the 'Fit Article with AI' menu item to the 'Fitting' submenu of the context menu.
	 */
	function extendContextMenu() {
		// Locate the 'Fitting' item of the context menu.
		var fittingSubMenu = app.menus.item( '$ID/RtMouseLayout' ).submenus.item('$ID/Fitting');

		// Add the menu item.
		var menuTitle = "Fit Article with AI";
		var scriptFile = new File(scriptsFolder() + '/commands/FitArticleWithAI.idjs');
		addMenuItem(fittingSubMenu, menuTitle, invokeScript(menuTitle, scriptFile));

		// For heavy debugging only; Add another menu item that removes our custom menu items.
		//addMenuItem(fittingSubMenu, "Remove ArticleShapeExtractor menus (debug)", removeMenuItems);
	}

	/**
	 * Locate the 'Scripts Panel' folder that belongs to the InDesign application folder.
	 * @returns {string}
	 */
	function scriptsFolder() {
		var scriptsFolderPath = app.filePath + "/Scripts/Scripts Panel/ArticleShapeExtractor";
		var scriptsFolder = Folder(scriptsFolderPath);
		if(!scriptsFolder.exists) {
			throw new Error("Configuration error: The '" + scriptsFolderPath + "' folder cannot be located.");				
		}
		return scriptsFolder;
	}

	/**
	 * Add a new menu item to a given menu. 
	 * @param {Object} menu 
	 * @param {string} title 
	 * @param {CallableFunction} onInvoke When menu item is clicked, this function is called.
	 */
	function addMenuItem(menu, title, onInvoke){
		var action = app.scriptMenuActions.add(title);
		action.eventListeners.add('onInvoke', onInvoke);
		var item = menu.menuItems.add(action);
		_customMenus.push({item: item, action: action});
	}

	/**
	 * Compose a callback function to execute a given script file.
	 * @param {string} title 
	 * @param {File} scriptFile 
	 * @returns {CallableFunction}
	 */
	function invokeScript(title, scriptFile) {
		return function(event) {
			app.doScript(
				scriptFile, ScriptLanguage.UXPSCRIPT, [], 
				UndoModes.FAST_ENTIRE_SCRIPT, // capture whole script execution in just one Undo action
				title, // title of the Undo operation
			);
		}
	}

	/**
	 * Remove the custom menu items and their registered actions.
	 */
	function removeMenuItems() {
		while (_customMenus.length > 0) {
			var customMenu = _customMenus.shift();
			try {
				customMenu.menuItem.remove();
			} catch (_) {}
			try {
				customMenu.action.eventListeners.everyItem().remove();
				customMenu.action.remove();
			} catch (_) {}
		}
	}

	// On InDesign shutdown, automatically remove the custom menu items.
	return {
		destroy: removeMenuItems
	}
})();