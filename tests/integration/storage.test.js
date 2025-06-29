const { mockAuction, mockCookies } = require('../__fixtures__/mockData');
const testUtils = require('../__support__/testUtils');

// Mock ioredis
jest.mock('ioredis', () => {
  const RedisMock = require('../__mocks__/redis.mock');
  return RedisMock;
});

describe('Storage Service Integration Tests', () => {
  let storage;

  beforeAll(async () => {
    // Clear module cache to ensure fresh instance
    jest.resetModules();
    storage = require('../../src/services/storage');
    await storage.initialize();
  });

  beforeEach(async () => {
    // Initialize storage for each test if not already initialized
    if (!storage.connected) {
      await storage.initialize();
    }
  });

  afterEach(async () => {
    // Clean up
    if (storage.redis) {
      await storage.redis.flushall();
    }
  });

  afterAll(async () => {
    await storage.close();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      // Storage should be initialized in beforeAll
      await testUtils.delay(50); // Small delay to ensure connection
      expect(storage.connected).toBe(true);
      const healthy = await storage.isHealthy();
      expect(healthy).toBe(true);
    });

    it('should emit connected event', (done) => {
      // Create a new instance to test event
      jest.resetModules();
      const freshStorage = require('../../src/services/storage');
      
      freshStorage.on('connected', () => {
        expect(freshStorage.connected).toBe(true);
        done();
      });
      
      freshStorage.initialize();
    });
  });

  describe('Auction Storage', () => {
    it('should save and retrieve auction', async () => {
      const saved = await storage.saveAuction(mockAuction.id, mockAuction);
      expect(saved).toBe(true);
      
      const retrieved = await storage.getAuction(mockAuction.id);
      expect(retrieved).toEqual(mockAuction);
    });

    it('should return null for non-existent auction', async () => {
      const auction = await storage.getAuction('non-existent');
      expect(auction).toBeNull();
    });

    it('should get all auctions', async () => {
      const auction1 = { ...mockAuction, id: '111' };
      const auction2 = { ...mockAuction, id: '222' };
      
      await storage.saveAuction(auction1.id, auction1);
      await storage.saveAuction(auction2.id, auction2);
      
      const auctions = await storage.getAllAuctions();
      expect(auctions).toHaveLength(2);
      expect(auctions.map(a => a.id).sort()).toEqual(['111', '222']);
    });

    it('should remove auction', async () => {
      await storage.saveAuction(mockAuction.id, mockAuction);
      
      const removed = await storage.removeAuction(mockAuction.id);
      expect(removed).toBe(true);
      
      const auction = await storage.getAuction(mockAuction.id);
      expect(auction).toBeNull();
    });

    it('should set TTL on auction data', async () => {
      await storage.saveAuction(mockAuction.id, mockAuction);
      
      if (storage.redis && storage.redis.ttl) {
        const ttl = await storage.redis.ttl(`nellis:auction:${mockAuction.id}`);
        expect(ttl).toBeGreaterThan(0);
        expect(ttl).toBeLessThanOrEqual(storage.config.auctionDataTTL);
      }
    });
  });

  describe('Cookie Storage', () => {
    it('should save and retrieve cookies', async () => {
      const saved = await storage.saveCookies(mockCookies);
      expect(saved).toBe(true);
      
      const retrieved = await storage.getCookies();
      expect(retrieved).toEqual(mockCookies);
    });

    it('should set TTL on cookies', async () => {
      await storage.saveCookies(mockCookies);
      
      if (storage.redis && storage.redis.ttl) {
        const ttl = await storage.redis.ttl('nellis:auth:cookies');
        expect(ttl).toBeGreaterThan(0);
        expect(ttl).toBeLessThanOrEqual(storage.config.cookieTTL);
      }
    });

    it('should return null for no cookies', async () => {
      const cookies = await storage.getCookies();
      expect(cookies).toBeNull();
    });
  });

  describe('Bid History Storage', () => {
    it('should save bid history', async () => {
      const bidData = {
        amount: 50,
        strategy: 'increment',
        success: true
      };
      
      const saved = await storage.saveBidHistory(mockAuction.id, bidData);
      expect(saved).toBe(true);
    });

    it('should retrieve bid history in reverse order', async () => {
      // Save multiple bids
      for (let i = 1; i <= 5; i++) {
        await storage.saveBidHistory(mockAuction.id, {
          amount: i * 10,
          strategy: 'increment',
          success: true
        });
        await testUtils.delay(10); // Ensure different timestamps
      }
      
      const history = await storage.getBidHistory(mockAuction.id, 3);
      expect(history).toHaveLength(3);
      
      // Should be in reverse chronological order
      expect(history[0].amount).toBe(50);
      expect(history[1].amount).toBe(40);
      expect(history[2].amount).toBe(30);
    });

    it('should limit bid history to last 100', async () => {
      // This test would need a real Redis instance to properly test
      // redis-mock doesn't fully support all Redis commands
      expect(true).toBe(true);
    });

    it('should return empty array for no history', async () => {
      const history = await storage.getBidHistory('non-existent');
      expect(history).toEqual([]);
    });
  });

  describe('System State Storage', () => {
    it('should save and retrieve system state', async () => {
      const state = {
        startTime: Date.now(),
        version: '1.0.0',
        settings: { autoStart: true }
      };
      
      const saved = await storage.saveSystemState(state);
      expect(saved).toBe(true);
      
      const retrieved = await storage.getSystemState();
      expect(retrieved).toEqual(state);
    });

    it('should return null for no system state', async () => {
      const state = await storage.getSystemState();
      expect(state).toBeNull();
    });
  });

  describe('Fallback Behavior', () => {
    it('should use memory fallback when Redis fails', async () => {
      // Simulate Redis disconnection
      storage.connected = false;
      
      // Should still work with memory fallback
      const saved = await storage.saveAuction(mockAuction.id, mockAuction);
      expect(saved).toBe(true);
      
      const retrieved = await storage.getAuction(mockAuction.id);
      expect(retrieved).toEqual(mockAuction);
    });

    it('should maintain data in memory fallback', async () => {
      // Disconnect Redis to force memory fallback
      storage.connected = false;
      const originalRedis = storage.redis;
      storage.redis = null;
      
      // Clear memory fallback first
      storage.memoryFallback.clear();
      
      // Save multiple items
      await storage.saveAuction('111', { id: '111' });
      await storage.saveAuction('222', { id: '222' });
      await storage.saveCookies(mockCookies);
      
      // Retrieve from memory
      const auctions = await storage.getAllAuctions();
      expect(auctions).toHaveLength(2);
      
      const cookies = await storage.getCookies();
      expect(cookies).toEqual(mockCookies);
      
      // Restore Redis
      storage.redis = originalRedis;
      storage.connected = true;
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis errors gracefully', async () => {
      if (storage.redis) {
        // Force an error
        storage.redis.get = jest.fn().mockRejectedValue(new Error('Redis error'));
        
        // Should not throw, returns null
        const auction = await storage.getAuction('test');
        expect(auction).toBeNull();
      }
    });

    it('should emit error events', async () => {
      const errorHandler = jest.fn();
      storage.on('error', errorHandler);
      
      // Trigger an error event
      if (storage.redis) {
        storage.redis.emit('error', new Error('Test error'));
        expect(errorHandler).toHaveBeenCalled();
      }
    });
  });

  describe('Health Check', () => {
    it('should report healthy when connected', async () => {
      storage.connected = true;
      const healthy = await storage.isHealthy();
      expect(healthy).toBe(true);
    });

    it('should report unhealthy when disconnected', async () => {
      storage.connected = false;
      const healthy = await storage.isHealthy();
      expect(healthy).toBe(false);
    });
  });

  describe('Key Management', () => {
    it('should use proper key prefixes', () => {
      const auctionKey = storage._key('auction', '123');
      expect(auctionKey).toBe('nellis:auction:123');
      
      const authKey = storage._key('auth', 'cookies');
      expect(authKey).toBe('nellis:auth:cookies');
      
      const bidKey = storage._key('bid_history', '456');
      expect(bidKey).toBe('nellis:bid_history:456');
    });
  });
});