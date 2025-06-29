// E2E Test Setup
// Configure Puppeteer for end-to-end testing

beforeAll(async () => {
  // Set longer timeout for E2E tests
  jest.setTimeout(60000);
});

afterAll(async () => {
  // Clean up any resources if needed
});