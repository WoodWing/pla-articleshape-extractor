/**
 * @description Startup script for menu creation
 *
 * @copyright WoodWing Software B.V. All rights reserved.
 */

#target 'InDesign'
#targetengine 'ase'

var aseStartup = aseStartup ||
	(function(){

		_actions = [];

		var aseSriptFolder = app.activeScript.parent.parent;
		aseSriptFolder.changePath('ArticleShapeExtractor');
		if(!aseSriptFolder.exists)
			throw("Configuration error: ArticleShapeExtractor scripts cannot be located.");

		function handler(title, fileName) {
			return function(ev) {
				app.doScript( new File(aseSriptFolder + '/' + fileName), ScriptLanguage.JAVASCRIPT, [], UndoModes.FAST_ENTIRE_SCRIPT, title );
			}
		}		

		function _createMenu(subMenu, title, fileName){
			var action = app.scriptMenuActions.add(title);
			action.eventListeners.add('onInvoke', handler(title, fileName));
			subMenu.menuItems.add(action);
            _actions.push(action);
		}

		var woodWingMenu = app.menus.item( '$ID/Main' ).submenus.item("WoodWing Studio");
		
		_createMenu(woodWingMenu, 'Extract article shapes', 'ExtractArticleShapes.jsx');

//		var destroyAction = app.scriptMenuActions.add('Destroy');
//		destroyAction.eventListeners.add('onInvoke', destroy);
//		ptdSubmenu.menuItems.add(destroyAction);


		function destroy(){
			while(_actions.length>0)
				_actions.shift().eventListeners.everyItem().remove();
			ptdSubmenu.remove();
			ptdStartup = null;
		}

		return {
			destroy: destroy
		}
	})();