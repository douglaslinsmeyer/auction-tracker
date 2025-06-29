/**
 * Service Interfaces
 * Export all service interfaces for dependency injection
 */

module.exports = {
  IAuctionMonitor: require('./IAuctionMonitor'),
  INellisApi: require('./INellisApi'),
  IStorage: require('./IStorage'),
  IWebSocketHandler: require('./IWebSocketHandler')
};