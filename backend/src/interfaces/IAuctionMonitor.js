/* eslint-disable require-await */
/**
 * Interface for Auction Monitor Service
 * Defines the contract for auction monitoring functionality
 */

class IAuctionMonitor {
  /**
   * Initialize the auction monitor
   * @param {WebSocketServer} wss - WebSocket server instance
   * @param {Function} broadcastHandler - Handler for broadcasting updates
   * @returns {Promise<void>}
   */
  async initialize(_wss, _broadcastHandler) {
    throw new Error('Method initialize() must be implemented');
  }

  /**
   * Add an auction to monitor
   * @param {string} auctionId - The auction ID
   * @param {Object} config - Monitoring configuration
   * @param {Object} metadata - Optional metadata
   * @returns {Promise<boolean>} Success status
   */
  async addAuction(_auctionId, _config, _metadata) {
    throw new Error('Method addAuction() must be implemented');
  }

  /**
   * Remove an auction from monitoring
   * @param {string} auctionId - The auction ID
   * @returns {Promise<boolean>} Success status
   */
  async removeAuction(_auctionId) {
    throw new Error('Method removeAuction() must be implemented');
  }

  /**
   * Update auction configuration
   * @param {string} auctionId - The auction ID
   * @param {Object} configUpdates - Configuration updates
   * @returns {Promise<boolean>} Success status
   */
  async updateAuctionConfig(_auctionId, _configUpdates) {
    throw new Error('Method updateAuctionConfig() must be implemented');
  }

  /**
   * Get all monitored auctions
   * @returns {Array} Array of auction objects
   */
  getMonitoredAuctions() {
    throw new Error('Method getMonitoredAuctions() must be implemented');
  }

  /**
   * Get count of monitored auctions
   * @returns {number} Count of monitored auctions
   */
  getMonitoredCount() {
    throw new Error('Method getMonitoredCount() must be implemented');
  }

  /**
   * Check if an auction is being monitored
   * @param {string} auctionId - The auction ID
   * @returns {boolean} True if monitored
   */
  isMonitoring(_auctionId) {
    throw new Error('Method isMonitoring() must be implemented');
  }

  /**
   * Handle bid placement
   * @param {string} auctionId - The auction ID
   * @param {number} amount - Bid amount
   * @param {string} strategy - Bidding strategy
   * @returns {Promise<Object>} Bid result
   */
  async handleBid(_auctionId, _amount, _strategy) {
    throw new Error('Method handleBid() must be implemented');
  }

  /**
   * Force update of a specific auction
   * @param {string} auctionId - The auction ID
   * @returns {Promise<void>}
   */
  async forceUpdate(_auctionId) {
    throw new Error('Method forceUpdate() must be implemented');
  }

  /**
   * Shutdown the auction monitor
   */
  shutdown() {
    throw new Error('Method shutdown() must be implemented');
  }

  /**
   * Get monitoring statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    throw new Error('Method getStats() must be implemented');
  }
}

module.exports = IAuctionMonitor;