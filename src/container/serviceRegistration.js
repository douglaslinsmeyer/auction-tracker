/**
 * Service Registration
 * Registers all services with the container
 */

const ServiceContainer = require('./ServiceContainer');
const container = ServiceContainer.default;

// Import interfaces
const {
  IAuctionMonitor,
  INellisApi,
  ISSEClient,
  IStorage,
  IWebSocketHandler
} = require('../interfaces');

// Import existing singleton services
const auctionMonitor = require('../services/auctionMonitor');
const nellisApi = require('../services/nellisApi');
const sseClient = require('../services/sseClient');
const storage = require('../services/storage');
const wsHandler = require('../services/websocket');

// Register interfaces
container.registerInterface('IAuctionMonitor', IAuctionMonitor);
container.registerInterface('INellisApi', INellisApi);
container.registerInterface('ISSEClient', ISSEClient);
container.registerInterface('IStorage', IStorage);
container.registerInterface('IWebSocketHandler', IWebSocketHandler);

// Register existing singletons as factories
container.register('auctionMonitor', () => auctionMonitor, { factory: true });
container.register('nellisApi', () => nellisApi, { factory: true });
container.register('sseClient', () => sseClient, { factory: true });
container.register('storage', () => storage, { factory: true });
container.register('wsHandler', () => wsHandler, { factory: true });

// Future: Register class-based implementations
// container.register('auctionMonitor', AuctionMonitorClass, {
//   singleton: true,
//   dependencies: ['storage', 'nellisApi', 'logger']
// });

/**
 * Get a service from the container
 * @param {string} serviceName - Name of the service
 * @returns {*} Service instance
 */
function getService(serviceName) {
  return container.get(serviceName);
}

/**
 * Create a new container scope
 * @returns {ServiceContainer} New container instance
 */
function createScope() {
  return container.createScope();
}

module.exports = {
  container,
  getService,
  createScope
};