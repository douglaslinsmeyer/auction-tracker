// E2E test setup
process.env.NODE_ENV = 'test';

// Increase timeout for E2E tests
jest.setTimeout(60000);

// Handle test server errors
process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection in E2E test:', err);
});