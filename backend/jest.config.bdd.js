module.exports = {
  displayName: 'BDD Tests',
  testMatch: ['<rootDir>/tests/bdd/step-definitions/**/*.steps.js'],
  testEnvironment: 'node',
  coverageDirectory: 'coverage/bdd',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/__support__/setup.js'],
  testTimeout: 30000,
  verbose: true,
  silent: true, // Suppress console output during tests
  // Transform options for jest-cucumber
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  }
};