/**
 * Service Container for Dependency Injection
 * Manages service instances and their dependencies
 */

class ServiceContainer {
  constructor() {
    this.services = new Map();
    this.singletons = new Map();
    this.factories = new Map();
    this.interfaces = new Map();
  }

  /**
   * Register a service interface
   * @param {string} name - Interface name
   * @param {Function} interfaceClass - Interface class
   */
  registerInterface(name, interfaceClass) {
    this.interfaces.set(name, interfaceClass);
  }

  /**
   * Register a service implementation
   * @param {string} name - Service name
   * @param {Function} implementation - Service class or factory
   * @param {Object} options - Registration options
   */
  register(name, implementation, options = {}) {
    const { singleton = true, dependencies = [], factory = false } = options;

    if (factory) {
      this.factories.set(name, { 
        factory: implementation, 
        dependencies 
      });
    } else {
      this.services.set(name, {
        implementation,
        dependencies,
        singleton
      });
    }
  }

  /**
   * Get a service instance
   * @param {string} name - Service name
   * @returns {*} Service instance
   */
  get(name) {
    // Check if singleton already exists
    if (this.singletons.has(name)) {
      return this.singletons.get(name);
    }

    // Check if it's a factory
    if (this.factories.has(name)) {
      const { factory, dependencies } = this.factories.get(name);
      const resolvedDeps = this.resolveDependencies(dependencies);
      return factory(...resolvedDeps);
    }

    // Check if it's a registered service
    if (this.services.has(name)) {
      const { implementation, dependencies, singleton } = this.services.get(name);
      const resolvedDeps = this.resolveDependencies(dependencies);
      
      const instance = new implementation(...resolvedDeps);
      
      if (singleton) {
        this.singletons.set(name, instance);
      }
      
      return instance;
    }

    throw new Error(`Service '${name}' not found in container`);
  }

  /**
   * Resolve dependencies
   * @param {Array<string>} dependencies - Array of dependency names
   * @returns {Array} Resolved dependencies
   */
  resolveDependencies(dependencies) {
    return dependencies.map(dep => this.get(dep));
  }

  /**
   * Check if a service is registered
   * @param {string} name - Service name
   * @returns {boolean} True if registered
   */
  has(name) {
    return this.services.has(name) || this.factories.has(name) || this.singletons.has(name);
  }

  /**
   * Clear all registrations
   */
  clear() {
    this.services.clear();
    this.singletons.clear();
    this.factories.clear();
  }

  /**
   * Create a scoped container
   * @returns {ServiceContainer} New container instance
   */
  createScope() {
    const scope = new ServiceContainer();
    
    // Copy service and factory registrations (not singletons)
    this.services.forEach((value, key) => {
      scope.services.set(key, value);
    });
    
    this.factories.forEach((value, key) => {
      scope.factories.set(key, value);
    });
    
    // Share interface registrations
    this.interfaces.forEach((value, key) => {
      scope.interfaces.set(key, value);
    });
    
    return scope;
  }

  /**
   * Validate implementation against interface
   * @param {string} interfaceName - Interface name
   * @param {Object} implementation - Implementation instance
   * @throws {Error} If implementation doesn't match interface
   */
  validateInterface(interfaceName, implementation) {
    const interfaceClass = this.interfaces.get(interfaceName);
    if (!interfaceClass) {
      throw new Error(`Interface '${interfaceName}' not registered`);
    }

    const interfaceProto = interfaceClass.prototype;
    const requiredMethods = Object.getOwnPropertyNames(interfaceProto)
      .filter(name => name !== 'constructor' && typeof interfaceProto[name] === 'function');

    for (const method of requiredMethods) {
      if (typeof implementation[method] !== 'function') {
        throw new Error(`Implementation missing required method '${method}' from interface '${interfaceName}'`);
      }
    }
  }

  /**
   * Get all registered service names
   * @returns {Array<string>} Service names
   */
  getServiceNames() {
    const names = new Set([
      ...this.services.keys(),
      ...this.factories.keys(),
      ...this.singletons.keys()
    ]);
    return Array.from(names);
  }
}

// Create default container instance
const defaultContainer = new ServiceContainer();

// Export both class and default instance
module.exports = ServiceContainer;
module.exports.default = defaultContainer;