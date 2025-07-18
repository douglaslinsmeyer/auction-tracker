/**
 * SSE Performance Tests
 * Tests SSE client performance under various load conditions
 */

// const { EventSource } = require('eventsource');
const EventEmitter = require('events');
const testCleanup = require('../utils/testCleanup');
const logger = require('../../src/utils/logger');

describe('SSE Performance Tests', () => {
  let mockEventSources;
  let MockEventSource;
  let sseClient;
  let storage;
  let eventEmitter;
  
  // Setup test cleanup hooks
  testCleanup.setupJestHooks();

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock EventSource with performance tracking
    mockEventSources = [];
    MockEventSource = jest.fn().mockImplementation((url, options) => {
      const eventSource = new EventEmitter();
      eventSource.url = url;
      eventSource.options = options;
      eventSource.readyState = 1; // OPEN
      eventSource.close = jest.fn(() => {
        eventSource.readyState = 2; // CLOSED
      });
      eventSource.addEventListener = jest.fn((event, handler) => {
        eventSource.on(event, handler);
      });

      mockEventSources.push(eventSource);

      // Simulate connection after next tick
      process.nextTick(() => {
        if (eventSource.onopen) {
          eventSource.onopen();
        }
      });

      return eventSource;
    });

    jest.doMock('eventsource', () => ({
      EventSource: MockEventSource
    }));

    // Mock storage
    storage = {
      hset: jest.fn().mockResolvedValue(true),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true)
    };

    // Mock event emitter
    eventEmitter = new EventEmitter();

    // Mock features
    jest.doMock('../../src/config/features', () => ({
      isEnabled: jest.fn().mockReturnValue(true)
    }));

    // Create SSE client instance
    const SSEClient = require('../../src/services/sseClient').constructor;
    sseClient = new SSEClient(storage, eventEmitter);
    sseClient.initialize();
  });

  afterEach(() => {
    if (sseClient) {
      sseClient.disconnectAll();
    }
    jest.restoreAllMocks();
  });

  describe('High-Frequency Event Handling', () => {
    test('should handle rapid bid updates without memory leaks', async () => {
      const productId = '12345';
      const auctionId = 'auction_12345';

      // Track performance metrics
      const startMemory = process.memoryUsage();
      const startTime = process.hrtime.bigint();
      const eventsProcessed = [];

      // Set up event tracking
      eventEmitter.on('auction:update', (data) => {
        eventsProcessed.push({
          timestamp: process.hrtime.bigint(),
          data
        });
      });

      await sseClient.connectToAuction(productId, auctionId);

      // Simulate 100 rapid bid updates
      const eventSource = mockEventSources[0];
      const bidUpdates = [];

      for (let i = 0; i < 100; i++) {
        const bidData = {
          currentBid: 100 + i,
          bidCount: i + 1,
          lastBidder: `user${i}`,
          timestamp: new Date().toISOString()
        };
        bidUpdates.push(bidData);

        // Simulate event with minimal delay using tracked timer
        testCleanup.setTimeout(() => {
          eventSource.emit(`ch_product_bids:${productId}`, {
            data: JSON.stringify(bidData)
          });
        }, i * 10); // 10ms between events = 100 events/second
      }

      // Wait for all events to process using tracked timer
      await new Promise(resolve => testCleanup.setTimeout(resolve, 2000));

      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage();
      const processingTime = Number(endTime - startTime) / 1000000; // Convert to ms

      // Performance assertions
      expect(eventsProcessed.length).toBe(100);
      expect(processingTime).toBeLessThan(5000); // Should process within 5 seconds

      // Memory usage should not increase dramatically
      const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase

      // Calculate average processing time per event
      const avgProcessingTime = processingTime / 100;
      expect(avgProcessingTime).toBeLessThan(50); // Less than 50ms per event

      logger.debug('Performance Metrics', {
        totalEvents: eventsProcessed.length,
        totalTime: `${processingTime.toFixed(2)}ms`,
        avgPerEvent: `${avgProcessingTime.toFixed(2)}ms`,
        memoryIncrease: `${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`
      });
    });

    test('should handle multiple concurrent SSE connections', async () => {
      const connections = [];
      const startTime = process.hrtime.bigint();

      // Create 10 concurrent connections
      for (let i = 0; i < 10; i++) {
        const productId = `product_${i}`;
        const auctionId = `auction_${i}`;
        connections.push({ productId, auctionId });
        await sseClient.connectToAuction(productId, auctionId);
      }

      expect(mockEventSources.length).toBe(10);
      expect(sseClient.connections.size).toBe(10);

      // Simulate events on all connections simultaneously
      const eventsReceived = [];
      eventEmitter.on('auction:update', (data) => {
        eventsReceived.push(data);
      });

      // Send 5 events to each connection
      for (let i = 0; i < 10; i++) {
        const eventSource = mockEventSources[i];
        const productId = `product_${i}`;

        for (let j = 0; j < 5; j++) {
          setTimeout(() => {
            eventSource.emit(`ch_product_bids:${productId}`, {
              data: JSON.stringify({
                currentBid: 100 + j,
                bidCount: j + 1,
                lastBidder: `user${j}`
              })
            });
          }, j * 100); // 100ms between events per connection
        }
      }

      // Wait for all events
      await new Promise(resolve => setTimeout(resolve, 1000));

      const endTime = process.hrtime.bigint();
      const totalTime = Number(endTime - startTime) / 1000000;

      expect(eventsReceived.length).toBe(50); // 10 connections × 5 events
      expect(totalTime).toBeLessThan(2000); // Should complete within 2 seconds

      // Cleanup
      sseClient.disconnectAll();
      expect(sseClient.connections.size).toBe(0);
    });

    test('should handle connection failures gracefully under load', async () => {
      const productId = '12345';
      const auctionId = 'auction_12345';
      const errorEvents = [];

      eventEmitter.on('sse:error', (error) => {
        errorEvents.push(error);
      });

      await sseClient.connectToAuction(productId, auctionId);
      const eventSource = mockEventSources[0];

      // Simulate connection failure during high load
      setTimeout(() => {
        eventSource.readyState = 2; // CLOSED
        if (eventSource.onerror) {
          eventSource.onerror(new Error('Connection lost'));
        }
      }, 100);

      // Continue sending events after failure
      for (let i = 0; i < 10; i++) {
        setTimeout(() => {
          try {
            eventSource.emit(`ch_product_bids:${productId}`, {
              data: JSON.stringify({
                currentBid: 100 + i,
                bidCount: i + 1,
                lastBidder: `user${i}`
              })
            });
          } catch (error) {
            // Expected to fail after connection closed
          }
        }, 150 + (i * 50));
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should have received error events
      expect(errorEvents.length).toBeGreaterThan(0);
      expect(errorEvents[0].productId).toBe(productId);
    });
  });

  describe('Resource Management', () => {
    test('should properly clean up resources on disconnection', async () => {
      const productIds = ['prod1', 'prod2', 'prod3'];
      const auctionIds = ['auction1', 'auction2', 'auction3'];

      // Create multiple connections
      for (let i = 0; i < 3; i++) {
        await sseClient.connectToAuction(productIds[i], auctionIds[i]);
      }

      expect(sseClient.connections.size).toBe(3);
      expect(mockEventSources.length).toBe(3);

      // Disconnect specific connection
      sseClient.disconnect(productIds[0]);
      expect(sseClient.connections.size).toBe(2);
      expect(mockEventSources[0].close).toHaveBeenCalled();

      // Disconnect all
      sseClient.disconnectAll();
      expect(sseClient.connections.size).toBe(0);

      // Verify all connections were closed
      mockEventSources.forEach(es => {
        expect(es.close).toHaveBeenCalled();
      });
    });

    test('should handle rapid connect/disconnect cycles', async () => {
      const productId = '12345';
      const auctionId = 'auction_12345';

      // Rapid connect/disconnect cycles
      for (let i = 0; i < 20; i++) {
        await sseClient.connectToAuction(productId, auctionId);
        expect(sseClient.connections.has(productId)).toBe(true);

        sseClient.disconnect(productId);
        expect(sseClient.connections.has(productId)).toBe(false);
      }

      // Should handle gracefully without memory leaks
      expect(sseClient.connections.size).toBe(0);
      expect(mockEventSources.length).toBe(20); // One per connection attempt
    });
  });

  describe('Event Processing Latency', () => {
    test('should process events with minimal latency', async () => {
      const productId = '12345';
      const auctionId = 'auction_12345';
      const latencies = [];

      eventEmitter.on('auction:update', (data) => {
        const receiveTime = Date.now();
        // Extract timestamp from event data
        const eventTimestamp = data.data && data.data.timestamp ? parseInt(data.data.timestamp, 10) : receiveTime;
        const latency = receiveTime - eventTimestamp;
        latencies.push(Math.abs(latency)); // Ensure positive latency
      });

      await sseClient.connectToAuction(productId, auctionId);
      const eventSource = mockEventSources[0];

      // Send 10 events with precise timing
      for (let i = 0; i < 10; i++) {
        const sendTime = Date.now();
        eventSource.emit(`ch_product_bids:${productId}`, {
          data: JSON.stringify({
            currentBid: 100 + i,
            bidCount: i + 1,
            lastBidder: `user${i}`,
            timestamp: sendTime
          })
        });

        // Small delay between events
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(latencies.length).toBe(10);

      // Calculate average latency
      const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);

      // Latency should be minimal (under 10ms average)
      expect(avgLatency).toBeLessThan(10);
      expect(maxLatency).toBeLessThan(50);

      console.log(`Latency Metrics:
- Average: ${avgLatency.toFixed(2)}ms
- Maximum: ${maxLatency.toFixed(2)}ms
- Samples: ${latencies.length}`);
    });
  });
});