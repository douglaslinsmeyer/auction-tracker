/**
 * Cucumber Hooks
 * Setup and teardown for BDD tests
 */

const { Before, After, BeforeAll, AfterAll } = require('@cucumber/cucumber');
const RedisMock = require('../../__mocks__/ioredis');
const storage = require('../../../src/services/storage');
const auctionMonitor = require('../../../src/services/auctionMonitor');
const testRedis = require('../../__support__/testRedis');

// Global setup before all tests
BeforeAll(function () {
  // Set default auth token for tests if not provided
  if (!process.env.AUTH_TOKEN) {
    process.env.AUTH_TOKEN = 'test-auth-token';
  }

  // Create a mock Redis instance
  const mockRedis = new RedisMock();

  // Override storage Redis client with mock instance
  storage.redis = mockRedis;
  storage.connected = true;
  storage.initialized = true;

  // Override storage.initialize to prevent real Redis connection
  storage.initialize = async function () {
    // Already initialized with mock Redis

  };
});

// Setup before each scenario
Before(async function () {
  // Clear Redis data
  await storage.redis.flushall();

  // Clear auction monitor state
  auctionMonitor.monitoredAuctions.clear();
  auctionMonitor.pollingIntervals.clear();

  // Start test server
  await this.startServer();
});

// Cleanup after each scenario
After(async function () {
  // Stop test server
  await this.stopServer();

  // Restore any stubs
  this.restoreStubs();

  // Clear auction monitor
  auctionMonitor.shutdown();
});

// Global cleanup after all tests
AfterAll(async function () {
  // Close Redis connection
  if (storage.redis && storage.redis.quit) {
    await storage.redis.quit();
  }
});

// Tagged hooks for specific scenarios
Before('@websocket', function () {
  // Additional setup for WebSocket tests
  this.wsConnections = [];
});

After('@websocket', function () {
  // Close all WebSocket connections
  for (const ws of this.wsConnections) {
    if (ws && ws.readyState === 1) { // OPEN
      ws.close();
    }
  }
});

Before('@redis', async function () {
  // Ensure Redis is connected for Redis-specific tests
  if (!testRedis.client) {
    await testRedis.initialize();
  }
});

Before('@mock-api', function () {
  // Setup mocks for external API calls
  const nellisApi = require('../../src/services/nellisApi');

  this.stub(nellisApi, 'getAuctionData', (auctionId) => {
    return this.createMockAuction({ id: auctionId });
  });

  this.stub(nellisApi, 'placeBid', (_auctionId, amount) => {
    return {
      success: true,
      data: {
        message: 'Bid placed successfully',
        amount: amount
      }
    };
  });
});

// Hook for handling failures
After(function (scenario) {
  if (scenario.result.status === 'FAILED') {
    // Log additional debugging information
    console.error('Scenario failed:', scenario.pickle.name);
    if (this.lastError) {
      console.error('Last error:', this.lastError);
    }
    if (this.lastResponse) {
      console.error('Last response status:', this.lastResponse.status);
      console.error('Last response data:', this.lastResponse.data);
    }
  }
});