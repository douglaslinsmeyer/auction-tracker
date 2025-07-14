/* eslint-disable require-await */
/**
 * Interface for Nellis Auction API Service
 * Defines the contract for interacting with nellisauction.com
 */

class INellisApi {
  /**
   * Initialize the API service
   * @returns {Promise<void>}
   */
  initialize() {
    throw new Error('Method initialize() must be implemented');
  }

  /**
   * Set authentication cookies
   * @param {string} cookies - Cookie string
   */
  setCookies(_cookies) {
    throw new Error('Method setCookies() must be implemented');
  }

  /**
   * Get current authentication cookies
   * @returns {string|null} Cookie string
   */
  getCookies() {
    throw new Error('Method getCookies() must be implemented');
  }

  /**
   * Fetch auction data
   * @param {string} auctionId - The auction ID
   * @returns {Promise<Object>} Auction data
   */
  async getAuctionData(_auctionId) {
    throw new Error('Method getAuctionData() must be implemented');
  }

  /**
   * Place a bid on an auction
   * @param {string} auctionId - The auction ID
   * @param {number} amount - Bid amount
   * @returns {Promise<Object>} Bid result
   */
  async placeBid(_auctionId, _amount) {
    throw new Error('Method placeBid() must be implemented');
  }

  /**
   * Check if cookies are valid
   * @returns {Promise<boolean>} True if cookies are valid
   */
  validateCookies() {
    throw new Error('Method validateCookies() must be implemented');
  }

  /**
   * Get user's active bids
   * @returns {Promise<Array>} Array of active bids
   */
  getActiveBids() {
    throw new Error('Method getActiveBids() must be implemented');
  }

  /**
   * Get user's won auctions
   * @returns {Promise<Array>} Array of won auctions
   */
  getWonAuctions() {
    throw new Error('Method getWonAuctions() must be implemented');
  }

  /**
   * Search for auctions
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of auction results
   */
  searchAuctions(_query, _options = {}) {
    throw new Error('Method searchAuctions() must be implemented');
  }

  /**
   * Get auction categories
   * @returns {Promise<Array>} Array of categories
   */
  getCategories() {
    throw new Error('Method getCategories() must be implemented');
  }

  /**
   * Check API health/availability
   * @returns {Promise<boolean>} True if API is available
   */
  checkHealth() {
    throw new Error('Method checkHealth() must be implemented');
  }
}

module.exports = INellisApi;