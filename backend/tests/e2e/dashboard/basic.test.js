const puppeteer = require('puppeteer');

describe('Backend API E2E Tests', () => {
  let browser;
  let page;

  beforeAll(async () => {
    // Launch browser in headless mode for CI
    browser = await puppeteer.launch({
      headless: process.env.HEADLESS === 'true' ? 'new' : false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  test('Backend API endpoint responds', async () => {
    const response = await page.goto('http://localhost:3000/api/status', { waitUntil: 'networkidle0' });

    expect(response.status()).toBe(200);

    const jsonResponse = await response.json();
    expect(jsonResponse).toHaveProperty('status');
    expect(jsonResponse.status).toBe('healthy');
  }, 30000);

  test('API documentation endpoint responds', async () => {
    const response = await page.goto('http://localhost:3000/api-docs', { waitUntil: 'networkidle0' });

    expect(response.status()).toBe(200);

    // Check if Swagger UI loaded
    const title = await page.title();
    expect(title).toMatch(/swagger|api/i);
  }, 30000);

  test('Backend API endpoints are accessible', async () => {
    // Test health endpoint
    const healthResponse = await page.goto('http://localhost:3000/api/health', { waitUntil: 'networkidle0' });
    expect(healthResponse.status()).toBe(200);

    // Test auctions endpoint (should require auth but still respond)
    const auctionsResponse = await page.goto('http://localhost:3000/api/auctions', { waitUntil: 'networkidle0' });
    expect([200, 401, 403]).toContain(auctionsResponse.status());
  }, 30000);

  test('API authentication works correctly', async () => {
    // Test without auth token (should fail)
    const unauthorizedResponse = await page.goto('http://localhost:3000/api/auctions', { waitUntil: 'networkidle0' });
    expect([401, 403]).toContain(unauthorizedResponse.status());

    // Test with auth token
    await page.setExtraHTTPHeaders({
      'Authorization': 'test-auth-token'
    });

    const authorizedResponse = await page.goto('http://localhost:3000/api/auctions', { waitUntil: 'networkidle0' });
    expect(authorizedResponse.status()).toBe(200);
  }, 30000);

  test('Backend serves static files', async () => {
    // Test if backend serves any static dashboard files
    const response = await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

    // Should either serve a dashboard or return a proper status
    expect([200, 404]).toContain(response.status());

    if (response.status() === 200) {
      const content = await page.content();
      expect(content.length).toBeGreaterThan(0);
    }
  }, 30000);
});