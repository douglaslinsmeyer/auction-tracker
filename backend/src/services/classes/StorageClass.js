/**
 * Storage Class Implementation
 * Wraps the existing singleton for class-based usage
 */

const IStorage = require('../../interfaces/IStorage');
const storageSingleton = require('../storage');

class StorageClass extends IStorage {
  constructor(redisConfig, logger) {
    super();
    // For now, delegate to singleton
    this._singleton = storageSingleton;

    // Store config for future use
    this._redisConfig = redisConfig;
    this._logger = logger;
  }

  initialize() {
    return this._singleton.initialize();
  }

  isConnected() {
    return this._singleton.connected;
  }

  saveAuction(auctionId, auctionData) {
    return this._singleton.saveAuction(auctionId, auctionData);
  }

  getAuction(auctionId) {
    return this._singleton.getAuction(auctionId);
  }

  deleteAuction(auctionId) {
    return this._singleton.deleteAuction(auctionId);
  }

  getAllAuctionIds() {
    return this._singleton.getAllAuctionIds();
  }

  getAllAuctions() {
    return this._singleton.getAllAuctions();
  }

  saveCookies(cookies) {
    return this._singleton.saveCookies(cookies);
  }

  getCookies() {
    return this._singleton.getCookies();
  }

  saveSettings(settings) {
    return this._singleton.saveSettings(settings);
  }

  getSettings() {
    return this._singleton.getSettings();
  }

  async clearAll() {
    // This method might not exist in singleton yet
    if (typeof this._singleton.clearAll === 'function') {
      return this._singleton.clearAll();
    }

    // Manual clear implementation
    if (this._singleton.redis && this._singleton.connected) {
      await this._singleton.redis.flushdb();
    } else {
      // Clear memory storage
      const ids = await this.getAllAuctionIds();
      for (const id of ids) {
        await this.deleteAuction(id);
      }
      // Clear other data
      if (this._singleton.memoryStorage) {
        this._singleton.memoryStorage.cookies = null;
        this._singleton.memoryStorage.settings = {};
      }
    }
    return undefined;
  }

  async getStats() {
    // This method might not exist in singleton yet
    if (typeof this._singleton.getStats === 'function') {
      return this._singleton.getStats();
    }

    // Provide basic stats
    const auctionCount = (await this.getAllAuctionIds()).length;
    const hasRedis = this._singleton.connected;

    return {
      type: hasRedis ? 'redis' : 'memory',
      connected: hasRedis,
      auctionCount,
      hasCookies: Boolean(await this.getCookies())
    };
  }

  /**
   * Static factory method for backward compatibility
   * @returns {StorageClass} Instance wrapping the singleton
   */
  static getInstance() {
    return new StorageClass();
  }
}

module.exports = StorageClass;