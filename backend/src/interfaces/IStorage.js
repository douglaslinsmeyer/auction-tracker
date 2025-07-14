/**
 * Interface for Storage Service
 * Defines the contract for data persistence
 */

class IStorage {
  /**
   * Initialize the storage service
   * @returns {Promise<void>}
   */
  initialize() {
    throw new Error('Method initialize() must be implemented');
  }

  /**
   * Check if storage is connected/available
   * @returns {boolean} Connection status
   */
  isConnected() {
    throw new Error('Method isConnected() must be implemented');
  }

  /**
   * Save an auction to storage
   * @param {string} auctionId - The auction ID
   * @param {Object} auctionData - Auction data to save
   * @returns {Promise<void>}
   */
  saveAuction(_auctionId, _auctionData) {
    throw new Error('Method saveAuction() must be implemented');
  }

  /**
   * Get an auction from storage
   * @param {string} auctionId - The auction ID
   * @returns {Promise<Object|null>} Auction data or null
   */
  getAuction(_auctionId) {
    throw new Error('Method getAuction() must be implemented');
  }

  /**
   * Delete an auction from storage
   * @param {string} auctionId - The auction ID
   * @returns {Promise<boolean>} Success status
   */
  deleteAuction(_auctionId) {
    throw new Error('Method deleteAuction() must be implemented');
  }

  /**
   * Get all auction IDs
   * @returns {Promise<Array<string>>} Array of auction IDs
   */
  getAllAuctionIds() {
    throw new Error('Method getAllAuctionIds() must be implemented');
  }

  /**
   * Get all auctions
   * @returns {Promise<Array>} Array of auction objects
   */
  getAllAuctions() {
    throw new Error('Method getAllAuctions() must be implemented');
  }

  /**
   * Save authentication cookies
   * @param {string} cookies - Cookie string
   * @returns {Promise<void>}
   */
  saveCookies(_cookies) {
    throw new Error('Method saveCookies() must be implemented');
  }

  /**
   * Get authentication cookies
   * @returns {Promise<string|null>} Cookie string or null
   */
  getCookies() {
    throw new Error('Method getCookies() must be implemented');
  }

  /**
   * Save user settings
   * @param {Object} settings - Settings object
   * @returns {Promise<void>}
   */
  saveSettings(_settings) {
    throw new Error('Method saveSettings() must be implemented');
  }

  /**
   * Get user settings
   * @returns {Promise<Object>} Settings object
   */
  getSettings() {
    throw new Error('Method getSettings() must be implemented');
  }

  /**
   * Clear all data
   * @returns {Promise<void>}
   */
  clearAll() {
    throw new Error('Method clearAll() must be implemented');
  }

  /**
   * Get storage statistics
   * @returns {Promise<Object>} Statistics object
   */
  getStats() {
    throw new Error('Method getStats() must be implemented');
  }
}

module.exports = IStorage;