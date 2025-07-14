/**
 * AuctionMonitor Class Implementation
 * Wraps the existing singleton for class-based usage
 */

const IAuctionMonitor = require('../../interfaces/IAuctionMonitor');
const auctionMonitorSingleton = require('../auctionMonitor');

class AuctionMonitorClass extends IAuctionMonitor {
  constructor(storage, nellisApi, logger) {
    super();
    // For now, delegate to singleton
    // In future, this will contain the actual implementation
    this._singleton = auctionMonitorSingleton;

    // Store dependencies for future use
    this._storage = storage;
    this._nellisApi = nellisApi;
    this._logger = logger;
  }

  initialize(wss, broadcastHandler) {
    return this._singleton.initialize(wss, broadcastHandler);
  }

  addAuction(auctionId, config, metadata) {
    return this._singleton.addAuction(auctionId, config, metadata);
  }

  removeAuction(auctionId) {
    return this._singleton.removeAuction(auctionId);
  }

  updateAuctionConfig(auctionId, configUpdates) {
    return this._singleton.updateAuctionConfig(auctionId, configUpdates);
  }

  getMonitoredAuctions() {
    return this._singleton.getMonitoredAuctions();
  }

  getMonitoredCount() {
    return this._singleton.getMonitoredCount();
  }

  isMonitoring(auctionId) {
    return this._singleton.isMonitoring(auctionId);
  }

  handleBid(auctionId, amount, strategy) {
    return this._singleton.handleBid(auctionId, amount, strategy);
  }

  async forceUpdate(auctionId) {
    // This method might not exist in singleton yet
    if (typeof this._singleton.forceUpdate === 'function') {
      return this._singleton.forceUpdate(auctionId);
    }
    // Fallback implementation
    const auction = this._singleton.monitoredAuctions.get(auctionId);
    if (auction) {
      await this._singleton.updateAuction(auctionId);
    }
    return undefined;
  }

  shutdown() {
    return this._singleton.shutdown();
  }

  getStats() {
    // This method might not exist in singleton yet
    if (typeof this._singleton.getStats === 'function') {
      return this._singleton.getStats();
    }
    // Provide basic stats
    return {
      monitoredCount: this.getMonitoredCount(),
      auctions: this.getMonitoredAuctions().map(a => ({
        id: a.id,
        title: a.title,
        isActive: !a.data?.isClosed
      }))
    };
  }

  /**
   * Static factory method for backward compatibility
   * @returns {AuctionMonitorClass} Instance wrapping the singleton
   */
  static getInstance() {
    return new AuctionMonitorClass();
  }
}

module.exports = AuctionMonitorClass;