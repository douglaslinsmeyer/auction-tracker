module.exports = {
  testEnvironment: 'node',
  testTimeout: 10000,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js'
  ],
  coverageDirectory: 'coverage',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  verbose: true,
  forceExit: true,
  detectOpenHandles: false
};