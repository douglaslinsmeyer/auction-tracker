// E2E Test Setup
const path = require('path');
const fs = require('fs').promises;

// Increase test timeout for E2E tests
jest.setTimeout(60000);

// Setup global test utilities
global.testHelpers = {
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  waitForCondition: async (condition, timeout = 10000, interval = 100) => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error('Condition not met within timeout');
  }
};

// Ensure required directories exist
beforeAll(async () => {
  const extensionPath = path.join(__dirname, '../../../nellis-auction-helper');

  try {
    await fs.access(extensionPath);
    console.log('✓ Chrome extension found at:', extensionPath);
  } catch (error) {
    console.warn('⚠ Chrome extension not found at:', extensionPath);
    console.warn('  Some tests may fail. Ensure nellis-auction-helper is in the parent directory.');
  }
});

// Cleanup any lingering processes
afterAll(async () => {
  // Give time for browsers to close properly
  await new Promise(resolve => setTimeout(resolve, 2000));
});