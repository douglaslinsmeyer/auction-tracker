// Setup file for Puppeteer tests
require('dotenv').config();

// Set longer timeout for Puppeteer tests
jest.setTimeout(60000);

// Global error handlers for better debugging
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

beforeAll(async () => {
  // Any global setup needed before Puppeteer tests
  console.log('Starting Puppeteer tests...');
});

afterAll(async () => {
  // Cleanup after all tests
  console.log('Puppeteer tests completed.');
});