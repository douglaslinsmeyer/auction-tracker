const Redis = require('ioredis');
const EventEmitter = require('events');
const cryptoUtil = require('../utils/crypto');
const logger = require('../utils/logger');

class StorageService extends EventEmitter {
  constructor() {
    super();
    this.redis = null;
    this.connected = false;
    this.memoryFallback = new Map();
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = Infinity; // Keep trying forever
    this.reconnectDelay = 5000; // 5 seconds between reconnect attempts
    this.config = {
      keyPrefix: 'nellis:',
      cookieTTL: 86400, // 24 hours in seconds
      auctionDataTTL: 3600, // 1 hour for auction data cache
    };
  }

  async initialize() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      logger.info('Connecting to Redis:', redisUrl);
      
      this.redis = new Redis(redisUrl, {
        retryStrategy: (times) => {
          // Use exponential backoff with max delay of 30 seconds
          const delay = Math.min(times * 1000, 30000);
          logger.debug(`Redis connection retry ${times}, delay ${delay}ms`);
          return delay; // Keep retrying indefinitely
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        enableOfflineQueue: true,
        lazyConnect: true, // Don't connect immediately
      });

      this.redis.on('connect', () => {
        logger.info('Redis connected');
        this.connected = true;
        this.emit('connected');
      });

      this.redis.on('error', (err) => {
        logger.error('Redis error:', err);
        this.connected = false;
        // Only emit error if there are listeners to prevent uncaught exception
        if (this.listenerCount('error') > 0) {
          this.emit('error', err);
        }
      });

      this.redis.on('close', () => {
        logger.info('Redis connection closed');
        this.connected = false;
        this.emit('disconnected');
      });

      this.redis.on('ready', () => {
        logger.info('Redis ready and operational');
        this.connected = true;
        this.emit('ready');
      });

      this.redis.on('reconnecting', () => {
        logger.info('Redis reconnecting...');
        this.emit('reconnecting');
      });

      // Try to connect
      await this.redis.connect();
      
      // Test connection
      await this.redis.ping();
      logger.info('Redis connection successful');
      
    } catch (error) {
      logger.warn('Failed to connect to Redis, using in-memory fallback:', error);
      this.connected = false;
    }
  }

  // Generic key management
  _key(type, id) {
    return `${this.config.keyPrefix}${type}:${id}`;
  }

  // Auction management
  async saveAuction(auctionId, auctionData) {
    const key = this._key('auction', auctionId);
    const data = JSON.stringify(auctionData);
    
    if (this.connected) {
      try {
        await this.redis.set(key, data);
        await this.redis.expire(key, this.config.auctionDataTTL);
        return true;
      } catch (error) {
        logger.error('Redis save error:', error);
      }
    }
    
    // Fallback to memory
    this.memoryFallback.set(key, auctionData);
    return true;
  }

  async getAuction(auctionId) {
    const key = this._key('auction', auctionId);
    
    if (this.connected) {
      try {
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        logger.error('Redis get error:', error);
      }
    }
    
    // Fallback to memory
    return this.memoryFallback.get(key) || null;
  }

  async getAllAuctions() {
    if (this.connected) {
      try {
        const pattern = this._key('auction', '*');
        const keys = await this.redis.keys(pattern);
        
        if (keys.length === 0) return [];
        
        const pipeline = this.redis.pipeline();
        keys.forEach(key => pipeline.get(key));
        const results = await pipeline.exec();
        
        return results
          .filter(([err, data]) => !err && data)
          .map(([, data]) => JSON.parse(data));
      } catch (error) {
        logger.error('Redis getAllAuctions error:', error);
      }
    }
    
    // Fallback to memory
    const auctions = [];
    const pattern = this._key('auction', '');
    for (const [key, value] of this.memoryFallback) {
      if (key.startsWith(pattern)) {
        auctions.push(value);
      }
    }
    return auctions;
  }

  async removeAuction(auctionId) {
    const key = this._key('auction', auctionId);
    
    if (this.connected) {
      try {
        await this.redis.del(key);
      } catch (error) {
        logger.error('Redis delete error:', error);
      }
    }
    
    // Also remove from memory fallback
    this.memoryFallback.delete(key);
    return true;
  }

  // Cookie management
  async saveCookies(cookies) {
    const key = this._key('auth', 'cookies');
    
    try {
      // Encrypt cookies before storage
      const encryptedCookies = cryptoUtil.encrypt(cookies);
      
      if (this.connected) {
        try {
          await this.redis.set(key, encryptedCookies);
          await this.redis.expire(key, this.config.cookieTTL);
          return true;
        } catch (error) {
          logger.error('Redis save cookies error:', error);
        }
      }
      
      // Fallback to memory (still encrypted)
      this.memoryFallback.set(key, encryptedCookies);
      return true;
    } catch (error) {
      logger.error('Failed to encrypt cookies:', error.message);
      return false;
    }
  }

  async getCookies() {
    const key = this._key('auth', 'cookies');
    let encryptedCookies = null;
    
    if (this.connected) {
      try {
        encryptedCookies = await this.redis.get(key);
      } catch (error) {
        logger.error('Redis get cookies error:', error);
      }
    }
    
    // Fallback to memory if Redis failed or returned null
    if (!encryptedCookies) {
      encryptedCookies = this.memoryFallback.get(key) || null;
    }
    
    // Decrypt cookies before returning
    if (encryptedCookies) {
      try {
        return cryptoUtil.decrypt(encryptedCookies);
      } catch (error) {
        logger.error('Failed to decrypt cookies:', error.message);
        // If decryption fails, cookies may be from old unencrypted version
        // Return null to force re-authentication
        return null;
      }
    }
    
    return null;
  }

  // Bid history management
  async saveBidHistory(auctionId, bidData) {
    const key = this._key('bid_history', auctionId);
    const timestamp = Date.now();
    const entry = JSON.stringify({ ...bidData, timestamp });
    
    if (this.connected) {
      try {
        await this.redis.zadd(key, timestamp, entry);
        // Keep only last 100 bids
        await this.redis.zremrangebyrank(key, 0, -101);
        await this.redis.expire(key, 86400 * 7); // 7 days
        return true;
      } catch (error) {
        logger.error('Redis save bid history error:', error);
      }
    }
    
    return true;
  }

  async getBidHistory(auctionId, limit = 50) {
    const key = this._key('bid_history', auctionId);
    
    if (this.connected) {
      try {
        const entries = await this.redis.zrevrange(key, 0, limit - 1);
        return entries.map(entry => JSON.parse(entry));
      } catch (error) {
        logger.error('Redis get bid history error:', error);
      }
    }
    
    return [];
  }

  // System state
  async saveSystemState(state) {
    const key = this._key('system', 'state');
    const data = JSON.stringify(state);
    
    if (this.connected) {
      try {
        await this.redis.set(key, data);
        return true;
      } catch (error) {
        logger.error('Redis save system state error:', error);
      }
    }
    
    this.memoryFallback.set(key, state);
    return true;
  }

  async getSystemState() {
    const key = this._key('system', 'state');
    
    if (this.connected) {
      try {
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        logger.error('Redis get system state error:', error);
      }
    }
    
    return this.memoryFallback.get(key) || null;
  }

  // Settings management
  async getSettings() {
    const key = this._key('system', 'settings');
    
    if (this.connected) {
      try {
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : this.getDefaultSettings();
      } catch (error) {
        logger.error('Redis get settings error:', error);
      }
    }
    
    return this.memoryFallback.get(key) || this.getDefaultSettings();
  }

  async saveSettings(settings) {
    const key = this._key('system', 'settings');
    const data = JSON.stringify(settings);
    
    if (this.connected) {
      try {
        await this.redis.set(key, data);
        return true;
      } catch (error) {
        logger.error('Redis save settings error:', error);
      }
    }
    
    this.memoryFallback.set(key, settings);
    return true;
  }

  getDefaultSettings() {
    return {
      general: {
        defaultMaxBid: 100,
        defaultStrategy: 'increment',
        autoBidDefault: true
      },
      bidding: {
        snipeTiming: 10,
        bidBuffer: 0,
        retryAttempts: 3
      }
    };
  }

  // Cleanup
  async close() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.redis) {
      await this.redis.quit();
    }
  }

  // Manual reconnection method
  async reconnect() {
    if (this.connected) {
      logger.info('Redis already connected');
      return true;
    }

    try {
      logger.info('Attempting manual Redis reconnection');
      await this.redis.connect();
      return true;
    } catch (error) {
      logger.error('Manual reconnection failed:', error);
      return false;
    }
  }

  // Health check
  async isHealthy() {
    if (!this.connected) return false;
    
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }
}

module.exports = new StorageService();