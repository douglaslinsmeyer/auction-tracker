const Redis = require('ioredis');
const EventEmitter = require('events');

class StorageService extends EventEmitter {
  constructor() {
    super();
    this.redis = null;
    this.connected = false;
    this.memoryFallback = new Map();
    this.config = {
      keyPrefix: 'nellis:',
      cookieTTL: 86400, // 24 hours in seconds
      auctionDataTTL: 3600, // 1 hour for auction data cache
    };
  }

  async initialize() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      console.log('Connecting to Redis:', redisUrl);
      
      this.redis = new Redis(redisUrl, {
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          console.log(`Redis connection retry ${times}, delay ${delay}ms`);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        enableOfflineQueue: true,
      });

      this.redis.on('connect', () => {
        console.log('Redis connected');
        this.connected = true;
        this.emit('connected');
      });

      this.redis.on('error', (err) => {
        console.error('Redis error:', err);
        this.connected = false;
        this.emit('error', err);
      });

      this.redis.on('close', () => {
        console.log('Redis connection closed');
        this.connected = false;
        this.emit('disconnected');
      });

      // Test connection
      await this.redis.ping();
      console.log('Redis connection successful');
      
    } catch (error) {
      console.error('Failed to connect to Redis, using in-memory fallback:', error);
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
        console.error('Redis save error:', error);
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
        console.error('Redis get error:', error);
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
        console.error('Redis getAllAuctions error:', error);
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
        console.error('Redis delete error:', error);
      }
    }
    
    // Also remove from memory fallback
    this.memoryFallback.delete(key);
    return true;
  }

  // Cookie management
  async saveCookies(cookies) {
    const key = this._key('auth', 'cookies');
    
    if (this.connected) {
      try {
        await this.redis.set(key, cookies);
        await this.redis.expire(key, this.config.cookieTTL);
        return true;
      } catch (error) {
        console.error('Redis save cookies error:', error);
      }
    }
    
    // Fallback to memory
    this.memoryFallback.set(key, cookies);
    return true;
  }

  async getCookies() {
    const key = this._key('auth', 'cookies');
    
    if (this.connected) {
      try {
        return await this.redis.get(key);
      } catch (error) {
        console.error('Redis get cookies error:', error);
      }
    }
    
    // Fallback to memory
    return this.memoryFallback.get(key) || null;
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
        console.error('Redis save bid history error:', error);
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
        console.error('Redis get bid history error:', error);
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
        console.error('Redis save system state error:', error);
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
        console.error('Redis get system state error:', error);
      }
    }
    
    return this.memoryFallback.get(key) || null;
  }

  // Cleanup
  async close() {
    if (this.redis) {
      await this.redis.quit();
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