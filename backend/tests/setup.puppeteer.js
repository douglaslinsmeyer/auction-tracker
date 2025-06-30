// Setup file for Puppeteer tests
require('dotenv').config();

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.ENABLE_TEST_LOGS = 'false';

// Import logger to ensure proper configuration
const logger = require('../src/utils/logger');

// Set longer timeout for Puppeteer tests
jest.setTimeout(60000);

// Global error handlers for better debugging
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

beforeAll(async () => {
  // Any global setup needed before Puppeteer tests
  logger.info('Starting Puppeteer tests...');
});

afterAll(async () => {
  // Cleanup after all tests
  logger.info('Puppeteer tests completed.');
});