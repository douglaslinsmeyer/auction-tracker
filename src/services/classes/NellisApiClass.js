/**
 * NellisApi Class Implementation
 * Wraps the existing singleton for class-based usage
 */

const INellisApi = require('../../interfaces/INellisApi');
const nellisApiSingleton = require('../nellisApi');

class NellisApiClass extends INellisApi {
  constructor(storage, logger) {
    super();
    // For now, delegate to singleton
    this._singleton = nellisApiSingleton;
    
    // Store dependencies for future use
    this._storage = storage;
    this._logger = logger;
  }

  async initialize() {
    return this._singleton.initialize();
  }

  setCookies(cookies) {
    return this._singleton.setCookies(cookies);
  }

  getCookies() {
    return this._singleton.getCookies();
  }

  async getAuctionData(auctionId) {
    return this._singleton.getAuctionData(auctionId);
  }

  async placeBid(auctionId, amount) {
    return this._singleton.placeBid(auctionId, amount);
  }

  async validateCookies() {
    // This method might not exist in singleton yet
    if (typeof this._singleton.validateCookies === 'function') {
      return this._singleton.validateCookies();
    }
    // Simple validation - try to fetch any auction
    try {
      await this.getAuctionData('1');
      return true;
    } catch (error) {
      if (error.message?.includes('authentication') || error.message?.includes('login')) {
        return false;
      }
      // Other errors might not be auth-related
      return true;
    }
  }

  async getActiveBids() {
    // This method might not exist in singleton yet
    if (typeof this._singleton.getActiveBids === 'function') {
      return this._singleton.getActiveBids();
    }
    throw new Error('getActiveBids not implemented yet');
  }

  async getWonAuctions() {
    // This method might not exist in singleton yet
    if (typeof this._singleton.getWonAuctions === 'function') {
      return this._singleton.getWonAuctions();
    }
    throw new Error('getWonAuctions not implemented yet');
  }

  async searchAuctions(query, options = {}) {
    // This method might not exist in singleton yet
    if (typeof this._singleton.searchAuctions === 'function') {
      return this._singleton.searchAuctions(query, options);
    }
    throw new Error('searchAuctions not implemented yet');
  }

  async getCategories() {
    // This method might not exist in singleton yet
    if (typeof this._singleton.getCategories === 'function') {
      return this._singleton.getCategories();
    }
    throw new Error('getCategories not implemented yet');
  }

  async checkHealth() {
    // Simple health check
    try {
      const response = await this._singleton.makeRequest('https://nellisauction.com');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Static factory method for backward compatibility
   * @returns {NellisApiClass} Instance wrapping the singleton
   */
  static getInstance() {
    return new NellisApiClass();
  }
}

module.exports = NellisApiClass;