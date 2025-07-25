module.exports = {
  // Base configuration
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/__support__/setup.js'],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  silent: true, // Suppress console output during tests
  
  // Use __mocks__ convention (Jest standard)
  moduleNameMapper: {
    '^ioredis$': '<rootDir>/tests/__mocks__/ioredis.js'
  },
  
  // Default timeout
  // testTimeout: 30000, // Moved to setupFilesAfterEnv
  
  // Projects for different test types
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.js']
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js']
    },
    {
      displayName: 'e2e',
      preset: 'jest-puppeteer',
      testMatch: ['<rootDir>/tests/e2e/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/e2e/setup.js']
    },
    {
      displayName: 'performance',
      testMatch: ['<rootDir>/tests/performance/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/__support__/setup.js', '<rootDir>/tests/performance/setup.js']
    }
  ],
  
  // Coverage settings
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js'
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};