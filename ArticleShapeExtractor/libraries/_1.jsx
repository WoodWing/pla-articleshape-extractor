/**
 * Based on https://www.rorohiko.com/underscore/
 * Includes WoodWing additions
 */

var debug = false;
var version = 1.54;
var devBuild = false;

constructUnderscore:
{
    /**
     Check we are ready to initialize underscore.
     Must not already exist or be of smaller version.
     Host app Must be InDesign.
    */
    includeConditions:
    {
        if(debug)
        {
            break includeConditions;
        }
        if($.global.hasOwnProperty('_') && _.version >= version)
        {
            break constructUnderscore;
        }
        if(app.name.indexOf("InDesign") < 0)
        {
            break constructUnderscore;
        }
    }   
    
    
    /**
      Initialize underscore.
    */
    $.global['_'] = (function(){
        
               
        function _(){
          /*
          - [The underscore object]. It is a function.
          - It performs various actions depending on the arguments given.
          - String resolve to a search in the app scope, and then the active document scope.
          - Objects are wrapped into a Proxy object.
          - [1-3] Numbers can be given to return a Range object.
          Alternative scopes can be specified by wrapping the required scope in underscore,
          and then using the chained underscore function to resolve further specifiers.
          */
          return us.apply(null, aa(arguments));
        }; 

        
        /**
          Underscore delegator function chooses between specifer resolution, object wrapping or
          generating a range.
        */
        var us = function(){
            var argType = typeof arguments[0];
            var doc = tryGet(app, "activeDocument");
            if(argType == 'string')
                return find(app, arguments[0])||find(doc, arguments[0])||find($.global, arguments[0]);
            else
                return (argType == "number")?_.range(arguments[0], arguments[1], arguments[2]):new Proxy(arguments[0]);
        }
    
     
        function Proxy(wrapped){
             /**
             * [Proxy] a Proxy is a wrapper object that exposes properties and functions
             * of its child objects, or a wrapped collections items so they can be modified
             * as one object.
             * @param  {Object} wrapped The object to wrap.
             * The proxy inherits all properties and methods from any wrapped collection
             and its immediate children. 
             
             Properties can be assigned as per usual. Or as a function by the same
             name that takes one argument. Properties set using the function can be chained.
             
             Properties can not be retreived by name, and instead need to be accessed by function
             call of the same name.
             
             Methods can be called as per usual and like properties affect all instances in a collection.
             Methods on collections return individual return values in a single array.
             All methods on the proxy have an equivalent twin with a single underscore prepended to their name.
             The underscore form of the function returns a chainable object rather than the default
             function return values, allowing multiple method calls in one chain.
             */
         
            if(_.isProxy(wrapped)){
                return wrapped; //Dont double wrap... 
            }
            else
            {
                absorb(this, wrapped);
                this.value = wrapped;
                
                
                this.toString = ProxyToString;
                this.help = Proxy.help;
                this.__proto__ = ('length' in this)?ProxyPrototypes.collection:ProxyPrototypes.singleton;
                this.animate = (geometricBounds in this)?ProxyAnimate:undefined;
            }
            return this;
        }
    
    
        _.strings = function (input){
            /*
             * Simple wrapper for string substitution using python style modulous operator.
             * e.g var formatString = _.strings("Hello [0] my name is [1]");
             * 
             * formatString % ["World", "_.jsx"];
             * => "Hello world my name is _.jsx"
             *
             */
            var str = input.toString();
            var wrap = {
                value: str,
                '%': function format(args){
                    var formatted = this.value;
                        if(typeof args == 'string'){
                            formatted = formatted.replace(/\[0\]/g,args);
                        }
                        else{
                            for (var idx in args){
                                formatted = formatted.replace(new RegExp("\\["+idx+"\\]",'gm'), args[idx]);
                            }
                            for (var idx in args){
                                formatted = formatted.replace(new RegExp("\\\\",'gm'), "");
                            }
                        }        
                        
                        return formatted;
                    },
               toString: function(){ return "[FormatString: "+this.value+"]"}
            };
            return wrap;
        };
           
        /**
             * The main loop,  handles all queued events and timers.
             * @return {void}
             */
            function eventLoop(){
                var items = eventLoop.items;
                var length = items.length;
                while(length--){
                       var item = items.shift();
                       item.step();
                       if(!item.done)items.push(item);
                }
            }
                
            /**
             * Initialize the event queue.
             */

            (function(){
                eventLoop.items = [];
                eventLoop.events = {};
            })();

            (function(){
               var currentTask = app.idleTasks.itemByName('eventQueue');
               if(currentTask && currentTask.isValid)
                    currentTask.remove();
//                eventLoop.addJob = function(job){eventLoop.items.push(job);};
//                app.idleTasks.add({name: 'eventQueue',sleep: 20}).addEventListener(IdleEvent.ON_IDLE, eventLoop);
            })();

            /**
             * Enable global app event listeners for event forwarding.
             */
            (function(){
                app.removeEventListener(Application.AFTER_SELECTION_ATTRIBUTE_CHANGED, eventForwarder);
                app.removeEventListener(Application.AFTER_SELECTION_CHANGED, eventForwarder);
                app.addEventListener(Application.AFTER_SELECTION_ATTRIBUTE_CHANGED, eventForwarder);
                app.addEventListener(Application.AFTER_SELECTION_CHANGED, eventForwarder);
            })();

            /**
             * Underscore constants and overrides.
             */
            _.self = _;
            _.version = version;
            _.SELECT = "ProxySelect";
            _.DESELECT = "ProxyDeselect";
            _.MOVE = "ProxyMove";
            _.RIGHT = "$ID/Nudge right";
            _.LEFT = "$ID/Nudge left";
            _.UP = "$ID/Nudge up";
            _.DOWN = "$ID/Nudge down";
            _.SHIFT_RIGHT = "$ID/Nudge right x10";
            _.SHIFT_LEFT = "$ID/Nudge left x10";
            _.SHIFT_UP = "$ID/Nudge up x10";
            _.SHIFT_DOWN = "$ID/Nudge down x10";
            _.TimerEvent = "UnderscoreTimerEvent";
            _.TimerFinishedEvent = "UnderscoreTimerFinishedEvent.";
            _.MAX_FLATTEN_SIZE = 3000;

            //Error Handling
            _.STANDARD_ERROR_MODE = 'standardErrorMode';
            _.SUPPRESS_ERRORS = 'suppressErrors'
            _.ERROR_MODE = _.STANDARD_ERROR_MODE;


            

            var watchedItems = {};
            var propList = {};
            var methList = {};
            var propCache = {};
            var methCache = {};
            var childPropCache = {};
            var childMethCache = {};
            var collectionsList = {};
            var geometricBounds = 'geometricBounds';
            var numReg = /^[0-9]+$/;
            var underscoreEvents = [_.SELECT, _.DESELECT, _.MOVE, _.RIGHT, _.LEFT, _.UP, _.DOWN, _.SHIFT_RIGHT, _.SHIFT_LEFT, _.SHIFT_UP, _.SHIFT_DOWN];
            var interestingEvents = [_.RIGHT, _.LEFT, _.UP, _.DOWN, _.SHIFT_RIGHT, _.SHIFT_LEFT, _.SHIFT_UP, _.SHIFT_DOWN];
            
            
            

            /**
             * Proxy functions.
             *
             */
            var ProxyFlatten = function(){ /* Flattens a Multi Level ProxyCollection into a single level Proxy collection*/return _.flatten(this); };
            var ProxyEach = function(callback){/* An attached for each function that accepts a single callback for each item*/ _.each(this, callback); };
		    var ProxySome = function(callback){/* An attached for some function that accepts a single callback for each item*/ return _.some(this, callback); };
            var ProxyType = function(){/*Returns the type of object this collection holds */ return _.collectionType(this); };
            var ProxyLength = function(){/*Returns the number of children this collection holds */ return _.totalLength(this); };
            var returnOne = function(){/*Returns the number of children this collection holds */  return 1; };
            var ProxyAnimate = function(to, time, callback){
                    /*
                    * animate
                    * @param to [Array of 4 numbers, or object with optional rotation(number), scale(number) and to(array 4 units) properties]
                    * @param time [Length of time in milliseconds for animation to take].
                    * @param callback {optional} [Optional callback function.]
                    */
                       if(_.isCollection (this))
                            _.animate(this, to, time, callback);
                        else
                            _.animate(this.value, to, time, callback);
                   };

            
            
            var ProxyToString = function toString(){
                    /* String representation of a Proxy Object */
                    var name = tryGet(this.value, "name");
                    var id = tryGet(this.value, "id");
                    var type;
                    if(_.isCollection(this)){
                            var contents = this.value.toString();
                            return "[ProxyCollection "+contents+"]";
                    }
                    try{
                        type = /\[\S*\s([^\]]*)\]/.exec(this.value.toString())[1];
                    }catch(error){
                        if(this.value() instanceof Array){
                            type = "Array ["+this.value.toString()+"]";
                        }else{
                            type = typeof this.value;
                        }
                    }
                    var identifier = type;
                    if(name)
                        type += ": "+name;
                    else if(id)
                        type += "#"+id;

                return "[Proxy "+type+"]";
                };
            
            
                /**
            * These prototypes define the base properties and functions of a Proxy object.
            */
            var ProxyPrototypes = {
                    collection:{
                        isProxy:    true,
                        _:          findInProxy,
                        hostType:   ProxyType,
                        addEventListener: ProxyAddEventListener,
                        on: ProxyAddEventListener,
                        removeEventListener: ProxyRemoveEventListener,
                        off: ProxyRemoveEventListener,
                        size: ProxyLength,
                        each: ProxyEach,
                        some: ProxySome,
                        items:ProxyFlatten
                    },
                    singleton:{
                        isProxy:    true,
                        _:          findInProxy,
                        hostType:   ProxyType,
                        addEventListener: ProxyAddEventListener,
                        on: ProxyAddEventListener,
                        removeEventListener: ProxyRemoveEventListener,
                        off: ProxyRemoveEventListener,
                        size: returnOne
                    }
            };



            function ProxyAddEventListener(type, callback){
                
                /**
                 * Adds an event listener to a Proxy object.
                 * @param {String}   type     type of event to listen for.
                 * @param {Function} callback event handler to call.
                 */
                 if(!_.inArray(type, underscoreEvents)){
                        if("_addEventListener" in this){
                                this._addEventListener(type, callback);
                        }
                        return;
                  }
                if(_.isCollection(this)){
                    _.each(this, function(value){
                        if(!(value.id in watchedItems)){
                            watchedItems[value.id] = [];
                        }
                         watchedItems[value.id].push({target:value, type:type, callback: callback, state:getState(value)});
                        });
                }else{
                    if(!(this.value.id in watchedItems)){
                            watchedItems[this.value.id] = [];
                    }
                    watchedItems[this.value.id].push({target:this.value, type:type, callback: callback, state:getState(this.value)});
                }
                return this;
            }

            function ProxyRemoveEventListener(type, callback){
                 /**
                 * [ProxyRemoveEventListener Removes an event listener from a Proxy object]
                 * @param {String}   type     The event type to remove
                 * @param {Function} callback The handler to remove.
                 */
                if(!_.inArray(type, underscoreEvents)){
                        if("_removeEventListener" in this){
                                this._removeEventListener(type, callback);
                        }
                        return;
                  }
                if(_.isCollection(this)){
                    _.each(this, function(value){
                        removeItemListener(value.id, type, callback);
                      });
                }else{
                    removeItemListener(this.value.id, type, callback);
                }
                return this;
            }

           
            function removeItemListener(id, type, callback){
                 /**
                 * Removes an event listener of a certain type given an id
                 * @param  {int}   id       The object id.
                 * @param  {String}   type     The event type.
                 * @param  {Function} callback [description]
                 */
                var toRemove = [];
                if(id in watchedItems){
                        _.each(watchedItems[id], function(listener, id){
                            if(listener.type == type && listener.callback == callback){
                                    toRemove.push(id);
                            }
                        });
                        _.each(toRemove.reverse(), function(index){
                            watchedItems[id].splice(index, 1);
                         });
                }
            }

            /**
             * Delegates a move event to all listeners on this item.
             * Wraps event in an event object,  that allows you to prevent
             * the default action.
             * @param  {String} type The type of move event.
             * @param  {Object} item The item that has moved.
             * @param  {Events} evt  The native event that was triggered by the move.
             */
            function moveEvent(type, item, evt){
                var  listeners;
               if(item instanceof Object && "id" in item)
                    listeners = watchedItems[item.id];
                else
                    return;
                if(listeners){
                    _.each(listeners, function(listener){
                        try{
                        if(listener.type == type){
                               listener.preventDefault = function(){
                                    evt.preventDefault();
                               };
                            listener.callback.call(null, listener);
                        }
                        }catch(err){
                          removeItemListener(item.id, listener.type, listener.callback);
                       }
                    });
                }
            }

            var movementParams = ['geometricBounds', 'itemLayer', 'parentPage'];
            /**
             * Gets an object state determined by a set of movement parameters.
             * Used for detecting move changes.
             * @param  {Object} item The item to get the state from
             */
            function getState(item){
                var state = {};
                _.each(movementParams, function(paramName){
                        if(paramName in item){
                            var param = item[paramName];
                            if(param && param instanceof Object && 'name' in param){
                                    param = param.name;
                            }
                            state[paramName] = param;
                            }
                    });
                return state;
            }

            /**
             * The handler for the SELECT event. Forwards event on to any listeners,
             * as long as the item exists and is valid.
             * @param  {Object} item The item responding to the event.
             */
            function selected(item){
                var listeners;
                 if(item.isValid && item instanceof Object && "id" in item)
                    listeners = watchedItems[item.id];
                else
                    return;
                if(listeners){
                    _.each(listeners, function(listener){
                        if(listener.type == _.SELECT){
                            try{
                                listener.callback.call(null, listener);
                            }catch(err){
                                //;
                            }
                        }
                    });
                }
            }

            /**
             * The handler for the DESELECT event. Forwards event on to any listeners,
             * as long as the item exists and is valid.
             * @param  {Object} item The item responding to the event.
             */
            function deselected(item){
                var listeners;
                if(item.isValid && item instanceof Object && "id" in item)
                {
                    listeners = watchedItems[item.id];
                }
                else
                {
                    return;
                }
                if(listeners)
                {
                    _.each(listeners, function(listener)
                    {
                        if(listener.type == _.DESELECT)
                        {
                            try{
                                listener.callback.call(null, listener);
                             }catch(err){
                                //;
                            }
                        }
                    });
                }
            }

            /**
             * The handler for an attribute change event. Detects
             * if it is an event if we are interested in an reacts if so.
             * Otherwise it does nothing.
             * @param  {Event} event The change event.
             */
            function attributeChangeHandler(event){
                    var toRemove = [];
                        _.each(watchedItems, function(items, id)
                            {
                            _.each(items, function(listener)
                                {
                                if(listener.type == _.MOVE)
                                    {
                                     try{
                                        if(!listener.target.isValid)
                                            {
                                               toRemove.push({id:id, type:listener.type, callback:listener.callback});
                                                return;
                                            }
                                        if(!_.valEqual(listener.state, getState(listener.target)))
                                            {
                                                try{
                                                    listener.callback.call(null, listener);
                                                  }catch(err){
                                                        //;
                                                    }
                                                listener.state = getState(listener.target);
                                            }
                                       }
                                       catch(err)
                                            {
                                                toRemove.push({id:id, type:listener.type, callback:listener.callback});
                                            }
                                 }
                            });
                        });

                    _.each(toRemove.reverse(), function(remove){
                            removeItemListener(remove.id, remove.type, remove.callback);
                    });
            }

            /**
             * [selectionHandler The handler for InDesign SELECTION event. Deteremines which objects
             * have changed selection state and become selected/unselected and fires delegates to sub-events.]
             */
            function selectionHandler(){
                var handler = function(){
                    var newSelection = app.selection;

                    _.each(newSelection, function(item){
                        if(!_.inArray(item, eventForwarder.selection)){
                            selected(item);
                        }
                    });
                    _.each(eventForwarder.selection, function(item){
                        if(!_.inArray(item, newSelection)){
                            deselected(item);
                        }
                    });
                    eventForwarder.selection = newSelection;
                };
                app.doScript(handler, ScriptLanguage.JAVASCRIPT, [], UndoModes.ENTIRE_SCRIPT);
            }

            function eventForwarder(event){
                try{
                    if(event.eventType == Application.AFTER_SELECTION_CHANGED){
                                selectionHandler();
                    }else{
                        _.setTimeout(function(){
                            attributeChangeHandler(event);
                            }, 100);
                    }
                }catch(err){
                }

            }

            (function(){
                try{
                    eventForwarder.selection = app.selection;
                    }
                catch(err)
                    {
                        eventForwarder.selection = [];
                    }
                })()


                    
            /**
             * Dispatches an event to the event loop. All listeners to the event are informed.
             * @param  {String} type   the type of event that is being dispatched
             * @param  {Object} target The target of the event
             * @return {void}
             */
            _.dispatchEvent = function(type, target){
                    if(type in eventLoop.events){
                            _.each(eventLoop.events[type], function(callback){
                                callback({type:type,target:target});
                            });
                    }
            };

            /**
             * Adds a listener for a certain type of event to the main event loop
             * @param {String}   type     The event type
             * @param {Function} callback The callback function
             */
            _.addEventListener = function(type, callback){
                    if(!(type in eventLoop.events)){
                            eventLoop.events[type] = [];
                    }
                    eventLoop.events[type].push(callback);
            };

            /**
             * Removes a listener for a certain type of event to the main event loop
             * @param {String}   type     The event type
             * @param {Function} callback The callback function
             */
            _.removeEventListener = function(type, callback){
                    if(type in eventLoop.events){
                            var queue = eventLoop.events[type];
                            var idx = _.indexOf(callback, queue);
                            if(idx > -1){
                                    queue = queue.splice(idx,1);
                            }
                    }

            };

            /**
             * Absorbs the properties and functions of an object and its children into a proxy.
             * @param  {Proxy} context The object proxy context
             * @param  {Object} base    The base object being absorbed.
             * @return {void}
             */
            function absorb(context, base){
                var baseName = base.toString();
                if(base instanceof Array){
                        baseName = "["+baseName+"]"
                }
                absorbBase(context, base, baseName);
                if(_.isCollection(base)){
                   var child = firstChild(base);
                   if(child){
                       childName = child.toString();
                       if(child instanceof Array){
                            childName = "["+childName+"]"
                        }
                       absorbChild(context, child, childName);
                       
                   }
                   child = base = context = null;
                }
            }

            var firstChild = function(collection){
                if(_.isCollectionPointer(collection)){
                    return collection.everyItem()
                }
                else{
                    var retVal = collection[0];
                    if(_.isProxy(retVal)) return retVal.value;
                    return retVal;
                }
            }

            /**
             * Absorbs the properties and functions of an object into a proxy.
             * @param  {Proxy} context The object proxy context
             * @param  {Object} base    The base object being absorbed.
             * @return {void}
             */
            function absorbBase(context, base, name){
                    if(!propList[name]){
                       var ref = base.reflect;
                       propList[name] = _.pluck('name',ref.properties);
                       methList[name] = _.pluck('name',ref.methods);
                        collectionsList[name] = _.isCollection(base);
                    }
                   absorbBaseProperties(context,base, name);
                   absorbBaseMethods(context,base, name);
            }
            /**
                
             * Absorbs the properties and functions of an objects children into a proxy.
             * @param  {Proxy} context The object proxy context
             * @param  {Object} child    The child of the object being absorbed.
             * @return {void}
             */
            function absorbChild(context, child, name){

                   if(!propList[name]){
                       var ref = child.reflect;
                       propList[name] = _.pluck('name',ref.properties);
                       methList[name] = _.pluck('name',ref.methods);
                       collectionsList[name] = _.isCollection(child);
                    }
                   absorbChildProperties(context,child, name);
                   absorbChildMethods(context,child, name);
                   
            }
            /**
             * Absorbs the properties of an object into a proxy.
             * @param  {Proxy} context The proxy object
             * @param  {Object} base    The base object being absorbed
             * @return {void}
             */
            function absorbBaseProperties(context, base, name){
                _.each(propList[name], function(key){
                     if(!(key in context)){
                         
                            var setter;
                            if(!(key in propCache)){
                                var setter = function(arg){
                                      var base = this.value;
                                      if(arg instanceof Function)
                                            if('getElements' in base){
                                               var elms = base.getElements();
                                               _.each(elms, function(elm){
                                                    elm[key] = nv.call(elm[key], elm);
                                               });
                                            }
                                            else{
                                                base[key] = arg.call(base[key], base);
                                            }
                                      else if(_.isProxy(arg))
                                            base[key] = arg.value;
                                      else if(arg){
                                              try{
                                                  base[key] = arg;
                                                 }catch(err){}
                                            }
                                       else{
                                           if(key in base){
                                                return base[key];
                                           }else{
                                                var retVals = [];
                                                _.each(this, function(child){
                                                    try{
                                                        retVals[retVals.length] = child[key];
                                                    }catch(err){}
                                                });
                                                return retVals;
                                           }
                                        }
                                        return this;
                                 };
                                setter.toString = function(){
                                     var base = this.value;
                                     return base[key].toString();
                                };
                                setter.valueOf = function valueOf(){
                                     var base = this.value;
                                     return base[key].valueOf();
                                };
                                setter.isGetter = true;
                                setter.watch = function(z, ov, nv){
                                    var base = this.value;
                                    try{
                                        if(nv instanceof Function){
                                            if('getElements' in base){
                                               var elms = base.getElements();
                                                _.wrapInUndo("Assign", function(){
                                                   _.each(elms, function(elm){
                                                        elm[key] = nv.call(elm[key], elm);
                                                   });
                                               });
                                            }
                                            else{
                                                base[key] = nv.call(base[key], base);
                                            }
                                        }
                                        else if(_.isProxy(nv)){
                                            base[key] = nv.value;
                                        }
                                        else{
                                            base[key] = nv;
                                        }
                                    }catch(err){}
                                    return ov;
                                };
                                propCache[key] = setter;
                           }else{
                             setter = propCache[key];
                          }
                        context[key] = setter;
                        context.watch(key,setter.watch);

                        watch = setter = null;
                    }
                });
                context = null;
            }
            /**
             * Absorbs the methods of a base object into a Proxy context
             * @param  {Proxy} context The proxy context
             * @param  {Object} base    The base object being absorbed
             * @return {void}
             */
            function absorbBaseMethods(context, base, name){
                var meths = methList[name]
                if(meths === void 0){
                    methList[name] = meths = _.pluck('name',base.reflect.methods);
                    }
                for each(var key in meths){
                    (function(key){
                     var hostFunc = function(){
                            var wrappedMethod = base[key];
                            var args = Array.prototype.slice.call(arguments);
                            var retVal = wrappedMethod.apply(base, args);
                            return retVal;
                    };

                    var chainFunc = function(){
                            var wrappedMethod = base[key];
                            var args = Array.prototype.slice.call(arguments);
                            var retVal = wrappedMethod.apply(base, args);
                            return this;
                    };
                    context[key] = hostFunc;
                    context["_"+key] = chainFunc;
                    hostFunc = chainFunc = wrappedMethod = null;
                    })(key);
                }
                context = null;
            }


            /**
             * Returns the cached properties of a context type.
             * If a cache miss occurs the properties are retreived and stored
             * first.
             * @param  {Object} context Object whose properties to retreive
             * @return {Array}         List of properties
             */
            function getProps(){
                var context = arguments[0];
                var args = Array.prototype.slice.call(arguments, 1);
                var retVal = [];
                _.each(args, function(arg){
                    var value = tryGet(context, arg);
                    retVal[arg] = value;
                    retVal[retVal.length] = value;
                 });
                return retVal;
            }

             /**
             * Absorbs the child properties of a base object into a Proxy context
             * @param  {Proxy} context The proxy context
             * @param  {Object} child    The child of the object being absorbed
             * @return {void}
             */
            function absorbChildProperties(context, childContext, name){

                  var dynamicProp = function(key){

                        if(!(key in context) || key === "name"){
                            var getSet;
                            if(!(key in childPropCache)){
                                    getSet = function(arg){
                                    try{
                                        if(arg){
                                             this.value.everyItem()[key] = arg;
                                        }else{
                                            return this.value.everyItem()[key];
                                        }
                                     }catch(err){}
                                    
                                    var retVal = [];
                                    var collection = _.toArray(this);
                                    var hasMultiple = false;

                                    for(var idx = 0; idx < collection.length; idx++){
                                        var child = collection[idx];

                                    if(_.isCollectionPointer(child) && !(key in child)){
                                        child = child.everyItem();
                                        hasMultiple = true;
                                    }

                                    if(child[key] instanceof Object && 'isGetter' in child[key] && child[key]['isGetter']){
                                        if(arg !== undefined){
                                                child[key](arg);
                                            }else{
                                                retVal.push(child[key]());
                                            }
                                         }
                                    else{
                                        if(arg === undefined){
                                            retVal.push(child[key]);
                                         }else{
                                            if(arg instanceof Function)
                                                 if(hasMultiple){
                                                 _.each(child.getElements(), function(subchild){
                                                    response = arg[0].call(subchild[key], child);
                                                    subchild[key] = response;
                                                 });
                                                }else{
                                                    child[key] = arg.call(child[key], child);
                                                }
                                                else if(_.isProxy(arg)){
                                                    child[key] = arg.value;
                                                }
                                                else{
                                                    child[key] = arg;
                                                }
                                            }
                                        }
                                    }
                                return (arg)?this:retVal;
                            };

                            getSet.toString = function(){
                                var strVal = [];
                                _.each(_.toArray(this), function(child){
                                    if(_.isCollectionPointer(child) && !(key in child))
                                        child = child.everyItem();
                                    strVal.push(child[key].toString());
                                });
                                return strVal.toString();
                            };

                            getSet.valueOf = function(){
                                var value = [];
                                _.each(_.toArray(this), function(child){
                                    if(_.isCollectionPointer(child)  && !(key in child))
                                        child = child.everyItem();
                                    value.push(child[key].valueOf());
                                });
                                return value;
                            };
                            getSet.watch = function(x, ov, nv){
                            var cc = this;
                            try{
                                if(this.value['everyItem'] && !('isProxy' in this.value)){
                                    cc = [this.value];
                                }
                            }catch(err){}
                            _.wrapInUndo("Assign", function(){
                            _.each(_.toArray(cc), function(child){
                                    var hasMultiple = false;
                                    if(_.isCollectionPointer(child) && !(x in child)){
                                        child = child.everyItem();
                                        hasMultiple = true;
                                    }
                                    if(nv instanceof Function){
                                        if(hasMultiple){

                                                _.each(child.getElements(), function(subchild){
                                                    subchild[x] = nv.call(subchild[x], subchild);
                                                })

                                        }
                                        else{
                                            child[x] = nv.call(child[x], child);
                                    }
                                    }
                                    else if(_.isProxy(nv)){
                                        child[x] = nv.value;
                                    }
                                    else{
                                        child[x] = nv;
                                    }
                                });
                            });
                            return ov;
                        };
                    
                            getSet.isGetter = true; 
                            childPropCache[key] = getSet;
                        }else{
                            getSet = childPropCache[key];
                        }
                        context[key]= getSet;
                        context.watch(key, getSet.watch);

                        getSet = watch = str = val = null;

                        }
                 }
                var props = propList[name];
                var length = props.length;
                while(length--){
                    dynamicProp(props[length]);
                }

               
                props = childContext = dynamicProp = context = null;

            }

            /**
             * Absorbs the child methods of a base object into a Proxy context
             * @param  {Proxy} context The proxy context
             * @param  {Object} child    The child of the object being absorbed
             * @return {void}
             */
            function absorbChildMethods(context, childContext, name){
                var meths = methList[name];
                var dynamicMethod = function(key){
                      
                      var hostFunc, chainFunc;
                      if(key && ! (key in context)){
                        if(!(key in childMethCache)){
                             var hostFunc = function(){
                                    var args = Array.prototype.slice.call(arguments);
                                    var retVal = [];
                                    var coll = this;
                                    try{
                                        if(this.value['everyItem'] && !('isProxy' in this.value)){
                                            coll = [this.value];
                                        }
                                    }catch(err){}
                                    coll = _.toArray(coll);
                                    _.wrapInUndo(key, function(){
                                        for(var colIdx = 0; colIdx < coll.length; colIdx++){
                                            var child = coll[colIdx];
                                            if(_.isCollectionPointer(child)  && !(key in child))
                                                child = child.everyItem();
                                            var wrappedMethod = child[key];
                                            retVal.push(wrappedMethod.apply(child, args));
                                        }
                                    });
                                    return retVal;
                            };
                            var chainFunc = function(){
                                    var args = Array.prototype.slice.call(arguments);
                                    var retVal = [];
                                    var coll = this;
                                    try{
                                        if(this.value['everyItem'] && !('isProxy' in this.value)){
                                            coll = [this.value];
                                        }
                                    }catch(err){}
                                    coll = _.toArray(coll);
                                    _.wrapInUndo(key, function(){
                                        for(var colIdx = 0; colIdx < coll.length; colIdx++){
                                            var child = coll[colIdx];
                                            if(_.isCollectionPointer(child)  && !(key in child))
                                                child = child.everyItem();
                                            var wrappedMethod = child[key];
                                            retVal.push(wrappedMethod.apply(child, args));
                                        }
                                    });
                                    return this;
                            };
                        
                        childMethCache[key] = [hostFunc, chainFunc];

                        }else{
                            var meths = childMethCache[key];
                            hostFunc = meths[0];
                            chainFunc = meths[1];
                         }
                     context[key] = hostFunc;
                     context["_"+key] = chainFunc;
                     hostFunc = chainFunc = null;
                    }
                };
                

                if(collectionsList[name]){
                    var child = firstChild(childContext);
                    absorbChild(context, child);
                }

                var len = meths.length;
                while(len--){
                    dynamicMethod(meths[len]);
                }
                dynamicMethod = methods = childContext = context = null;
            }

            /**
             * A wrapper for the find method which sets the host proxy as context/scope.
             * @param  {varies} value object to search for.
             * @return {varies}       Returns a wrapped proxy of search results or undefined if nothing is found.
             */
            function findInProxy(value){
                 /**
                 * Finds matches inside this proxy returns a matches proxy
                 * wrapper of the search results or undefined.
                 * @param  {String} rawSpecifier The css style specifier/filter or filter function..
                 * @return {Proxy}               Returns the proxy wrapper of the search results or nothing.
                 */
                return find(this, value);
            }
        
                    

            /**
             * Returns a named property or undefined of any given object.
             * @param  {Object} object   object to query
             * @param  {String} property Property to request.
             * @return {varies}          Returns the requested property or undefined.
             */
            function tryGet(object, property){
                var val = undefined;
                try{
                    val = object[property];
                 }catch(err){}
                 return val;
            }
            var IDRegex = /#([0-9]+)/;
            var nameRegex = /\.(.+)/;
            var keyValRegex = /\[([^=]*)=([\s\S]*)\]$/;
            var specifierRegex = /^[^\.\[\]#:]*/;
            var rangeRegex = /:([0-9]+)-([0-9]+)$/;

            /**
             * Parses a CSS style specifier into a descriptive object.
             * @param  {String} rawSpecifier CSS style specifier
             * @return {Object}               Object describing the specifier.
             */
            function parseSpecifier(rawSpecifier){
                if(rawSpecifier instanceof Object)
                    return {};

                var idr = rawSpecifier.match(IDRegex);
                var namer = rawSpecifier.match(nameRegex);
                var keyValr = rawSpecifier.match(keyValRegex);
                var specr = rawSpecifier.match(specifierRegex);
                var ranger = rawSpecifier.match(rangeRegex);

                return {
                    id:(idr)?idr[1]:undefined,
                    name:(namer)?namer[1]:undefined,
                    key:(keyValr)?keyValr[1]:undefined,
                    val:(keyValr)?keyValr[2]:undefined,
                    specifier:(specr)?specr[0]:undefined,
                    range: (ranger)?{from:parseInt(ranger[1]), to:parseInt(ranger[2])}:undefined
                };
            }
            /**
             * Like find but uses a faster search without proxies to quickly search within children
             * in a collection type object. Don't call explicitly.
             * @param  {String} child The child to search.
             * @return {void}
             */
            function findInChild(child){
                   var noProxy = true;
                   var found = find(child, findInChild.specifier, noProxy);
                   var matches = findInChild.matches;
                   if(found){
                   found = (_.isProxy(found))?found.value:found;

                        if(found instanceof Array)
                            findInChild.matches = matches.concat(found);
                        else
                            matches.push(found);
                }
            }
            /**
             * Like find but uses a faster search without proxies to quickly search within children
             * in a collection type object. Don't call explicitly.
             * @param  {String} child The child to search.
             * @return {void}
             */
            function findInChildNoProxy(child){
                   var noProxy = true;
                   var found = find(child, findInChild.specifier, noProxy);
                   var matches = findInChildNoProxy.matches;
                   if(found){
                   found = (_.isProxy(found))?found.value:found;

                        if(found instanceof Array)
                            findInChildNoProxy.matches = matches.concat(found);
                        else
                            matches.push(found);
                }
            }

            /**
             * Finds a css style specifier inside an object and returns a proxy
             * wrapper of the search results or undefined.
             * @param  {Object} scope         the scope object.
             * @param  {String} rawSpecifier The css style specifier.
             * @return {Proxy}               Returns the proxy wrapper of the search results.
             */
            function find(scope, rawSpecifier, noProxy){
                if(!scope)
                    return scope;

                var isFilterFunc = rawSpecifier instanceof Function;
                var isPropsObj = rawSpecifier instanceof Object;

                var parsedSpecifier = (!(isFilterFunc || isPropsObj))?parseSpecifier(rawSpecifier):{};
                var specifier = parsedSpecifier.specifier;
                var id = parsedSpecifier.id;
                var name = parsedSpecifier.name;
                var key = parsedSpecifier.key;
                var value = parsedSpecifier.val;
                value = value && value.replace(/(\[|\]|\(|\)|\+)/g, "\\$1");
                    
                var range = parsedSpecifier.range;



                if(_.isCollection(scope)){
                    if(isFilterFunc || specifier || key || isPropsObj){
                        if(!key && !id && specifier && specifier in scope){
                                var subCollection = scope[specifier]();
                                if(_.isCollectionPointer(subCollection)){
                                        if(!(name || range || id)){
                                            return (noProxy)?subCollection:new Proxy(subCollection)
                                        }else if(range && "itemByRange" in subCollection){
                                            subCollection = subCollection.itemByRange(range.from, range.to);
                                        }else if(name && "itemByName" in subCollection){
                                            return(noProxy)?subCollection.itemByName(name): new Proxy(subCollection.itemByName(name));
                                        }else if(id && "itemByID" in subCollection){
                                            return (noProxy)?subCollection.itemByID(parseInt(id, 10)):new Proxy(subCollection.itemByID(parseInt(id, 10)));
                                        }
                                    
                                        return (noProxy)?subCollection:new Proxy(subCollection)
                                 }
                         }
                         if(noProxy){
                                findInChildNoProxy.specifier = rawSpecifier;
                                findInChildNoProxy.matches = [];
                                _.each(scope, findInChildNoProxy);
                                return findInChildNoProxy.matches;

                          }else{
                                findInChild.specifier = rawSpecifier;
                                findInChild.matches = [];
                                _.each(scope, findInChild);
                                return new Proxy(findInChild.matches);
                          }
                    }else if(id && "itemByID" in scope){
                        return (noProxy)?scope.itemByID(parseInt(id, 10)):new Proxy(scope.itemByID(parseInt(id, 10)));
                    }
                    else if(name && "itemByName" in scope){
                        return(noProxy)?scope.itemByName(name): new Proxy(scope.itemByName(name));
                    }
                    else if(range && "itemByRange" in scope){
                        return (noProxy)?scope.itemByRange(range.from, range.to): new Proxy(scope.itemByRange(range.from, range.to));
                    }
                }

                if(isFilterFunc){
                    var filtered = rawSpecifier.call(null, scope);
                    if(filtered === true){
                        return (noProxy)?scope:new Proxy(scope);
                     }else if(filtered){
                        return (noProxy)?filtered: new Proxy(filtered);
                     }else{
                        return undefined;
                    }
                }
                if(isPropsObj){
                    if(_.propsMatch(rawSpecifier, scope)){
                        return (noProxy)?scope:new Proxy(scope);
                    }else{
                        return undefined;
                    }
                }
                var neg, keyVal,  childVal,  matchRegex,  match, refinedScope;
                if(!specifier){
                    if(id && "id" in scope && scope.id == parseInt(id,  10)){
                        return (noProxy)?scope: new Proxy(scope);
                    }else if(key){

                        neg = key.indexOf("!") === 0;
                        keyVal = (neg)?key.substr(1):key;
                        if(keyVal in scope){
                            if(scope[keyVal].name)
                                childVal = scope[keyVal].name
                            else
                                childVal = scope[keyVal].toString();
                            matchRegex = new RegExp("^"+value.replace(/\*/g,".*")+"$");
                            match = matchRegex.exec(childVal);
                            if((match && !neg) || (match === null && neg))
                                return (noProxy)?scope: new Proxy(scope);
                        }
                    }else{
                        return undefined;
                    }
                }

                if(!(specifier in scope))
                    return undefined;
                if(_.isProxy(scope) && specifier in scope.value)
                    refinedScope = scope.value[specifier];
                else
                    refinedScope = scope[specifier];
                if(_.isCollection(refinedScope)){
                    if(key || id || name){
                        var matches = [];
                        var single = false;
                        _.each(refinedScope, function(child){
                            if(id && "id" in child && child.id == parseInt(id,  10)){
                                single = true;
                                matches.push(child);
                            }else if(name && "name" in child && child.name == name){
                                single = true;
                                matches.push(child);
                            }else if(key){
                                var neg = key.indexOf("!") === 0;
                                var keyVal = (neg)?key.substr(1):key;
                                if(keyVal in child){
                                    if(child[keyVal].name)
                                        childVal = child[keyVal].name
                                    else
                                        childVal = child[keyVal].toString();
                                    var matchRegex = new RegExp("^"+value.replace(/\*/g,".*")+"$");
                                    var match = matchRegex.exec(childVal);
                                    if((match && !neg) || (match === null && neg))
                                        matches.push(child);
                                }
                            }
                        });
                        if(single){
                            return (noProxy)?matches[0]:new Proxy(matches[0]);
                        }else if(matches.length){
                            return (noProxy)?matches:new Proxy(matches);
                        }else{
                            return undefined;
                        }
                    }
                    return (noProxy)?refinedScope:new Proxy(refinedScope);
                 }else{
                    if(id){
                        if("id" in refinedScope && refinedScope.id == id){
                          return (noProxy)?refinedScope: new Proxy(refinedScope);
                        }else if(name && "name" in refinedScope && refinedScope.name == name){
                          return (noProxy)?child: new Proxy(child);
                        }
                        else{
                           return undefined;
                        }
                    }else if(key){

                        neg = key.indexOf("!") === 0;
                        keyVal = (neg)?key.substr(1):key;
                        if(keyVal in refinedScope){
                            if(refinedScope[keyVal].name)
                                childVal = refinedScope[keyVal].name
                            else
                                childVal = refinedScope[keyVal].toString();
                            matchRegex = new RegExp("^"+value.replace(/\*/g,".*")+"$");
                            match = matchRegex.exec(childVal);
                            if((match && !neg) || (match === null && neg))
                                return (noProxy)?refinedScope:new Proxy(refinedScope);
                        }
                        else{
                          return undefined;
                        }
                    }else if(refinedScope instanceof Function){
                          return (noProxy)?refinedScope:new Proxy(refinedScope, scope);
                    }else if(refinedScope instanceof Object){
                          return (noProxy)?refinedScope:new Proxy(refinedScope);
                    }else{
                          return refinedScope;
                    }
                }
            }
            var truncatedToString = function(){return "[Truncated Proxy Array "+this.length+" elements]";};
            _.flatten = function(collection, ignoreLimits){
                /**
                 * [_.flatten flattens any collection of collections
                 * (can be indesign collections, arrays or proxy collections)
                 * into a single-level collection.
                 * Underscore attempts to keep break out of flattening if
                 * collections get too large (> _.MAX_COLLECTION_SIZE).
                 * set the second [ignoreLimits] option to true to ignore these limits.
                 * 
                 */
                var flattened = [];
                var total = 0;
                _.each(collection, function(arg){
                        if(total < _.MAX_FLATTEN_SIZE || ignoreLimits){
                            if(_.isCollection(arg)){
                                var childElements = _.flatten(arg);
                                total += childElements.length;
                                flattened[flattened.length] = childElements;
                            }else{
                                if(_.isProxy(arg))
                                    arg = arg.value;
                                flattened[flattened.length] = arg;
                            }
                        }
                    });
                var retVal = Array.prototype.concat.apply([],flattened);
                if(total > MAX_FLATTEN_SIZE && !ignoreLimits){
                    retVal.truncated = true;
                    retVal.toString = truncatedToString;
                 }
                return retVal;
            };

            _.propsMatch = function(filter, obj){        
                /**
                 * [propsMatch returns true if all properties in the filter match the properties in the
                 * passed in object]
                 * @param  {Object} filter The Filter Object
                 * @param  {Object} obj    The Object to check.
                 */
                try{
                    for(var flt in filter){
                        if(filter[flt] !== obj[flt]){
                                return false;
                        }
                    }
                }
                catch(err){return false;}
                return true;
             };

             _.setProps = _.mixin = function(scope, mixin){
                /**
                *   
                * Add all properties of the [mixin] object
                * to the scope object.
                */
                if( mixin &&  mixin instanceof Object && scope instanceof Object){
                    for(var key in obj){
                        scope[key] = obj[key];
                    }
                }
             }
          
            _.select = function(){
                /**
                  * Flattens any selection of Proxies,  collections and arrays into a single
                  * 1-level Proxy Array.
                  * Similar to _.flatten but returns a proxy not an array.
                  * @return {[type]} [description]
                  */
                var args = Array.prototype.slice.call(arguments);
                var collections = [];

                _.each(args, function(arg){
                        var scope = _(arg);
                        if(scope){
                            if(_.isCollection(scope)){
                                var flattened = _.flatten(scope);
                                collections.push(_.unique(flattened));
                            }else{
                                collections.push(scope);
                             }
                        }
                });
                var first;
                if(collections.length >= 1){
                    first = collections.unshift();
                }
                return  _(Array.prototype.concat.apply(first,collections));
            };

            _.unique = function(collection){        
                /**
                 * [unique returns a filtered collection of only unique values.]
                 * @param  {CollectionType} collection The collection to inspect.
                 * @return {Array}            All unique items from the collection.
                 */
                var unique = [];
                    _.each(collection, function(value){
                        if(_.indexOf(value, unique) == -1){
                                unique[unique.length] = value;
                        }
                    });
                return unique;
            };


            _.system = function(value){
                /**
                  Execute a system command prompt command.
                */
                try{
                    value = value.replace(/([^\\])"/g,"$1\\\"");
                    return app.doScript("return do shell script \""+value+"\"", ScriptLanguage.APPLESCRIPT_LANGUAGE);
                }catch(err){
                        return err;
                }
            }


            _.flattenCollections = function(val){
                var retVal = [];
                _.each(val, function(item, key){
                     if(_.isCollectionPointer (item)){
                         var subItems = item.everyItem().getElements();
                         for(var idx=0; idx < subItems.length; idx++){
                                retVal[retVal.length] = subItems[idx];
                         }
                     }else if(_.isCollection (item)){
                         retVal = retVal.concat(_.flattenCollections(item));
                     }else{
                         retVal.push(item);
                     }
                 });
                return retVal;
            };

            _.time = function(){
                /**
                   Returns the time in milliseconds since the UNIX epoch.
                */
                return +new Date();
            }

            _.Timer = function(interval, repeats){
                /**
                   Creates a timer object.
                   @param interval How quickly the timer repeats [in milliseconds];
                   @param [repeats] optional. How many repeats before the timer stops. Default is -1 (indefinite)
                */
                var timer = this;
                if(!repeats)
                    repeats = -1;

                _.setProps(this,{interval:interval, repeats:repeats, listeners:[], done:false, currentStep:0})
                this.startTime = _.time();
                this.endTime = (interval * repeats) + this.startTime;

                this.addEventListener = function(type, callback){
                    this.listeners.push([type, callback]);
                }

                this.start = function(){
                    eventLoop.items.push(this);
                    this.stepTime = _.time()
                }

                this.stop = function(){
                    
                    timer.done = true;
                    _.each(timer.listeners, function(listener){
                        var type = listener[0];
                        var callback = listener[1];
                        if(type == _.TimerFinishedEvent){
                            callback();
                        }
                    });
                }

                this.step = function(){
                    var now = _.time()
                    var stepEndTime = (this.currentStep * interval) + this.startTime;
                    if(now  > stepEndTime){
                            this.currentStep ++;
                     }else{
                            return;
                     }

                    if(this.repeats == this.currentStep - 1){
                        this.stop();
                        return;
                    }


                    _.each(this.listeners, function(listener){
                        var type = listener[0];
                        var callback = listener[1];
                        if(type == _.TimerEvent){
                            callback();
                        }
                    });
                };
            }
                    
            /**
             * HTTP Library
             */
            var protocolRegexp = /([^\/]+:\/\/)/;
            var hostRegexp = /([^:\/\?]+)\/?(.*)/;
            var codeReg = /HTTP\/[0-9\.]+\s([0-9]+)/;
            var locationReg = /Location: .*\/\/([^\/]*)\/?(.*)/;
            var httpsReg = /Location: https/;

            var HTTP_CHUNK_SIZE = 4096;
            

            function splitURL(host){
                        info = {host:host,path:""};
                        var proto = protocolRegexp.exec(host);
                        if(proto){
                            host = host.replace(proto[1],"");
                        }
                        var matches = hostRegexp.exec(host);
                        if(matches){
                                if(matches[1])
                                    info.host = matches[1];
                                if(matches[2])
                                    info.path = matches[2];
                        }
                        return info;
                    }

            

            function headers(value){
                        value = value.substring(0, Math.min(1000, value.length - 1));
                        var raw = value.split("\n");
                        var info = {};
                        var newLength = raw.length;
                        var https;
                        for(var idx in raw){
                            var header = raw[idx];
                            if(header == "\r"){
                                newLength = idx;
                                break;
                            }
                            var code = codeReg.exec(header);
                            var location = locationReg.exec(header);
                                if(code){
                                        info.code = parseInt(code[1], 10);
                                        if(info.code == 301 || info.code == 302){
                                                info.redirect = true;
                                        }
                                }
                                if(location){
                                    if(httpsReg.exec(header)){
                                        https = true;
                                    }
                                        info.host = location[1];
                                        info.path = location[2];
                                }


                        }
                        if(https){
                                info.redirect = false;
                        }
                        raw.length = newLength;
                        info.headers = raw;
                        return info;
                    }

              function sendRequest(request, host){

                var conn = connect(host);
                if(!conn)
                    throw new Error("Couldn't connect to "+host);
                conn.write(request);
                var rawData = conn.read(999999);
                conn.close();
                return rawData;

             }

             function getNoFollow(host, path){
                path = path || "";
                var request = [
                    "GET /"+path+" HTTP/1.0",
                    "Host: "+host,
                    "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8) AppleWebKit/536.25 (KHTML, like Gecko) Version/6.0 Safari/536.25",
                    "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language: en-us"
                    ].join("\n")+"\n\n";

                return sendRequest(request, host);
            }

            function headNoFollow(host, path){
                path = path.replace(/^\s*/g,"").replace(/\s*$/g,"") || "";
                var request = [
                    "HEAD /"+path+" HTTP/1.0",
                    "Host: "+host,
                    "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8) AppleWebKit/536.25 (KHTML, like Gecko) Version/6.0 Safari/536.25",
                    "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language: en-us"
                    ].join("\n")+"\n\n";

                return sendRequest(request, host);
            }
            function parseResponse(raw){
                            var headValues = headers(raw);
                            raw = raw.substr(headValues.headers.join("\n").length + 3);
                            var response = {headers:headValues.headers, code: headValues.code,  data:raw, toString: function(){
                                return "[Response:\n"+headValues.headers.join("").replace(/\s/g,", ")+"\ntext: \""+raw.substr(0, Math.min(raw.length,64)).replace(/\n|\r/g,"")+"[...]\" ]";
                            }};
                            if(headValues.host){
                                response.host = headValues.host;
                            }
                            if(headValues.path){
                                response.path = headValues.path;
                            }
                            return response;
                    }
            function sendPost(host, data, path){
                var request = ["POST /"+path+" HTTP/1.0",
                 "Host: "+host,
                "Content-Type: application/x-www-form-urlencoded",
                "Content-Length: "+data.length,
                "",
                data].join("\n");
                return sendRequest(request, host);
            }

            _.postSync = function(host, data, path){
                /**
                 Performs a synchronous post.
                 @param The host to connect to.
                 @param The post parameters to pass as a key-value object.
                 @returns a data object in the form of
                    {code:[return code], headers:[array of headers], data:[response data]}
                 */
                var location = splitURL(host);
                if(! path){
                    path = location.path;
                }
                host = location.host;
                var info = headers(headNoFollow(host,path));
                if(info.redirect){
                     return _.postSync(info.host, data, info.path);
                }else{
                    return parseResponse(sendPost(host, encodeData(data), path));
                }
            };

            _.headSync = function(host, path){
                 /**
                 Performs a synchronous head request.
                 @param The host to connect to.
                 @returns a data object in the form of
                    {code:[return code], headers:[array of headers], data:[empty]}
                 */
                var location = splitURL(host);
                if(! path){
                    path = location.path;
                }
                host = location.host;
                var headInfo = headNoFollow(host);
                var parsed = headers(headInfo);
                if(parsed.redirect){
                     return _.headSync(parsed.host, path);
                }
                else{
                    return parseResponse(headInfo);
                }
            };

            _.getSync = function(host, path){
                /**
                 Performs a synchronous get request.
                 @param The host to connect to.
                 @returns a data object in the form of
                    {code:[return code], headers:[array of headers], data:[resoinse data]}
                 */
                var location = splitURL(host);
                if(! path){
                    path = location.path;
                }
                host = location.host;
                var info = headers(headNoFollow(host,path));
                if(info.redirect){
                     return _.getSync(info.host, info.path);
                }
                else{
                    var data= getNoFollow(host, path);
                    return parseResponse(data);
                }
            };

            function connect(host){
                        var conn = new Socket();
                        conn.encoding = "BINARY";
                        if(conn.open(host+":80")){
                            return conn;
                }
            }

            function Request(request, host, callback){
                    this.conn = connect(host);
                    this.done = false;
                    this.data = "";
                    this.callback = callback;
                    this.step = function(){
                        if(request){
                            var chunk = request.substr (0, HTTP_CHUNK_SIZE);
                            this.conn.write(chunk);
                            request = request.substr(chunk.length);
                        }else{
                            this.data += this.conn.read(HTTP_CHUNK_SIZE);
                            this.done = this.conn.eof;
                            if(this.done)
                                this.callback(this.data);
                        }
                    };
             }
             var headAsyncNoFollow = function(host, path, callback){
                        if(path instanceof Function){
                            callback = path;
                            path = "";
                        }
                        path = path || "";
                        var request = [
                            "HEAD /"+path+" HTTP/1.0",
                            "Host: "+host,
                            "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8) AppleWebKit/536.25 (KHTML, like Gecko) Version/6.0 Safari/536.25",
                            "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                            "Accept-Language: en-us"
                            ].join("\n")+"\n\n";

                         eventLoop.addJob(new Request(request, host, callback));
                    };
            var getAsyncNoFollow = function(host, path, callback){
                        if(path instanceof Function){
                            callback = path;
                            path = "";
                        }
                        path = path || "";
                        var request = [
                            "GET /"+path+" HTTP/1.0",
                            "Host: "+host,
                            "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8) AppleWebKit/536.25 (KHTML, like Gecko) Version/6.0 Safari/536.25",
                            "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                            "Accept-Language: en-us"
                            ].join("\n")+"\n\n";

                        eventLoop.addJob(new Request(request, host, callback));
                    };

            var encodeData = function(data){
                    if(!data)
                        return "";

                    if(data instanceof String)
                        return data;

                    var retVal = "";
                        for(var key in data){
                            retVal += encodeURIComponent (key)+"="+encodeURIComponent (data[key])+"&";
                        }
                    if(retVal)
                        retVal =  retVal.substring (0, retVal.length - 1);
                    return retVal;
            };


            var sendPostAsync = function(host, data, path, callback){
                if(path instanceof Function){
                            callback = path;
                            path = "";
                        }
                path = path || "";
                var request = ["POST /"+path+" HTTP/1.0",
                    "Host: "+host,
                    "Content-Type: application/x-www-form-urlencoded",
                    "Content-Length: "+data.length,
                    "",
                    data].join("\n");

                eventLoop.addJob(new Request(request, host, callback));
             };

            _.get = function(host, path, callback){     
                /**
                 Performs an asynchronous get request.
                 @param The host to connect to.
                 @param callback The function that handles the return data.
                 @callbackParam a data object in the form of
                    {code:[return code], headers:[array of headers], data:[response data]}
                 */
                        if(path instanceof Function){
                            callback = path;
                            path = "";
                        }
                        var location = splitURL(host);
                        if(! path){
                            path = location.path;
                        }
                        host = location.host;
                        headAsyncNoFollow(host, path, function(data){
                            var info = headers(data);
                            if(info.redirect)
                                _.get(info.host, info.path, callback);
                            else{
                                getAsyncNoFollow(host, path, function(data){
                                    if(callback)
                                        callback.call(null,parseResponse(data));
                                });
                              }
                        });
                    };

            _.head = function(host, path, callback){    
                /**
                 Performs an asynchronous header request.
                 @param The host to connect to.
                 @param callback The function that handles the return data.
                 @callbackParam a data object in the form of
                    {code:[return code], headers:[array of headers], data:[empty]}
                 */
                        if(path instanceof Function){
                            callback = path;
                            path = "";
                        }
                        var location = splitURL(host);
                        if(! path){
                            path = location.path;
                        }
                        host = location.host;
                        headAsyncNoFollow(host, path, function(data){
                            var info = headers(data);
                            if(info.redirect)
                                _.head(info.host, info.path, callback);
                            else{
                                if(callback)
                                callback.call(null,parseResponse(data));
                              }
                        });
                    };

            _.post = function(host, data, path, callback){
                 /**
                 Performs an asynchronous post request.
                 @param The host to connect to.
                 @param The data to post as a key-value object.
                 @param callback The function that handles the return data.
                 @callbackParam a data object in the form of
                    {code:[return code], headers:[array of headers], data:[response data]}
                 */
                    if(path instanceof Function){
                        callback = path;
                        path = "";
                    }
                    var location = splitURL(host);
                    if(! path){
                        path = location.path;
                    }
                    host = location.host;
                    headAsyncNoFollow(host, path, function(responseData){
                        var info = headers(responseData);
                        if(info.redirect)
                            _.post(info.host, data, info.path, callback);
                        else{
                            sendPostAsync(host, encodeData(data), path,  function(responseData){
                                if(callback)
                                callback.call(null,parseResponse(responseData));
                            });
                          }
                    });
            };

            _.AnimationBatchSynchronous = function(){
                /**
                        The synchronous animation batch.
                        Allows you to join together a batch of animation to be
                        performed synchronously and simultaneously.
                        Use 
                        add(item, animationProperties, time) #see _.@animate
                        .start()
                        
                */
                this.queue = [];
                this.items = [];
                var context = this;
                this.add = function(value, dest, time, rotation){
                    if(_.isCollection(value)){
                        _.each(value, function(subitem){
                            context.add(subitem, dest, time);
                        });
                    }else{
                        this.items.push({value:value,dest:dest,time:time});
                    }
                };
                this.start = function(){
                    for(var i = 0; i < this.items.length; i++){
                        var item = this.items[i];
                        try{
                            this.queue.push( new Animation(item.value, item.dest, item.time));
                        }catch(err){}
                    }
                    while(!this.done){
                            this.step();
                    }
                };
                this.step = function(){
                    if( ! _.conditional(this.queue, function(animation){return animation.done;})){
                            _(this.queue)._(function(animation){
                                animation.step();
                            });
                        }
                    else{
                        this.done = true;
                        }
                    };
            };
            _.AnimationBatch = function(callback){
                /**
                        The Asynchronous animation batch.
                        Allows you to join together a batch of animation to be
                        performed asynchronously and simultaneously.
                        Use 
                        add(item, animationProperties, time) #see _.@animate
                        .start()
                        
                */
                this.queue = [];
                this.items = [];
                this.callback = callback;
                var context = this;
                this.add = function(value, dest, time, rotation){
                    if(_.isCollection(value)){
                        _.each(value, function(subitem){
                            context.add(subitem, dest, time);
                        });
                    }else{
                        this.items.push({value:value,dest:dest,time:time});
                    }
                };
                this.start = function(){
                    for(var i = 0; i < this.items.length; i++){
                        var item = this.items[i];
                        try{
                            this.queue.push( new Animation(item.value, item.dest, item.time));
                        }catch(err){}
                    }
                    eventLoop.addJob(this);
                };
                var isDone = function(animate){return animate.done};
                var stepAnimation = function(animation){ animation.step(); }
                
                this.step = function(){
                    if( ! _.conditional(this.queue, isDone)){
                            _(this.queue)._(stepAnimation);
                        }
                    else{
                        this.done = true;
                        if(callback instanceof Function)
                            callback.call(null);
                        }
                    };
            };

            _.animate = function(pageItem, to, time, callback){
                if(_.isCollection(pageItem)){
                    var batch = new _.AnimationBatch(callback);
                    _.each(pageItem, function(subItem){
                          batch.add(subItem, to, time);
                     });
                    batch.start();
                }else{
                    eventLoop.addJob(new Animation(pageItem, to, time, callback));
                 }
            };
            _.animateSynchronous = function(pageItem, to, time){
                if(_.isCollection(pageItem)){
                    var batch = new _.AnimationBatchSynchronous();
                    _.each(pageItem, function(subItem){
                          batch.add(pageItem, to, time);
                     });
                    batch.start();
                }else{
                    var anim = new Animation(pageItem, to, time);
                    while(! anim.done){
                            anim.step();
                    }
                }
            };
            _.tempFile = function(extension){
                    if(!extension)
                        extension = "txt";
                    return new File(Folder.temp+"/"+_.uuid()+"."+extension);
            };
            _.tempFolder = function(){
                    var fold = new Folder(Folder.temp+"/"+_.uuid());
                    fold.create();
                    return fold;
                };
            _.getImg = function(url, file, callback){
                    if(typeof file == "string"){
                        file = new File(file);
                    }else if(file instanceof Function){
                        callback = file;
                        file = null;
                    }


                   var data = _.get(url, function(response){
                      if(!file){
                       file = _.tempFile();
                       }

                       file.open("w");
                       file.encoding = "BINARY";
                      file.write(response.data);
                      file.close();
                      if(callback)
                        callback.call(null, file);
                   });



            };

            _.getImgSync = function(url, file){

              var data = _.getSync(url).data;
              if(typeof file == "string"){
                file = new File(file);
              }else if(!file){
                file = _.tempFile();
              }
              file.open("w");
              file.encoding = "BINARY";
              file.write(data);
              file.close();
              return file;
            };

            _.writeToFile = function(path, contents, encoding){
                var file = (path instanceof File)?file:new File(path);
                file.open("w");
                file.encoding = (encoding)?encoding:file.encoding;
                file.write(contents);
                file.close();
                return true;
            }
            _.readFromFile = function(path, encoding){
                var file = (path instanceof File)?file:new File(path);
                file.open("r");
                file.encoding = (encoding)?encoding:file.encoding;
                var data = file.read();
                file.close();
                return data;
            }

            _.sniff = function(host, port){
                var conn = new Socket();
                port |= 80;
                host = splitURL(host).host;
                var start = _.time();
                if(conn.open(host+":"+port))
                    return _.time() - start;
                else
                    return false;
            }

            var Animation = function(pageItem, to, time, callback){
                if(!(geometricBounds in pageItem)){
                    throw new Error(pageItem.name+" cannot be animated");
                }
                if(_.isProxy(pageItem)){
                        pageItem = pageItem.value;
                }
                if(!pageItem.isValid)
                    return;
                var startShear = pageItem.shearAngle;
                var a , rotation,  scale, mult;
                if(to instanceof Array){
                    a = [Math.min(to[0],to[2]),Math.min(to[1],to[3]),Math.max(to[0],to[2]),Math.max(to[1],to[3])];
                    if(a[0] == a[2]) a[2] += 0.1;
                    if(a[1] == a[3]) a[3] += 0.1;
                    rotation = undefined;
                    scale = undefined;
                }else if(to instanceof Object){
                    a = to.to;
                    if(a){
                        a = [Math.min(a[0],a[2]),Math.min(a[1],a[3]),Math.max(a[0],a[2]),Math.max(a[1],a[3])];
                        if(a[0] == a[2]) a[2] += 0.1;
                        if(a[1] == a[3]) a[3] += 0.1;
                    }
                    if(to.rotate){
                        var startRot = pageItem.rotationAngle;
                        var endRot = startRot + to.rotate;
                        rotation = to.rotate;
                    }

                      scale = to.scale;
                      if(scale){
                        scale = Math.pow(scale, 1/100);
                     }
                }
                this.done = false;

                var curTime = _.time();
                var start = curTime;
                var end = curTime + time;
                var stepCount = 1;
                var now = curTime;
                var stepsLeft = 1000;
                var timePerStep = 0;
                var timePassed = 0;
                var scaleOps = 0;

                this.step = function(){
                    if(!pageItem.isValid){
                        this.done = true;
                        return;
                    }
                    stepCount++;
                    now = _.time()
                    timePassed = now - start;

                    if(timePassed >= time){
                         this.done = true;
                         if(rotation){
                            pageItem.shearAngle = startShear;
                            pageItem.rotationAngle = endRot;
                         }
                        if(a)
                            pageItem.geometricBounds = a;

                        if(scale){
                             mult = 1;
                            while(scaleOps < 100){
                                    scaleOps++;
                                    mult *= scale;
                            }

                            pageItem.verticalScale *= mult;
                            pageItem.horizontalScale *= mult;
                       }
                            if(callback instanceof Function)
                                callback.call(null, pageItem);

                    }else{
                       stepsLeft = Math.ceil((end - now)/(timePassed/stepCount));
                        if(a){
                           var b = pageItem.geometricBounds;
                           var dx = (a[1] - b[1])/stepsLeft;
                           var dy = (a[0] - b[0])/stepsLeft;

                           var dw= ((a[3] - a[1]) - (b[3] - b[1]))/stepsLeft+dx;
                           var dh= ((a[2] - a[0]) - (b[2] - b[0]))/stepsLeft+dy;
                           try{
                            pageItem.geometricBounds = [b[0] + dy, b[1] + dx, b[2] + dh, b[3] + dw];
                            }catch(err){}
                       }
                       if(rotation){
                            var dr = rotation/Math.ceil(stepsLeft);
                            rotation -= dr;
                            pageItem.rotationAngle += dr;
                            pageItem.shearAngle = startShear;
                       }
                        if(scale){
                               var percentComplete = Math.floor((timePassed/time)* 100);

                                mult = 1;
                                while(scaleOps < percentComplete){
                                    scaleOps++;
                                    mult *= scale;
                                }
                                pageItem.verticalScale *= mult;
                                pageItem.horizontalScale *= mult;

                        }
                   }

                };
            };

            _.isNum = function(val){
                    return numReg.exec(val);
            };
            _.isCollectionPointer = function(collection){
                var ret;
                try{
                if('anyItem' in collection){
                    ret = !('isProxy' in collection);
                }
                }catch(err){
                    ret = false;
                }
                return ret;
            };
            _.isProxy = function(value){
                    var isProxy;
                    try{
                        isProxy = value.isProxy === true;
                        }catch(err){return false;}
                     return isProxy;
            };
            _.isCollection = function(collection){ return _.isCollectionPointer(collection) || collection instanceof Array ||
                    (_.isProxy(collection) && (_.isCollectionPointer(collection.value)|| collection.value instanceof Array));
                };
            _.toArray = function(collection){
                if(_.isCollectionPointer(collection)){
                    return collection.everyItem().getElements();
                }
                if(_.isProxy(collection) && _.isCollectionPointer(collection.value))
                    return collection.value.everyItem().getElements();
                if(_.isProxy(collection) && collection.value instanceof Array)
                    return collection.value;
                else return collection;
            };
            _.each = function(collection,  callback){
                if(_.isCollectionPointer(collection))
                    collection = collection.everyItem().getElements();
                else if(_.isProxy(collection)){
                    if(_.isCollectionPointer(collection.value)){
                        collection = collection.value.everyItem().getElements();
                    }else if(collection.value instanceof Array){
                        collection = collection.value;
                    }
                }
                else if(!(collection instanceof Array) && ! collection.hasOwnProperty ("length")){
                        for(var key in collection){
                                callback.call(null, collection[key], key);
                        }
                    return;
                }
                var val;
                var collectionIdx = -1;
                var length = collection.length;
                
                while(collectionIdx++ < length -1){
                    try{
                        val = collection[collectionIdx];
                        }catch(err){val = undefined}
                    callback.call(null, val, collectionIdx);
                }
            };

		    _.some = function(collection,  callback){
			    if(_.isCollectionPointer(collection))
				    collection = collection.everyItem().getElements();
			    else if(_.isProxy(collection)){
				    if(_.isCollectionPointer(collection.value)){
					    collection = collection.value.everyItem().getElements();
				    }else if(collection.value instanceof Array){
					    collection = collection.value;
				    }
			    }
			    else if(!(collection instanceof Array) && ! collection.hasOwnProperty ("length")){
				    for(var key in collection){
					    if(callback.call(null, collection[key], key)) {
						    return true;
					    }
				    }
				    return false;
			    }
			    var val;
			    var collectionIdx = -1;
			    var length = collection.length;

			    while(collectionIdx++ < length -1){
				    try{
					    val = collection[collectionIdx];
				    }catch(err){val = undefined}
				    if(callback.call(null, val, collectionIdx))
					    return true;
			    }
			    return false;
		    };

		    _.map = function(collection, callback){
                  var retVal = [];
                  _.each(collection, function(val){
                        retVal.push(callback(val));
                  });
                  return retVal;
                };

            _.filter = function(collection, callback){
                  var retVal = [];
                  _.each(collection, function(val){
                      if(callback(val))
                        retVal.push(val);
                  });
                  return retVal;
                  };

            _.strip = function(str){
                return str.replace(/^\s+/, '').replace(/\s+$/, '');
            };

            _.camelize = function(str) {
                return str.replace(/-+(.)?/g, function(match, chr) {
                  return chr ? chr.toUpperCase() : '';
                });
              };

            _.capitalize = function(str) {
                return str.charAt(0).toUpperCase() + str.substring(1).toLowerCase();
              };

            _.range = function(start, stop, step){
                if(stop === undefined){
                     stop = start;
                     start = 0;
                }
                step = step || 1;

                var len = Math.max(Math.ceil((stop - start) / step), 0);
                var list = new Array(len);
                var idx = 0;
                if(step < 0){
                    for(; start > stop; start += step){
                            list[idx++]=(start);
                    }
                }else{
                    for(;start < stop; start += step){
                            list[idx++]=(start);
                    }
                }
                list.each = function(callback){
                    _.each(list, callback);
                };
                list._ = list.each;
                list.times = function(callback){
                    _.each(list, function(){callback();});
                };
                return list;
            };
            _.random = function(min, max) {
                if (max === null) {
                  max = min;
                  min = 0;
                }
                return min + Math.floor(Math.random() * (max - min + 1));
              };
            _.randFloat = function(min, max){
                    return min + Math.random() * (max - min);
            }
            _["<"] = function(val){
                try{
                    Console.log(val);
                    }catch(err){
                        $.writeln(val);
                    }
                    return '';
                };

            _.ASSERT_TO_ERROR = "assertToError";
            _.ASSERT_TO_LOG = "assertToLog";

            _.ASSERT_METHOD = _.ASSERT_TO_LOG;

            _.assert = function(condition, message){
                if(_.ASSERT_METHOD == _.ASSERT_TO_ERROR){
                    if(!condition)
                            throw new Error("Assertion failed");
                }else if(_.ASSERT_METHOD == _.ASSERT_TO_LOG){
                    if(condition){
                        _.logSuccess("Assertion Passed "+(message)?message:"")
                    }else{
                        _.logError("Assertion Passed "+(message)?message:"")
                    }
                }

              };

          
            _.conditional = function(collection, condition){
                var retVal = true;
                _.each(collection, function(item){
                    retVal &= condition(item);
                });
                return retVal;
            };

            _.uuid = function() {
                var s = [];
                var hexDigits = "0123456789abcdef";
                for (var i = 0; i < 36; i++) {
                    s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
                }
                s[14] = "4";
                s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);
                s[8] = s[13] = s[18] = s[23] = "-";

                var uuid = s.join("");
                return uuid;
            };
            _.randArray = function(min, max, length){
                   return _.map(_.range(length), function(){
                           return _.random(min,max);
                        });
             };
            _.randfArray = function(min, max, length){
                   return _.map(_.range(length), function(){
                           return _.randFloat(min,max);
                        });
             };
            _.arrayEqual = function(val1, val2){
                try{
                if(val1.length != val2.length)
                    return false;
                for(var idx in val1)
                    if(!_.valEqual(val1[idx],val2[idx]))
                        return false;

                return true;
                }catch(err){
                    return false;
                    }
               };

            _.valEqual = function(val1, val2){
                if(val1 instanceof Array || val1 instanceof Object){
                    return _.arrayEqual(val1, val2);
                }else{
                    return val1 == val2;
                }
             };
            _.RestoreMeasurementUnits = function(uuid){
                 try{
                    var prefNames = ["horizontalMeasurementUnits","verticalMeasurementUnits"];
                    var doc = app.activeDocument;

                    _(prefNames)._(function(pref){
                            doc.viewPreferences[pref] = parseInt(doc.extractLabel(pref+":"+uuid), 10);
                    });
                    return uuid;

                }catch(err){

                }
                return;
            };

            _.sh = _.exec = function sh(){
                return _.system(arguments[0]);
            }

            _.SetMeasurementUnits = function(value){
                try{
                    var prefNames = ["horizontalMeasurementUnits","verticalMeasurementUnits"];
                    var doc = app.activeDocument;
                    var uuid = _.uuid();
                    _(prefNames)._(function(pref){
                        doc.insertLabel(pref+":"+uuid,""+(doc.viewPreferences[pref] + 0));
                        doc.viewPreferences[pref] = value;

                    });
                    return uuid;
                }
                catch(err){

                }
                return;
            };
            _.orFalse = function(ths){
                    for(var idx = 0; idx < ths.reflect.properties.length; idx++)
                    {var key = ths.reflect.properties[idx].toString();
                     if(key.indexOf("__") !== 0 && key.indexOf("reflect") !== 0 && key.indexOf("ReflectionInfo"))return ths;}return false;};

            _.diff = function(ths, other){
                var diff = {};
                for(var key in ths){
                   if(!(key in other)){
                        diff[key] = -ths[key];
                   }else{
                       var a = ths[key];
                       var b = other[key];
                        if(a == b){
                            continue;
                        }else{
                            diff[key] = "+"+b - a;
                        }
                   }
                }
               for(key in other){
                   if(!(key in ths)){
                        diff[key] = "+"+other[key];
                   }
                }
                diff.toString = function(){
                    var retVal = "";
                        for(var key in diff){
                            if(key != "toString"){
                                retVal += key + " => "+ diff[key]+"\n";
                                }
                            }
                        return retVal;
                };
            return diff;
            };

            _.totalLength = function(proxyCollection){
                var length = 0;
                    _.each(proxyCollection, function(collection){
                             if(_.isCollection(collection))
                                length += collection.length;
                             else
                                length ++;
                        });
                return length;
            };
            _.collectionType = function(proxyCollection){
                var type = "";

                if(!_.isCollection(proxyCollection))
                    return proxyCollection.value.constructor.name;

                _.each(proxyCollection, function(subCollection){
                        if(type)
                            return;
                        if("firstItem" in subCollection)
                            type = subCollection.firstItem().constructor.name;
                        else if(subCollection instanceof Object && "length" in subCollection && "0" in subCollection && subCollection.length > 0)
                            type = subCollection[0].constructor.name;
                        else
                            type = subCollection.constructor.name;
                    });
                return type;

            };
            _.setTimeout = function(callback, time){
                var job = {done:false};
                var end = _.time() + time;
                job.step = function(){
                    var now = _.time()
                    if(now >= end){
                        this.done = true;
                        callback.call(this);
                    }
                };
                eventLoop.addJob(job);
            };
            _.toMap = function(ths){var obj = {};for(var idx = 0; idx < ths.length; idx++){obj[ths[idx][0]] = ths[idx][1];} return obj;};
            _.memChange = function(){
                var re = $.summary().match(/[0-9]+\s\S+/g);
                _.memprofile = _.memArray();
                return _.memprofile;
            };
            _.memArray = function(){
                    return _.toMap(_.map($.summary().match(/([0-9]+)\s(\S+)/g),function(elm){var pair = elm.split(" ").reverse(); pair[1] = parseInt(pair[1],  10); return pair;}));
            };
            _.snapshot = function(){
               if(_.memprofile)
                    return _.orFalse(_.diff(_.memprofile,_.memChange()));
               else
                    return _.orFalse(_.memChange());
            };
            _.wrapInUndo = function(name, action, undoMode, args){
                undoMode |= UndoModes.FAST_ENTIRE_SCRIPT;
	            args = args || [];
                app.doScript(function(){action.call(null);}, ScriptLanguage.JAVASCRIPT,args, undoMode, name);
            };
            _.profile = function(toProfile, times){
                if(!times)
                    times = 1;

                var irel = _.time();
                while(times-- > 0){
                   toProfile();
                }
                return _.time() - irel;
            };
            _.indexOf = function(value, list){
                    var index = -1;
                    for(var listi = 0; listi < list.length; listi++){
                            if(list[listi] == value){
                                    index = listi;
                                    break;
                            }
                    }

                    return index;
             };
            _.inArray = function(value, list){
                return _.indexOf(value, list) !== -1;
            };

            _.eval = function(script){
                return eval(script);
            };
            _.setTempPref = function(where, what, values){
                    if(!(what instanceof Array))
                        what = [what];

                        var savedValues = {};

                        _.each(what, function(toSet, idx){
                            savedValues[toSet] = where[toSet];
                            if(values instanceof Array){
                               where[toSet] = values[idx];
                            }else{
                               where[toSet] = values;
                            }
                       });

                   var restoreFunc = function(){
                        var values = restoreFunc.values;
                          _.each(values, function(value, key){
                                restoreFunc.where[key] = value;
                           });
                       };
                   restoreFunc.where = where;
                   restoreFunc.values = savedValues;
                   savedValues = null;
                   where = null;
                   what = null;
                   values = null;
                   return restoreFunc;
            };
            _.reset = function(){
                    propList = {};
                    methList = {};
                    eventForwarder.selection = [];
                    eventLoop.items = [];
                    eventLoop.events = {};
                    watchedItems = {};
            };

            _.emptyCache = function(){
                    propList = {};
                    methList = {};
            };

            _.toBase = function(strOrNum, base){
                  var value;
                  if(strOrNum instanceof Array || (typeof strOrNum == 'string' && strOrNum.length > 1)){
                        value = [];
                        strOrNum = strOrNum instanceof Array && strOrNum || strOrNum.split('');
                        _.each(strOrNum, function(val){
                                value.push(_.toBase(val, base));
                            });
                   }else{
                        var num = (typeof strOrNum == 'number') && strOrNum || strOrNum.charCodeAt(0);
                        value = num.toString(base);
                   }
                   return value;
            };
            _.hex = function(strOrNum){
                   return _.toBase(strOrNum, 16);
            };
            _.bin = function(strOrNum){
                    return _.toBase(strOrNum, 2);
            };
            _.sum = function(){
                    var args = Array.prototype.slice(arguments);
                    var total = 0;
                    _.each(args, function(arg){
                            if (typeof arg == 'number'){
                                    total += arg;
                            }else{
                                total += _.Sum(arg);
                            }
                     });
                    return total;
                };

            (function(){
                function menuFunc(evt){
                    if(_.inArray(evt.id, menuFunc.handled))
                        return;
                    menuFunc.handled[menuFunc.handled.length] = evt.id;
                    _.each(app.selection, function(item){
                        moveEvent(evt.target.name, item, evt);
                    });
                }
                menuFunc.handled = [];

                var menuActions = app.menuActions;
                _.each(interestingEvents, function(name){
                        var menuAction = menuActions.itemByName(name);
                        menuAction.removeEventListener('beforeInvoke',menuFunc);
                        menuAction.addEventListener('beforeInvoke',menuFunc);
                  });

               // _.snapshot();
            })();
            _.isClass = function(obj){
                return obj.isClass;
            };
            _.bind = function(object, func){
                return function(){return func.apply(object, Array.prototype.slice.call(arguments))};
             };
            _.Generator = function(init, doJob){
                var value = 0;
                doJob = (doJob && init() && false) || (doJob)?doJob:init;
                doJob.iteration = 1;
                var scope = {};
                scope.isDone = false;

                var step = function(){
                    if(scope.isDone)
                        throw new _.StopIteration();
                    value = doJob.call(scope, value);
                    return value;
                }
                scope.done = function(){scope.isDone = true};
                return step;
            };
            _.generate = function(wrapped, callback){
                    try{
                            while(true){
                                value = wrapped();
                                callback(value);
                            }
                        }catch(err){}
                        return false;
                };
            
            _.StopIteration = function(){this.message = this.toString = function(){return "Iteration stopped"};};
            
            _.pluck = function(value, collection){
                var plucked = new Array(collection.length?collection.length:1);
                _.each(collection, function pluck(item){
                    if(item instanceof Object && value in item)
                        plucked[plucked.length] = item[value];
                })
                return plucked;
            };
            var inScopeApply = function($Super, arg, key){
                return  function(){
                                        var oldSuper;
                                        try{ oldSuper = _.super } catch(err){};
                                        var context = this;
                                        _.super = _.bind(context, $Super);
                                        var retVal = arg[key].apply(this, Array.prototype.slice.call(arguments));
                                        _.super = oldSuper;
                                        return retVal;
                                }
            };
        
            

            _.decorator = function(wrapper){
                    return function(func, scope){
                                if(!scope)
                                    scope = $.global;
                                var funcName;
                                if(typeof func == "string"){
                                    funcName = func;
                                    func = scope[func];
                                    if(!func instanceof Function)
                                        return;
                                }else{
                                    funcName = func.name;
                                }
                                eval(
                                    _.strings(<![CDATA[
                                        function [0](){
                                             var retVal, callback;
                                             var args = Array.prototype.slice.call(arguments);
                                             var wrapped = function [0](){callback.apply(this, args)};
                                             var callback = function(){
                                                 wrapped.returnValue = retVal = func.apply(this, args);
                                             }
                                             wrapper(wrapped,args);
                                             }
                                             scope['[0]'] = [0]; 
                                    ]]>) % [funcName]
                                );
                        }
                };
            
    
            //Shorthand for argsarray. 
            var aa = function(args){return Array.prototype.slice.call(args)};
            
            _.@profile = _.decorator(function(wrapped){
                    var start = _.time();
                    wrapped();
                    _.logInfo(wrapped.name+" took " + (_.time() - start)+" milliseconds");
                });

            _.@trace = _.decorator(
                        function(wrapped){
                                _.logTrace("Enter "+wrapped.name);
                                wrapped();
                                _.logTrace("Exit "+wrapped.name);
                         }
                     );

            _.LOG_TO_FILE       = "LogToFile";
            _.LOG_TO_HTML_FILE  = "LogToHTMLFile";
            _.LOG_TO_CONSOLE    = "LogToConsole";
            _.LOG_FILE          = "";
            _.LOG_METHOD        = _.LOG_CONSOLE;
            _.LOG_FORMAT        = "[%D] (%L) %M";
            _.LOG_HTML_FORMAT   = "<p style='background: %C; margin: 4px; opacity: 0.75; font-family: monospace'><i>[%D]</i><b>(%L)</b> %M</p>";
            
                    
            _.log = function(message, level){
               switch(_.LOG_METHOD){
                    case _.LOG_TO_FILE:
                    case _.LOG_TO_HTML_FILE:
                        if(!_.LOG_FILE){
                            throw new function(){
                                    this.toString = function(){ _ < "You must set the _.LOG_FILE variable before you can log to a file"}
                                    }
                        }
                        else if(typeof _.LOG_FILE == "string"){
                            _.LOG_FILE = new File(_.LOG_FILE);
                        }
                        return logToFile(_.LOG_FILE, message, level);
                    default:
                        return logToConsole(message, level);
               }
            };


            var logToFile = function(file, message, level){
                file.open("a");
                file.write( prepareLogMessage(message+"\n", level) );
                file.close();
            };

            var logToConsole = function(message, level){
                _ < prepareLogMessage(message, level);
            };

            var logColors = {info: 'lightblue', success: 'lightgreen', warn: 'yellow', error: '#ff8866', debug: 'white', trace: '#ffccff'};
            _.logInfo    = function(){ _.log(arguments[0], 'info'); }
            _.logSuccess = function(){ _.log(arguments[0], 'success'); }
            _.logError   = function(){ _.log(arguments[0], 'error'); }
            _.logDebug   = function(){ _.log(arguments[0], 'debug'); }
            _.logWarn    = function(){ _.log(arguments[0], 'warn'); }
            _.logTrace   = function(){ _.log(arguments[0], 'trace'); }
            _.showLog    = function(){ if(_.LOG_FILE instanceof File) _.LOG_FILE.execute();};

            var prepareLogMessage = function(message, level){
                var formatString = (_.LOG_METHOD == _.LOG_TO_HTML_FILE)?_.LOG_HTML_FORMAT:_.LOG_FORMAT;

                var padding = "";
                _( 7 - level.length).times(function(){padding+= (_.LOG_METHOD == _.LOG_TO_HTML_FILE)?"&nbsp;":" "});

                var d = new Date();
                var millis = (1000 + d.getMilliseconds()).toString().substr(1);

                return formatString.replace(/%D/g, d.toLocaleTimeString()+":"+millis).
                                    replace(/%L/g, level.toUpperCase()+padding).
                                    replace(/%M/g, message).
                                    replace(/%C/g, logColors[level]).
                                    replace(/%l/g, level.toLowerCase()+padding) ;
            };
            var createInvokable = function(){
                    var invokable = function(){
                        if(invokable.invoke){
                            return invokable.invoke.apply(invokable, Array.prototype.slice.call(arguments));
                        }
                    }
                    return invokable;
                };
            ClassFactory = {
                instantiate: function instantiate(args){
                    var className = "";
                    var names = _.pluck('name', args);
                    var name = (names.length)?((names[names.length-1])?names[names.length-1]:""):"";
                    var watcher = function watcher(name,  oldVal,  newVal){
                        _ < oldVal;
                    }
                        eval(
                            _.strings(<![CDATA[
                            var cf = function [0](){
                            if(arguments\[0\] == cf) return this;
                            ct = createInvokable();
                            ct.class = cf;
                            ct.__proto__ = new cf(cf);
                            for(var k in cf){
                                ct[k] = cf[k];
                            }
                            ct.toString = function(){
                                return "[Object object]"
                            }+
                            if(ct.init){+
                                ct.init.apply(ct, Array.prototype.slice.call(arguments));+
                            }+
                            delete ct['prototype'];
                            return ct;
                            
                            }
                            ]]>) % [name]
                        );
                    var proto = 
                    cf.toString = function(){
                          return "[Class "+name+"]";
                    }

                 _.each(args, function(arg, idx){
                        if(!idx){
                            if(arg instanceof Function){
                                cf.prototype = new arg;
                                return;
                            }
                        }
                        for(var key in arg){
                                if(key == 'name'){
                                    continue;
                                }
                                if((cf.prototype[key] instanceof Function)){
                                    var $Super = cf.prototype[key];
                                    cf[key] = inScopeApply($Super, arg, key);
                             }else{
                                 cf[key] = arg[key];
                             }
                        }

                     });

                return cf;
                }
                
           };
       
            _.Class = function(){
                /*
                    The _.Class function constructs a new class defined by one or more parameter objects
                    given.
                    If the first argument is a Class, the resultant class will extend this class.
                    This allows multi-level true inheritance. Super functions can be accessed using _.super.
                    All parameters of passed in objects are attached to the class.
                    If a function with name 'init' is passed this is called as the constructor.
                    If a function with name 'invoke' is passed, class instances can be called as
                    generators.
                        Instances have reference to their class through the .class property.
                        E.g
                        
                  Fibonacci = _.Class({
                            first: 0,
                            second: 1,
                            invoke: function(){
                                var next = this.first + this.second;
                                this.first = this.second;
                                this.second = next;
                                return next;
                            }
                        });
                        
                    Person = _.Class({
                        name: "Person",
                        init: function(name){
                              this.name = name;
                         },
                        introduce: function(){
                            return "Hello i am "+this.name;                           
                        }                    
                   })

                   ImportantPerson = _.Class(
                                    
                                Person,
                                {
                                    name: "ImportantPerson",
                                    i: 0,
                                    init: function(name, surname){
                                          _.super(name);
                                          this.surname = surname;
                                     },
                                    introduce: function(){
                                        return _.super() +  " and my surname is "+this.surname;
                                    },
                                    invoke :function(){
                                         this.i++; _ < "You've called me "+this.i+" times"; return this 
                                    }

                               })
                */
                return ClassFactory.instantiate(aa(arguments))
            };
            
            if(devBuild){
                /**
                  Temporary function for generating help documentation from inline comments.  
                */
                Function.prototype.help = function(){
                    var doc = this.toString().match(/[\/]\*([\s\S]*)\*[\/]/);
                    return (doc) ? doc[1].replace(/^\s+|\s+$/g, '') : '';
                };

                _.each(_, function(val, key){
                    if(val instanceof Function && val.help instanceof Function){
                            val.help = val.help();
                   }
                });
                _.each([findInProxy, ProxyFlatten,ProxyEach,ProxySome,ProxyToString, ProxyType,ProxyLength,returnOne,ProxyAnimate, ProxyAddEventListener, ProxyRemoveEventListener, Proxy],function(val, key){
                    if(val instanceof Function && val.help instanceof Function){
                            val.help = val.help();
                   }
                });

                Function.prototype.help = undefined;
            }

       return _
    })();

}
