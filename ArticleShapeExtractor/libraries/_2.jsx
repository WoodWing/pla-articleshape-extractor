/**
 * @description Underscore and base class extensions. Largely taken from https://github.com/debrouwere/Extendables.
 * Some from Dojo and MDN
 *
 * @copyright Extendables has a MIT-license
 */

var debug = false;
constructUnderscore:
{
	includeConditions:
	{
		if(debug){
			break includeConditions;
		}
		if($.global.hasOwnProperty('_') && _.ext2){
			break constructUnderscore;
		}
	}

	//@include 'libraries/json2.js'

	(function(_){
		_.ext2 = true;

		/**
		 * Taken from dojo 1.10
		 */
		_.mixin = function(dest, sources){
			var _mixin = function (dest, source, copyFunc){
				// summary:
				//		Copies/adds all properties of source to dest; returns dest.
				// dest: Object
				//		The object to which to copy/add all properties contained in source.
				// source: Object
				//		The object from which to draw all properties to copy into dest.
				// copyFunc: Function?
				//		The process used to copy/add a property in source; defaults to the Javascript assignment operator.
				// returns:
				//		dest, as modified
				// description:
				//		All properties, including functions (sometimes termed "methods"), excluding any non-standard extensions
				//		found in Object.prototype, are copied/added to dest. Copying/adding each particular property is
				//		delegated to copyFunc (if any); copyFunc defaults to the Javascript assignment operator if not provided.
				//		Notice that by default, _mixin executes a so-called "shallow copy" and aggregate types are copied/added by reference.
				var name, s, i, empty = {};
				for(name in source){
					// the (!(name in empty) || empty[name] !== s) condition avoids copying properties in "source"
					// inherited from Object.prototype.	 For example, if dest has a custom toString() method,
					// don't overwrite it with the toString() method that source inherited from Object.prototype
					s = source[name];
					if(!(name in dest) || (dest[name] !== s && (!(name in empty) || empty[name] !== s))){
						dest[name] = copyFunc ? copyFunc(s) : s;
					}
				}
				return dest; // Object
			};

			if(!dest){ dest = {}; }
			for(var i = 1, l = arguments.length; i < l; i++){
				_mixin(dest, arguments[i]);
			}
			return dest; // Object
		};

		/**
		 * Array.isArray
		 * Implementation taken from hhttps://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray
		 */
		if(!Array.isArray) {
			Array.isArray = function(arg) {
				return Object.prototype.toString.call(arg) === '[object Array]';
			};
		}


		/**
		 * ************************************************************************
		 * ******************** HELPERS TAKEN FROM EXTENDABLES ********************
		 * ************************************************************************
		 */

		/*
		 * Patches for functional programming.
		 * Inspired by and sometimes copied from underscore.js
		 */


		/**
		 * ******************** OBJECT ********************
		 */

		/**
		 * @desc
		 *     Returns only the keys (also known as 'names') of an object or associative array.
		 *     Will filter out any functions, as these are presumed to be object methods.
		 * @returns {Array} An array with all the keys.
		 */

		Object.prototype.keys = function () {
			var keys = [];
			for (var key in this) {
				if (this.hasOwnProperty(key) && !(this[key] instanceof Function)) keys.push(key);
			}
			return keys;
		}

		/**
		 * @desc Returns only the values of an object or associative array.
		 * @returns {Array} An array with all the values.
		 *
		 * @example
		 *     > var nation = {'name': 'Belgium', 'continent': 'Europe'}
		 *     > nation.values();
		 *     ['Belgium', 'Europe']
		 */

		Object.prototype.values = function () {
			var self = this;
			return this.keys().map(function (key) {
				return self[key];
			});
		}

		/**
		 * @desc An alias for ``this instanceof type``.
		 * @returns {Bool} True or false.
		 *
		 * @example
		 *     > [].is(Array);
		 *     true
		 */
		Object.prototype.is = function(type) {
			return this instanceof type;
		}

		/**
		 * @desc Checks whether the object has a value for the specified property.
		 * @returns {Bool} True or false.
		 */

		Object.prototype.has = function (key) {
			// could be just null or an invalid object
			// either way, has() should return false
			if (this == null || this[key] == null) return false;

			if (key in this) {
				return new Boolean(this[key]) != false;
			} else {
				return false;
			}
		}


		/**
		 * ******************** ARRAY ********************
		 */

		/* Javascript 1.6 Array extras, courtesy of Mozilla */
		// note: the Mozilla stuff is MIT licensed!

		/**
		 * @desc Returns the first index at which a given element can be found in the array, or -1 if it is not present.
		 *
		 * @param {Object} element
		 *
		 * @see https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/indexOf
		 */

		// Production steps of ECMA-262, Edition 5, 15.4.4.14
		// Reference: http://es5.github.io/#x15.4.4.14
		if (!Array.prototype.indexOf) {
			Array.prototype.indexOf = function(searchElement, fromIndex) {

				var k;

				// 1. Let O be the result of calling ToObject passing
				//    the this value as the argument.
				if (this == null) {
					throw new TypeError('"this" is null or not defined');
				}

				var O = Object(this);

				// 2. Let lenValue be the result of calling the Get
				//    internal method of O with the argument "length".
				// 3. Let len be ToUint32(lenValue).
				var len = O.length >>> 0;

				// 4. If len is 0, return -1.
				if (len === 0) {
					return -1;
				}

				// 5. If argument fromIndex was passed let n be
				//    ToInteger(fromIndex); else let n be 0.
				var n = +fromIndex || 0;

				if (Math.abs(n) === Infinity) {
					n = 0;
				}

				// 6. If n >= len, return -1.
				if (n >= len) {
					return -1;
				}

				// 7. If n >= 0, then Let k be n.
				// 8. Else, n<0, Let k be len - abs(n).
				//    If k is less than 0, then let k be 0.
				k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);

				// 9. Repeat, while k < len
				while (k < len) {
					// a. Let Pk be ToString(k).
					//   This is implicit for LHS operands of the in operator
					// b. Let kPresent be the result of calling the
					//    HasProperty internal method of O with argument Pk.
					//   This step can be combined with c
					// c. If kPresent is true, then
					//    i.  Let elementK be the result of calling the Get
					//        internal method of O with the argument ToString(k).
					//   ii.  Let same be the result of applying the
					//        Strict Equality Comparison Algorithm to
					//        searchElement and elementK.
					//  iii.  If same is true, return k.
					if (k in O && O[k] === searchElement) {
						return k;
					}
					k++;
				}
				return -1;
			};
		}

		/**
		 * @desc Returns the last index at which a given element can be found in the array,
		 * or -1 if it is not present. The array is searched backwards, starting at from_index.
		 *
		 * @param {Object} element
		 * @param {Number} from_index
		 *
		 * @see https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Global_Objects/Array/lastIndexOf
		 */

		if (!Array.prototype.lastIndexOf) {
			Array.prototype.lastIndexOf = function(searchElement /*, fromIndex*/) {
				'use strict';

				if (this === void 0 || this === null) {
					throw new TypeError();
				}

				var n, k,
					t = Object(this),
					len = t.length >>> 0;
				if (len === 0) {
					return -1;
				}

				n = len - 1;
				if (arguments.length > 1) {
					n = Number(arguments[1]);
					if (n != n) {
						n = 0;
					}
					else if (n != 0 && n != (1 / 0) && n != -(1 / 0)) {
						n = (n > 0 || -1) * Math.floor(Math.abs(n));
					}
				}

				for (k = n >= 0 ? Math.min(n, len - 1) : len - Math.abs(n); k >= 0; k--) {
					if (k in t && t[k] === searchElement) {
						return k;
					}
				}
				return -1;
			};
		}

		/**
		 * @desc Executes a provided function once per array element.
		 *
		 * @param {Function} function
		 *
		 * @see https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/forEach
		 */

		Array.prototype.forEach = function(fun /*, thisp*/)
		{
			var len = this.length >>> 0;
			if (typeof fun != "function")
				throw new TypeError();

			var thisp = arguments[1];
			for (var i = 0; i < len; i++)
			{
				if (i in this)
					fun.call(thisp, this[i], i, this);
			}
		};

		/**
		 * @desc Creates a new array with the results of calling a provided function on every element in this array.
		 *
		 * @param {Function} function
		 *
		 * @see https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/map
		 */

		Array.prototype.map = function(fun /*, thisp*/)
		{
			var len = this.length >>> 0;
			if (typeof fun != "function")
				throw new TypeError();

			var res = new Array(len);
			var thisp = arguments[1];
			for (var i = 0; i < len; i++)
			{
				if (i in this)
					res[i] = fun.call(thisp, this[i], i, this);
			}

			return res;
		};

		/**
		 * @desc Tests whether some element in the array passes the test implemented by the provided function.
		 *
		 * @param {Function} function
		 *
		 * @see https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/some
		 */

		Array.prototype.some = function(fun /*, thisp*/)
		{
			var i = 0,
				len = this.length >>> 0;

			if (typeof fun != "function")
				throw new TypeError();

			var thisp = arguments[1];
			for (; i < len; i++)
			{
				if (i in this &&
					fun.call(thisp, this[i], i, this))
					return true;
			}

			return false;
		};

		/* Javascript 1.8 Array extras, courtesy of Mozilla */

		/**
		 * @desc Apply a function against an accumulator and
		 * each value of the array (from left-to-right) as to reduce it to a single value.
		 *
		 * @param {Function} function
		 *
		 * @see https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/Reduce
		 */

		Array.prototype.reduce = function(fun /*, initial*/)
		{
			var len = this.length >>> 0;
			if (typeof fun != "function")
				throw new TypeError();

			// no value to return if no initial value and an empty array
			if (len == 0 && arguments.length == 1)
				throw new TypeError();

			var i = 0;
			if (arguments.length >= 2)
			{
				var rv = arguments[1];
			}
			else
			{
				do
				{
					if (i in this)
					{
						var rv = this[i++];
						break;
					}

					// if array contains no values, no initial value to return
					if (++i >= len)
						throw new TypeError();
				}
				while (true);
			}

			for (; i < len; i++)
			{
				if (i in this)
					rv = fun.call(undefined, rv, this[i], i, this);
			}

			return rv;
		};

		/**
		 * @desc Apply a function simultaneously against two values of the array (from right-to-left)
		 * as to reduce it to a single value.
		 *
		 * @param {Function} function
		 *
		 * @see https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/ReduceRight
		 */

		Array.prototype.reduceRight = function(fun /*, initial*/)
		{
			var len = this.length >>> 0;
			if (typeof fun != "function")
				throw new TypeError();

			// no value to return if no initial value, empty array
			if (len == 0 && arguments.length == 1)
				throw new TypeError();

			var i = len - 1;
			if (arguments.length >= 2)
			{
				var rv = arguments[1];
			}
			else
			{
				do
				{
					if (i in this)
					{
						var rv = this[i--];
						break;
					}

					// if array contains no values, no initial value to return
					if (--i < 0)
						throw new TypeError();
				}
				while (true);
			}

			for (; i >= 0; i--)
			{
				if (i in this)
					rv = fun.call(undefined, rv, this[i], i, this);
			}

			return rv;
		};

		/**
		 * @desc Allows you to quickly pluck a single attribute from an array of objects.
		 *
		 * @example
		 *     > var people = [{'name': 'Alfred', age: 33}, {'name': 'Zed', age: 45}];
		 *     > people.pluck('age');
		 *     [33,45]
		 *     > people.pluck('age').sum();
		 *     78
		 *     > people.sum('age');
		 *     78
		 *     > people.sum(function (person) { return person.age });
		 *     78
		 */

		Array.prototype.pluck = function (name) {
			return this.map(function (item) {
				return item[name];
			});
		}

		/**
		 * @returns The sum of all array values.
		 *
		 * @param {Function|String} [salient_feature] See ``max``.
		 *
		 * @example
		 *     > var persons = [
		 *     ... {'name': 'Abraham', 'children': 5},
		 *     ... {'name': 'Joe', 'children': 3},
		 *     ... {'name': 'Zed', 'children': 0}
		 *     ... ];
		 *     > persons.sum('children');
		 *     8
		 */

		Array.prototype.sum = function (salient) {
			if (salient && salient.is(String)) {
				var mapper = function (obj) { return obj[salient]; }
			} else {
				var mapper = salient || function (obj) { return obj; }
			}

			var features = this.map(mapper);

			return features.reduce(function (a, b) { return a + b; });
		}

		/**
		 * @desc Alias for :func:`Array#filter`
		 * @function
		 */

		Array.prototype.select = Array.prototype.filter

		/**
		 * @desc Does exactly the inverse of :func:`Array#filter` and its alias :func:`Array#select`.
		 *
		 * @param {Function} fn
		 */

		Array.prototype.reject = function (fn) {
			return this.select(function (value) {
				return !fn(value);
			});
		}

		/**
		 * @desc Flattens nested arrays.
		 *
		 * @example
		 *     > var list = [[1, 2, [3, 4, 5], 6], [7, 8], 9];
		 *     > list.flatten();
		 *     [1,2,3,4,5,6,7,8,9];
		 */

		Array.prototype.flatten = function () {
			return this.reduce(function(memo, value) {
				if (value instanceof Array) return memo.concat(value.flatten());
				memo.push(value);
				return memo;
			}, []);
		};

		/**
		 * @desc Returns a copy of the array with all falsy values removed.
		 * This includes ``false``, ``null``, ``0``, ``""``, ``undefined`` and ``NaN``.
		 */

		Array.prototype.compact = function () {
			return this.reject(function (value) {
				return new Boolean(value) == false;
			});
		}

		/**
		 * @desc Returns the first item of this array
		 */

		Array.prototype.first = function () {
			return this[0];
		}

		/**
		 * @desc Returns the last item of this array
		 */

		Array.prototype.last = function () {
			return this.slice(-1)[0];
		}

		/**
		 * @desc Similar to indexOf
		 */

		Array.prototype.contains = function (obj) {
			return this.indexOf(obj) != -1;
		}

		/**
		 * ******************** STRING ********************
		 */

		/**
		 * @desc This is a simple string formatting method, loosely inspired on the one in Python 3.
		 *
		 * * In unnamed mode, specify placeholders with the **{}** symbol.
		 * * In named mode, specify placeholders with **{propname}**.
		 *
		 * @param {String} replacements
		 *     For each **{}** symbol in the text, ``format`` expects a replacement argument.
		 *     Calls `.toString()` on each replacement, so you can pass in any data type.
		 *     You may also specify a single replacement object, which will do named formatting.
		 *
		 * @example
		 *     > var person = {'salutation': 'mister', 'name': 'John Smith'};
		 *     > var hello = "Hello there, {}, I've heard your name is {}!".format(person.salutation, person.name);
		 *     > $.writeln(hello);
		 *     "Hello there, mister, I've heard your name is John Smith"
		 *
		 * @example
		 *     > var person = {'salutation': 'mister', 'name': 'John Smith'};
		 *     > var hello = "Hello there, {salutation}, I've heard your name is {name}!".format(person);
		 *     > $.writeln(hello);
		 *     "Hello there, mister, I've heard your name is John Smith"
		 */

		String.prototype.format = function() {
			var str = this;
			var replacements = Array.prototype.slice.call(arguments);
			var named = replacements.length == 1 && typeof replacements[0] !== 'undefined' && replacements[0].reflect.name == 'Object';

			if (named) {
				var dict = replacements[0];
				_.each(dict.keys(), function (key) {
					// replace globally (flagged g)
					str = str.replace("{" + key + "}", dict[key]);
				});
				return str;
			} else {
				// split the string into parts around the substring replacement symbols ({}).
				var chunks = str.split('{}');
				// Only consider the last chunk when there is really a {} at the end, otherwise we shift an empty
				// replacements array
				var skipLast = !str.endsWith('{}');
				// fill in the replacements
				_.each(chunks, function(chunk, i){
					if(skipLast && i==chunks.length-1)
						return;

					var replacement = replacements.shift();
					if(replacement != null && typeof replacement !== 'undefined') {
						chunks[i] += replacement.toString();
					}
				})
				// join everything together
				return chunks.join('');
			}
		}
		/**
		 * https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith
		 */
		if (!String.prototype.startsWith) {
			String.prototype.startsWith = function(searchString, position) {
				position = position || 0;
				return this.indexOf(searchString, position) === position;
			};
		}
		/**
		 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith
		 */
		if (!String.prototype.endsWith) {
			String.prototype.endsWith = function(searchString, position) {
				var subjectString = this.toString();
				if (position === undefined || position > subjectString.length) {
					position = subjectString.length;
				}
				position -= searchString.length;
				var lastIndex = subjectString.indexOf(searchString, position);
				return lastIndex !== -1 && lastIndex === position;
			};
		}
		/**
		 * @desc Tests whether the string contains the specified substring.
		 * This is equal to ``str.indexOf(substring) != -1``.
		 * @param {String} substring
		 * @returns {Bool} True or false.
		 */
		String.prototype.contains = function (substring) {
			return this.indexOf(substring) != -1;
		}

		/**
		 * @desc Removes leading whitespace characters, including tabs, line endings and the like.
		 * @param {String} [character] if specified, removes leading characters matching the parameter
		 * instead of whitespace.
		 *
		 * @example
		 *     > $.writeln("   hello there   ".trim());
		 *     "hello there   "
		 */

		String.prototype.ltrim = function(character) {
			if (character) {
				if (this.endsWith(character) == true) {
					return this.substr(1).ltrim(character);
				} else {
					return this;
				}
			} else {
				return this.replace(/^\s+/, "");
			}
		}

		/**
		 * @desc Removes trailing whitespace characters, including tabs, line endings and the like.
		 * @param {String} [character] if specified, removes trailing characters matching the parameter
		 * instead of whitespace.
		 *
		 * @example
		 *     > $.writeln("   hello there   ".trim());
		 *     "   hello there"
		 */

		String.prototype.rtrim = function (character) {
			if (character) {
				if (this.endsWith(character) == true) {
					return this.slice(0, -1).rtrim(character);
				} else {
					return this;
				}
			} else {
				return this.replace(/\s+$/, "");
			}
		}

		/**
		 * @desc Removes leading and trailing whitespace characters, including tabs, line endings and the like.
		 * @param {String} [character] if specified, removes leading and trailing characters matching the
		 * parameter instead of whitespace.
		 *
		 * @example
		 *     > $.writeln("   hello there   ".trim());
		 *     "hello there"
		 */

		String.prototype.trim = function(character) {
			if (character) {
				return this.ltrim(character).rtrim(character);
			} else {
				return this.replace(/^\s+|\s+$/g, "");
			}
		}
		
		String.prototype._composePadding = function(targetLength, padChar) {
			padChar = padChar || " "; // Default padding character is a space
			targetLength = targetLength >> 0; // Convert to integer
			if (this.length >= targetLength) return "";		
			return new Array(targetLength - this.length + 1).join(padChar);
		}

		/**
		 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart
		 */
		if (!String.prototype.padStart) {
			String.prototype.padStart = function (targetLength, padChar) {
				return this._composePadding(targetLength, padChar) + this;
			};
		}

		/**
		 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padEnd
		 */
		if (!String.prototype.padEnd) {
			String.prototype.padEnd = function (targetLength, padChar) {
				return this + this._composePadding(targetLength, padChar);
			};
		}

		/**
		 * ******************** FILE & FOLDER ********************
		 */

		function from_basepath (folder) {
			if (folder.is(String)) folder = new Folder(folder);

			var path = [folder.relativeURI, this.relativeURI].join('/');
			return new this.constructor(path);
		}


		/**
		 * @function
		 * @desc Get a file or folder starting from an existing path.
		 * A foolproof way to join paths together.
		 *
		 * Similar to ``File#getRelativeURI``, but returns a new File object
		 * instead of a path.
		 */

		File.prototype.at = from_basepath;

		/**
		 * @function
		 * @desc Get a file or folder starting from an existing path.
		 * A foolproof way to join paths together.
		 *
		 * Similar to ``File#getRelativeURI``, but returns a new Folder object
		 * instead of a path.
		 */

		Folder.prototype.at = from_basepath;

		/**
		 * @desc Easy extraction of path, name, basename and extension from a
		 * :func:`File` object.
		 * @param {String} type ``path``, ``name``, ``basename`` or ``extension``
		 */

		File.prototype.component = function (type) {
			switch (type) {
				case 'path':
					return this.path;
					break;
				case 'name':
					return this.name;
					break;
				case 'basename':
					var extlen = this.component('extension').length;
					if (extlen) {
						return this.name.slice(0, -1 * extlen).rtrim('.');
					} else {
						return this.name;
					}
					break;
				case 'extension':
					var name = this.name.split('.');
					if (name.length > 1) {
						return name.last();
					} else {
						return '';
					}
					break;
			}
		}

		/**
		 * Return name of file, without director and extension
		 * @param path optional when calling prototype
		 * @returns {string}
		 */
		File.prototype.basename = function(path){
			if (!path) return this.name;
			// force to forward slashes and then split
			var parts = path.split('\\').join('/').split('/');
			// last part is the filename
			parts = parts[parts.length-1].split('.');

			// part after the last dot is extension. Caution: there can be none
			if(parts.length > 1)
				parts.pop();

			// all before the last dot is the name
			return parts.join('.');
		}

		/**
		 * @desc Works just like ``Folder#getFiles``, but returns only files, not folders.
		 * @param {String|Function} [mask]
		 */

		Folder.prototype.files = function (mask) {
			return this.getFiles(mask).reject(function (file_or_folder) {
				return file_or_folder.is(Folder);
			});
		}

		/**
		 * @desc Works just like ``Folder#getFiles``, but returns only folders, not files.
		 * @param {String|Function} [mask]
		 */

		Folder.prototype.folders = function (mask) {
			return this.getFiles(mask).reject(function (file_or_folder) {
				return file_or_folder.is(File);
			});
		}

		/**
		 * @desc Removes all files and folders recursively
		 */
		Folder.prototype.removeRecursively = function (mask) {
			_.each(this.getFiles(), function (file_or_folder) {
				if(file_or_folder.is(Folder)) {
					file_or_folder.removeRecursively();
				} else {
					file_or_folder.remove();
				}
			});
			this.remove();
		}

		/**
		 * ******************** DATE ********************
		 */

		/**
		 * @desc A simple timer. Makes it easy to know how long it takes to execute something.
		 * Exists as both a static method on ``Date``
		 * and a regular method on each ``Function`` object.
		 * @param {String} format Choose whether the elapsed time should be formatted in
		 * milliseconds (``ms`` or no argument) or seconds, rounded to two decimals (``s``).
		 * @default ``ms``
		 */

		Date.timer = {
			_get: function (d, format) {
				var duration = new Date().getTime() - d.getTime();
				if (format == 's') {
					return (duration/1000).toFixed(3);
				} else {
					return duration;
				}
			},
			set: function () {
				this._start = new Date();
				this._lap = this._start;
			},
			lap: function (format) {
				var duration = this._get(this._lap, format);
				this._lap = new Date();
				return duration;
			},
			get: function (format) {
				return this._get(this._start, format);
			}
		}

		Function.prototype.timer = Date.timer;
	})(_);
}