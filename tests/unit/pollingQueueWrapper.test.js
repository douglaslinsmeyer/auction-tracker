/**
 * Unit tests for PollingQueueWrapper
 */

const PollingQueueWrapper = require('../../src/services/classes/PollingQueueWrapper');
const featureFlags = require('../../src/config/features');

// Mock dependencies
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

jest.mock('../../src/config/features');

describe('PollingQueueWrapper', () => {
  let wrapper;
  let mockStorage;
  let mockNellisApi;
  let mockLogger;
  let mockSingleton;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Mock storage
    mockStorage = {
      connected: true,
      saveAuction: jest.fn(),
      removeAuction: jest.fn()
    };
    
    // Mock nellis API
    mockNellisApi = {
      getAuctionData: jest.fn()
    };
    
    // Mock logger
    mockLogger = require('../../src/utils/logger');
    
    // Create wrapper instance
    wrapper = new PollingQueueWrapper(mockStorage, mockNellisApi, mockLogger);
    
    // Mock the singleton inside wrapper
    mockSingleton = {
      monitoredAuctions: new Map(),
      updateAuction: jest.fn(),
      pollingIntervals: new Map(),
      defaultPollingInterval: 6000,
      addAuction: jest.fn().mockResolvedValue(true),
      removeAuction: jest.fn().mockResolvedValue(true),
      initialize: jest.fn().mockResolvedValue(true),
      shutdown: jest.fn()
    };
    wrapper._singleton = mockSingleton;
    
    // Default feature flag behavior
    featureFlags.isEnabled.mockReturnValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    if (wrapper._queueWorker) {
      clearInterval(wrapper._queueWorker);
    }
  });

  describe('Priority Queue', () => {
    it('should enqueue items in priority order', () => {
      const queue = wrapper._queue;
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);
      
      queue.enqueue('auction1', 100, 5000);
      queue.enqueue('auction2', 50, 3000);  // Different intervals to ensure different nextPoll times
      queue.enqueue('auction3', 200, 10000);
      
      expect(queue.size()).toBe(3);
      expect(queue.peek().auctionId).toBe('auction2'); // Lowest nextPoll time (now + 3000)
      
      Date.now.mockRestore();
    });

    it('should dequeue items in order', () => {
      const queue = wrapper._queue;
      
      queue.enqueue('auction1', 100, 5000);
      queue.enqueue('auction2', 50, 5000);
      
      const first = queue.dequeue();
      expect(first.auctionId).toBe('auction1');
      expect(queue.size()).toBe(1);
    });

    it('should remove specific auction from queue', () => {
      const queue = wrapper._queue;
      
      queue.enqueue('auction1', 100, 5000);
      queue.enqueue('auction2', 50, 5000);
      queue.enqueue('auction3', 200, 5000);
      
      const removed = queue.remove('auction2');
      expect(removed).toBe(true);
      expect(queue.size()).toBe(2);
      expect(queue.getAllItems().find(i => i.auctionId === 'auction2')).toBeUndefined();
    });

    it('should get due items based on time', () => {
      const queue = wrapper._queue;
      const now = Date.now();
      
      // Mock Date.now for consistent testing
      jest.spyOn(Date, 'now').mockReturnValue(now);
      
      queue.enqueue('auction1', 100, 1000); // Due in 1 second
      queue.enqueue('auction2', 50, 5000);  // Due in 5 seconds
      
      // No items due yet
      let dueItems = queue.getDueItems(now);
      expect(dueItems.length).toBe(0);
      
      // Advance time by 2 seconds
      const futureTime = now + 2000;
      dueItems = queue.getDueItems(futureTime);
      expect(dueItems.length).toBe(1);
      expect(dueItems[0].auctionId).toBe('auction1');
      
      Date.now.mockRestore();
    });
  });

  describe('Feature Flag Integration', () => {
    it('should not start queue worker when feature disabled', async () => {
      featureFlags.isEnabled.mockReturnValue(false);
      
      await wrapper.initialize({}, jest.fn());
      
      expect(wrapper._queueWorker).toBeNull();
      expect(mockLogger.info).not.toHaveBeenCalledWith('Polling queue initialized and worker started');
    });

    it('should start queue worker when feature enabled', async () => {
      featureFlags.isEnabled.mockReturnValue(true);
      
      await wrapper.initialize({}, jest.fn());
      
      expect(wrapper._queueWorker).not.toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith('Polling queue initialized and worker started');
    });
  });

  describe('Auction Management', () => {
    beforeEach(() => {
      featureFlags.isEnabled.mockReturnValue(true);
    });

    it('should add auction to queue when feature enabled', async () => {
      const auctionData = {
        data: {
          timeRemaining: 120,
          isWinning: true
        }
      };
      mockSingleton.monitoredAuctions.set('auction1', auctionData);
      
      const result = await wrapper.addAuction('auction1', {}, {});
      
      expect(result).toBe(true);
      expect(wrapper._queue.size()).toBe(1);
      expect(wrapper._metrics.queueSize).toBe(1);
    });

    it('should calculate priority based on time and winning status', () => {
      const winningAuction = {
        data: {
          timeRemaining: 100,
          isWinning: true
        }
      };
      
      const losingAuction = {
        data: {
          timeRemaining: 100,
          isWinning: false
        }
      };
      
      const winningPriority = wrapper._calculatePriority(winningAuction);
      const losingPriority = wrapper._calculatePriority(losingAuction);
      
      expect(losingPriority).toBeLessThan(winningPriority); // Lower number = higher priority
    });

    it('should calculate interval based on time remaining', () => {
      const testCases = [
        { timeRemaining: 25, expectedInterval: 2000 },   // < 30 seconds
        { timeRemaining: 45, expectedInterval: 3000 },   // < 60 seconds
        { timeRemaining: 200, expectedInterval: 5000 },  // < 300 seconds
        { timeRemaining: 500, expectedInterval: 10000 }, // < 600 seconds
        { timeRemaining: 1000, expectedInterval: 6000 }  // Default
      ];
      
      testCases.forEach(({ timeRemaining, expectedInterval }) => {
        const auction = { data: { timeRemaining } };
        const interval = wrapper._calculateInterval(auction);
        expect(interval).toBe(expectedInterval);
      });
    });

    it('should remove auction from queue', async () => {
      featureFlags.isEnabled.mockReturnValue(true);
      wrapper._queue.enqueue('auction1', 100, 5000);
      wrapper._metrics.queueSize = 1;
      
      const result = await wrapper.removeAuction('auction1');
      
      expect(result).toBe(true);
      expect(wrapper._queue.size()).toBe(0);
      expect(wrapper._metrics.queueSize).toBe(0);
    });

    it('should stop legacy polling when adding to queue', async () => {
      const mockInterval = setInterval(() => {}, 1000);
      mockSingleton.pollingIntervals.set('auction1', mockInterval);
      mockSingleton.monitoredAuctions.set('auction1', {
        data: { timeRemaining: 100, isWinning: true }
      });
      
      await wrapper.addAuction('auction1', {}, {});
      
      expect(mockSingleton.pollingIntervals.has('auction1')).toBe(false);
      clearInterval(mockInterval);
    });
  });

  describe('Queue Processing', () => {
    beforeEach(() => {
      featureFlags.isEnabled.mockReturnValue(true);
    });

    it('should process due items respecting rate limit', async () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);
      
      // Add items that are due
      wrapper._queue.enqueue('auction1', 100, 1000);
      wrapper._queue.enqueue('auction2', 100, 1000);
      wrapper._queue.items[0].nextPoll = now - 100; // Make it due
      wrapper._queue.items[1].nextPoll = now - 100; // Make it due
      
      // Set rate limit close to max
      wrapper._requestCount = 9;
      wrapper._maxRequestsPerSecond = 10;
      wrapper._requestCountReset = now - 500; // Half second ago
      
      await wrapper._processQueue();
      
      // Should process only one item due to rate limit
      expect(mockSingleton.updateAuction).toHaveBeenCalledTimes(1);
      expect(wrapper._requestCount).toBe(10);
      
      Date.now.mockRestore();
    });

    it('should reset rate limit counter after window', async () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);
      
      wrapper._requestCount = 10;
      wrapper._requestCountReset = now - 1500; // 1.5 seconds ago
      
      await wrapper._processQueue();
      
      expect(wrapper._requestCount).toBe(0);
      expect(wrapper._requestCountReset).toBe(now);
      
      Date.now.mockRestore();
    });

    it('should handle polling errors and adjust interval', async () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);
      
      mockSingleton.updateAuction.mockRejectedValue(new Error('API Error'));
      
      const item = {
        auctionId: 'auction1',
        priority: 100,
        interval: 5000,
        nextPoll: now - 100,
        lastPoll: now - 5100
      };
      
      await wrapper._pollAuction(item);
      
      expect(item.consecutiveErrors).toBe(1);
      expect(mockLogger.error).toHaveBeenCalled();
      expect(wrapper._metrics.errors).toBe(1);
      
      // Poll again to test interval adjustment
      await wrapper._pollAuction(item);
      expect(item.consecutiveErrors).toBe(2);
      expect(item.interval).toBe(10000); // Doubled
      
      Date.now.mockRestore();
    });

    it('should update metrics after successful poll', async () => {
      const startTime = Date.now();
      
      // First mock returns start time, subsequent calls return later time
      let callCount = 0;
      jest.spyOn(Date, 'now').mockImplementation(() => {
        if (callCount++ === 0) return startTime;
        return startTime + 50; // 50ms poll time
      });
      
      mockSingleton.updateAuction.mockResolvedValue(true);
      
      const item = {
        auctionId: 'auction1',
        priority: 100,
        interval: 5000
      };
      
      await wrapper._pollAuction(item);
      
      expect(wrapper._metrics.totalPolls).toBe(1);
      expect(wrapper._metrics.avgPollTime).toBe(50);
      expect(wrapper._metrics.errors).toBe(0);
      
      Date.now.mockRestore();
    });
  });

  describe('Runtime Control', () => {
    it('should update polling rate for queued auction', () => {
      featureFlags.isEnabled.mockReturnValue(true);
      
      wrapper._queue.enqueue('auction1', 100, 5000);
      wrapper.updatePollingRate('auction1', 3000);
      
      const item = wrapper._queue.getAllItems()[0];
      expect(item.interval).toBe(3000);
    });

    it('should fall back to legacy polling rate update when queue disabled', () => {
      featureFlags.isEnabled.mockReturnValue(false);
      mockSingleton.adjustPollingRate = jest.fn();
      
      wrapper.updatePollingRate('auction1', 3000);
      
      expect(mockSingleton.adjustPollingRate).toHaveBeenCalledWith('auction1', 3000);
    });

    it('should clean up queue worker on shutdown', () => {
      wrapper._queueWorker = setInterval(() => {}, 1000);
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      wrapper.shutdown();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(wrapper._queueWorker).toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith('Polling queue worker stopped');
    });
  });

  describe('Metrics Reporting', () => {
    it('should return comprehensive queue metrics', () => {
      featureFlags.isEnabled.mockReturnValue(true);
      
      wrapper._queue.enqueue('auction1', 100, 5000);
      wrapper._queue.enqueue('auction2', 200, 10000);
      wrapper._metrics = {
        totalPolls: 42,
        queueSize: 2,
        avgPollTime: 125.5,
        errors: 3
      };
      
      const metrics = wrapper.getQueueMetrics();
      
      expect(metrics.enabled).toBe(true);
      expect(metrics.totalPolls).toBe(42);
      expect(metrics.queueSize).toBe(2);
      expect(metrics.avgPollTime).toBe(125.5);
      expect(metrics.errors).toBe(3);
      expect(metrics.items).toHaveLength(2);
      expect(metrics.items[0]).toHaveProperty('auctionId');
      expect(metrics.items[0]).toHaveProperty('nextPoll');
      expect(metrics.items[0]).toHaveProperty('interval');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty queue gracefully', async () => {
      await wrapper._processQueue();
      expect(mockSingleton.updateAuction).not.toHaveBeenCalled();
    });

    it('should handle missing auction data', () => {
      const priority = wrapper._calculatePriority(null);
      expect(priority).toBe(1000);
      
      const interval = wrapper._calculateInterval(null);
      expect(interval).toBe(6000);
    });

    it('should handle queue errors without crashing', async () => {
      // Force an error by making getDueItems throw
      wrapper._queue.getDueItems = jest.fn(() => {
        throw new Error('Queue error');
      });
      
      await wrapper._processQueue();
      
      expect(mockLogger.error).toHaveBeenCalledWith('Error processing polling queue:', expect.any(Error));
      expect(wrapper._metrics.errors).toBe(1);
    });
  });
});