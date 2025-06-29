/**
 * Service Exports - Backward Compatible
 * Provides both singleton and class-based exports
 */

// Import singletons (existing)
const auctionMonitor = require('./auctionMonitor');
const nellisApi = require('./nellisApi');
const storage = require('./storage');
const wsHandler = require('./websocket');
const sseClient = require('./sseClient');

// Import classes (new)
const {
  AuctionMonitorClass,
  NellisApiClass,
  StorageClass,
  WebSocketHandlerClass
} = require('./classes');

// Export singletons (for backward compatibility)
module.exports = {
  // Singleton instances (existing API)
  auctionMonitor,
  nellisApi,
  storage,
  wsHandler,
  sseClient,
  
  // Class constructors (new API)
  AuctionMonitorClass,
  NellisApiClass,
  StorageClass,
  WebSocketHandlerClass,
  
  // Convenience factory methods
  createAuctionMonitor: (storage, nellisApi, logger) => new AuctionMonitorClass(storage, nellisApi, logger),
  createNellisApi: (storage, logger) => new NellisApiClass(storage, logger),
  createStorage: (redisConfig, logger) => new StorageClass(redisConfig, logger),
  createWebSocketHandler: (auctionMonitor, logger) => new WebSocketHandlerClass(auctionMonitor, logger)
};