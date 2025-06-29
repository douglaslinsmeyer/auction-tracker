/**
 * Test Redis Configuration
 * Provides Redis setup for testing with proper cleanup
 */

const redis = require('redis');
const RedisMock = require('redis-mock');

class TestRedis {
  constructor() {
    this.client = null;
    this.useMock = process.env.USE_REAL_REDIS !== 'true';
  }

  /**
   * Initialize test Redis client
   * @param {Object} options - Redis options
   */
  async initialize(options = {}) {
    if (this.useMock) {
      // Use redis-mock for tests
      this.client = RedisMock.createClient();
      console.log('Using mock Redis for tests');
    } else {
      // Use real Redis with test database
      this.client = redis.createClient({
        ...options,
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        db: process.env.REDIS_TEST_DB || 15, // Use database 15 for tests
        password: process.env.REDIS_PASSWORD
      });

      await this.client.connect();
      console.log('Using real Redis for tests (database 15)');
    }

    // Clear test database
    await this.flushAll();
    
    return this.client;
  }

  /**
   * Get the Redis client
   */
  getClient() {
    if (!this.client) {
      throw new Error('Redis not initialized. Call initialize() first.');
    }
    return this.client;
  }

  /**
   * Clear all data in test database
   */
  async flushAll() {
    if (this.useMock) {
      // redis-mock uses callback style
      return new Promise((resolve, reject) => {
        this.client.flushall((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } else {
      // Real Redis client uses promises
      await this.client.flushAll();
    }
  }

  /**
   * Set a value
   * @param {string} key
   * @param {*} value
   * @param {number} ttl - Time to live in seconds
   */
  async set(key, value, ttl) {
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
    
    if (this.useMock) {
      return new Promise((resolve, reject) => {
        if (ttl) {
          this.client.setex(key, ttl, stringValue, (err) => {
            if (err) reject(err);
            else resolve();
          });
        } else {
          this.client.set(key, stringValue, (err) => {
            if (err) reject(err);
            else resolve();
          });
        }
      });
    } else {
      if (ttl) {
        await this.client.setEx(key, ttl, stringValue);
      } else {
        await this.client.set(key, stringValue);
      }
    }
  }

  /**
   * Get a value
   * @param {string} key
   * @returns {Promise<*>}
   */
  async get(key) {
    if (this.useMock) {
      return new Promise((resolve, reject) => {
        this.client.get(key, (err, value) => {
          if (err) reject(err);
          else {
            try {
              resolve(value ? JSON.parse(value) : null);
            } catch {
              resolve(value);
            }
          }
        });
      });
    } else {
      const value = await this.client.get(key);
      try {
        return value ? JSON.parse(value) : null;
      } catch {
        return value;
      }
    }
  }

  /**
   * Delete a key
   * @param {string} key
   */
  async del(key) {
    if (this.useMock) {
      return new Promise((resolve, reject) => {
        this.client.del(key, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } else {
      await this.client.del(key);
    }
  }

  /**
   * Check if key exists
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    if (this.useMock) {
      return new Promise((resolve, reject) => {
        this.client.exists(key, (err, exists) => {
          if (err) reject(err);
          else resolve(exists === 1);
        });
      });
    } else {
      const exists = await this.client.exists(key);
      return exists === 1;
    }
  }

  /**
   * Get all keys matching pattern
   * @param {string} pattern
   * @returns {Promise<string[]>}
   */
  async keys(pattern) {
    if (this.useMock) {
      return new Promise((resolve, reject) => {
        this.client.keys(pattern, (err, keys) => {
          if (err) reject(err);
          else resolve(keys);
        });
      });
    } else {
      return await this.client.keys(pattern);
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    if (this.client) {
      if (this.useMock) {
        // redis-mock doesn't need explicit close
        this.client = null;
      } else {
        await this.client.quit();
        this.client = null;
      }
    }
  }

  /**
   * Create a test storage instance that uses this Redis
   */
  createTestStorage() {
    const Storage = require('../../src/services/storage');
    const storage = Object.create(Storage);
    
    // Override the Redis client
    storage.redis = this.client;
    storage.connected = true;
    storage.initialized = true;
    
    return storage;
  }
}

// Export singleton instance
module.exports = new TestRedis();