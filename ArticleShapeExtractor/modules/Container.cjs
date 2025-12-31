class Container {
    /** @type {Array<{
            factoryFunction: Function,
            providerType: string,
            lastInstance: Object,
            >}
        }
    */
    #registrations = {};

    /**
     * @param {string} service
     * @param {Function} factoryFunction
     */
    registerFactory (service, factoryFunction) {
        this.#register(service, factoryFunction, "factory");
    }

    /**
     * @param {string} service
     * @param {Function} factoryFunction
     */
    registerSingleton (service, factoryFunction) {
        this.#register(service, factoryFunction, "singleton");
    }

    /**
     * @param {string} service
     * @param {Function} factoryFunction
     * @param {string} providerType
     */
    #register (service, factoryFunction, providerType) {
        if (typeof factoryFunction !== "function") {
            throw new Error("Factory '" + typeof factoryFunction + "' is not a function.");
        }
        if (this.#registrations[service]) {
            throw new Error("Service '" + service + "' is already registered.");
        }
        if (providerType !== "singleton" && providerType !== "factory") {
            throw new Error("Provider type '" + providerType + "' is unknown.");
        }
        this.#registrations[service] = {
            factoryFunction: factoryFunction,
            providerType: providerType,
            lastInstance: null,
        };
    }

    /**
     * @template T
     * @param {string} service
     * @returns {T}
     */
    resolve (service) {
        if (!this.#registrations[service]) {
            throw new Error("Service '" + service + "' not registered.");
        }
        let registration = this.#registrations[service];
        if (
            (registration.providerType === "singleton" && registration.lastInstance === null)
            || registration.providerType === "factory"
        ) {
            const createdInstance = registration.factoryFunction();
            if (typeof createdInstance !== "object") {
                throw new Error(
                    "Factory function for service '" + service + "' created '" + typeof createdInstance + "', "
                    + "but expected an object.");
            }
            const actualService = this.#getClassname(createdInstance);
            if (actualService !== service) {
                throw new Error(
                    "Factory function for service '" + service + "' created instance of '" + actualService + "', "
                    + "but expected an instance of '" + service + "'.");
            }
            registration.lastInstance = createdInstance;
        }
        return registration.lastInstance;
    }

    /**
     * @param {Object} obj
     * @returns {string}
     */
    #getClassname (obj) {
        if (!obj || !obj.constructor) {
            return "Unknown";
        }
        return obj.constructor.name;
    }
};

module.exports = new Container(); // singleton
