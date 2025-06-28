// Test environment setup
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.LOG_LEVEL = 'error';
process.env.REDIS_URL = 'redis://localhost:6379';

// Increase test timeout for integration tests
jest.setTimeout(30000);

// Mock winston to reduce noise in tests
jest.mock('winston', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    log: jest.fn()
  };
  
  return {
    createLogger: jest.fn(() => mockLogger),
    format: {
      json: jest.fn(),
      simple: jest.fn(),
      combine: jest.fn(),
      timestamp: jest.fn(),
      printf: jest.fn()
    },
    transports: {
      File: jest.fn(),
      Console: jest.fn()
    }
  };
});

// Global test utilities
global.testUtils = {
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  waitForCondition: async (condition, timeout = 5000, interval = 100) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await condition()) return true;
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error('Condition not met within timeout');
  }
};