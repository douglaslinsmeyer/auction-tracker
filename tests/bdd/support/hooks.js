/**
 * Cucumber Hooks
 * Setup and teardown for BDD tests
 */

const { Before, After, BeforeAll, AfterAll } = require('@cucumber/cucumber');
const testRedis = require('../../__support__/testRedis');
const storage = require('../../../src/services/storage');
const auctionMonitor = require('../../../src/services/auctionMonitor');

// Global setup before all tests
BeforeAll(async function() {
  // Initialize test Redis
  await testRedis.initialize();
  
  // Override storage Redis client with test instance
  storage.redis = testRedis.getClient();
  storage.connected = true;
  storage.initialized = true;
});

// Setup before each scenario
Before(async function() {
  // Clear Redis data
  await testRedis.flushAll();
  
  // Clear auction monitor state
  auctionMonitor.monitoredAuctions.clear();
  auctionMonitor.pollingIntervals.clear();
  
  // Start test server
  await this.startServer();
});

// Cleanup after each scenario
After(async function() {
  // Stop test server
  await this.stopServer();
  
  // Restore any stubs
  this.restoreStubs();
  
  // Clear auction monitor
  auctionMonitor.shutdown();
});

// Global cleanup after all tests
AfterAll(async function() {
  // Close Redis connection
  await testRedis.close();
});

// Tagged hooks for specific scenarios
Before('@websocket', async function() {
  // Additional setup for WebSocket tests
  this.wsConnections = [];
});

After('@websocket', async function() {
  // Close all WebSocket connections
  for (const ws of this.wsConnections) {
    if (ws && ws.readyState === 1) { // OPEN
      ws.close();
    }
  }
});

Before('@redis', async function() {
  // Ensure Redis is connected for Redis-specific tests
  if (!testRedis.client) {
    await testRedis.initialize();
  }
});

Before('@mock-api', async function() {
  // Setup mocks for external API calls
  const nellisApi = require('../../src/services/nellisApi');
  
  this.stub(nellisApi, 'getAuctionData', async (auctionId) => {
    return this.createMockAuction({ id: auctionId });
  });
  
  this.stub(nellisApi, 'placeBid', async (auctionId, amount) => {
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
After(function(scenario) {
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