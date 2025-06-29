module.exports = {
  displayName: 'extension-e2e',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/e2e/extension/**/*.test.js'],
  testTimeout: 60000, // 60 seconds for E2E tests
  setupFilesAfterEnv: ['<rootDir>/tests/e2e/setup.js'],
  verbose: true,
  bail: false, // Don't stop on first failure
  maxWorkers: 1, // Run tests sequentially to avoid browser conflicts
  globals: {
    __EXTENSION_PATH__: '../nellis-auction-helper'
  }
};