module.exports = {
  preset: 'jest-puppeteer',
  testMatch: ['**/tests/e2e/**/*.test.js'],
  testTimeout: 60000,
  setupFilesAfterEnv: ['./tests/setup.puppeteer.js']
};