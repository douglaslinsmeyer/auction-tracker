/**
 * SSE Client Interface
 * Defines the contract for Server-Sent Events client implementations
 */

class ISSEClient {
  /**
   * Initialize the SSE client
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('ISSEClient.initialize() must be implemented');
  }

  /**
   * Connect to SSE endpoint for a specific auction
   * @param {string} productId - The product ID to monitor
   * @param {string} auctionId - The auction ID (for reference)
   * @returns {Promise<boolean>} True if connection was successful
   */
  async connectToAuction(productId, auctionId) {
    throw new Error('ISSEClient.connectToAuction() must be implemented');
  }

  /**
   * Disconnect SSE for a specific product
   * @param {string} productId - The product ID to disconnect
   * @returns {void}
   */
  disconnect(productId) {
    throw new Error('ISSEClient.disconnect() must be implemented');
  }

  /**
   * Disconnect all SSE connections
   * @returns {void}
   */
  disconnectAll() {
    throw new Error('ISSEClient.disconnectAll() must be implemented');
  }

  /**
   * Get connection status for all SSE connections
   * @returns {Object} Status object with connection information
   */
  getConnectionStatus() {
    throw new Error('ISSEClient.getConnectionStatus() must be implemented');
  }

  /**
   * Handle bid update from SSE
   * @param {string} productId - The product ID
   * @param {string} auctionId - The auction ID
   * @param {Object} bidData - The bid data from SSE
   * @returns {Promise<void>}
   */
  async handleBidUpdate(productId, auctionId, bidData) {
    throw new Error('ISSEClient.handleBidUpdate() must be implemented');
  }

  /**
   * Handle auction closed event from SSE
   * @param {string} productId - The product ID
   * @param {string} auctionId - The auction ID
   * @param {Object} closeData - The auction close data from SSE
   * @returns {Promise<void>}
   */
  async handleAuctionClosed(productId, auctionId, closeData) {
    throw new Error('ISSEClient.handleAuctionClosed() must be implemented');
  }

  /**
   * Handle reconnection with exponential backoff
   * @param {string} productId - The product ID to reconnect
   * @param {string} auctionId - The auction ID
   * @returns {Promise<void>}
   */
  async handleReconnection(productId, auctionId) {
    throw new Error('ISSEClient.handleReconnection() must be implemented');
  }

  /**
   * Extract product ID from Nellis auction URL
   * @param {string} url - The auction URL
   * @returns {string|null} Product ID or null if not found
   */
  static extractProductId(url) {
    throw new Error('ISSEClient.extractProductId() must be implemented');
  }
}

module.exports = ISSEClient;