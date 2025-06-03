const Container = {
    _registrations: {},

    /**
     * @param {String} service
     * @param {Function} factoryFunction
     */    
    registerFactory: function(service, factoryFunction) {
        this._register(service, factoryFunction, 'factory')
    },

    /**
     * @param {String} service
     * @param {Function} factoryFunction
     */    
    registerSingleton: function(service, factoryFunction) {
        this._register(service, factoryFunction, 'singleton')
    },

    /**
     * @param {String} service
     * @param {Function} factoryFunction
     * @param {String} providerType
     */    
    _register: function(service, factoryFunction, providerType) {
        if(typeof factoryFunction !== "function") {
            throw new Error("Factory '" + typeof factoryFunction + "' is not a function.");
        }
        if (this._registrations[service]) {
            throw new Error("Service '" + service + "' is already registered.");
        }
        if (providerType !== 'singleton' && providerType !== 'factory') {
            throw new Error("Provider type '" + providerType + "' is unknown.");
        }
        this._registrations[service] = {
            factoryFunction: factoryFunction, 
            providerType: providerType, 
            lastInstance: null 
        };
    },

    /**
     * @param {String} service
     * @returns {Object}
     */    
    resolve: function(service) {
        if (!this._registrations[service]) {
            throw new Error("Service '" + service + "' not registered.");
        }
        let registration = this._registrations[service];
        if (
            (registration.providerType === 'singleton' && registration.lastInstance === null) 
            || registration.providerType === 'factory'
        ) {
            const createdInstance = registration.factoryFunction();
            if(typeof createdInstance !== "object") {
                throw new Error(
                    "Factory function for service '" + service + "' created '" + typeof createdInstance + "', " 
                    + "but expected an object.");
            }
            const actualService = this._getClassname(createdInstance)
            if( actualService !== service) {
                throw new Error(
                    "Factory function for service '" + service + "' created instance of '" + actualService + "', "
                    + "but expected an instance of '" + service + "'.");
            }
            registration.lastInstance = createdInstance;
        }
        return registration.lastInstance;
    },

    /**
     * @param {Object} obj
     * @returns {String}
     */    
    _getClassname: function (obj) {
        if (!obj || !obj.constructor) {
            return "Unknown";
        }
        return obj.constructor.name;
    },
};

module.exports = Container;