/**
 * BDD Test Setup
 * Configures the test environment for Behavior-Driven Development tests
 */

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');

// Configure Chai
chai.use(chaiAsPromised.default || chaiAsPromised);
global.expect = chai.expect;
global.should = chai.should();
global.sinon = sinon;

// Set test environment
process.env.NODE_ENV = 'test';
process.env.AUTH_TOKEN = 'test-auth-token';
process.env.ENCRYPTION_SECRET = 'test-encryption-secret-32-characters!';
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests
process.env.ENABLE_TEST_LOGS = 'false'; // Ensure Winston logger is silent

// Set default test timeout
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  /**
   * Wait for a condition to be true
   * @param {Function} condition - Function that returns boolean
   * @param {number} timeout - Maximum wait time in ms
   * @param {number} interval - Check interval in ms
   */
  async waitFor(condition, timeout = 5000, interval = 100) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error('Timeout waiting for condition');
  },

  /**
   * Create a mock auction object
   * @param {Object} overrides - Properties to override
   */
  createMockAuction(overrides = {}) {
    return {
      id: '12345',
      title: 'Test Auction Item',
      currentBid: 50,
      nextBid: 55,
      timeRemaining: 300,
      isWinning: false,
      isClosed: false,
      bidCount: 10,
      ...overrides
    };
  },

  /**
   * Create a mock WebSocket client
   */
  createMockWebSocketClient() {
    return {
      send: sinon.stub(),
      close: sinon.stub(),
      on: sinon.stub(),
      readyState: 1, // OPEN
      OPEN: 1,
      CLOSED: 3
    };
  },

  /**
   * Clean up all sinon stubs/spies
   */
  cleanup() {
    sinon.restore();
  }
};

// Setup is handled by Cucumber hooks in hooks.js

// Import logger to ensure proper configuration
const logger = require('../../src/utils/logger');

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  // Use logger instead of console.error, but only log errors in test mode
  logger.error('Unhandled promise rejection in test:', err);
  process.exit(1);
});