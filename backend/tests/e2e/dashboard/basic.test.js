const puppeteer = require('puppeteer');

describe('Dashboard Basic E2E Tests', () => {
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
  
  test('Dashboard loads successfully', async () => {
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle0' });
    
    // Check page title
    const title = await page.title();
    expect(title).toContain('Auction Dashboard');
    
    // Check main elements exist
    const hasHeader = await page.$('header') !== null;
    const hasMainContent = await page.$('main') !== null;
    
    expect(hasHeader).toBe(true);
    expect(hasMainContent).toBe(true);
  }, 30000);
  
  test('Dashboard connects to backend', async () => {
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle0' });
    
    // Wait for WebSocket connection indicator
    await page.waitForSelector('.connection-status', { timeout: 10000 });
    
    // Check connection status
    const connectionStatus = await page.$eval('.connection-status', el => el.textContent);
    expect(connectionStatus).toMatch(/connected|online/i);
  }, 30000);
  
  test('Dashboard displays auction list', async () => {
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle0' });
    
    // Wait for auctions section
    await page.waitForSelector('.auctions-container', { timeout: 10000 });
    
    // Check if auction list is rendered
    const hasAuctionList = await page.$('.auction-list') !== null;
    expect(hasAuctionList).toBe(true);
  }, 30000);
  
  test('Dashboard handles authentication', async () => {
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle0' });
    
    // Check for auth elements
    const hasAuthSection = await page.$('.auth-section, #authToken, .login-form') !== null;
    expect(hasAuthSection).toBe(true);
    
    // If auth token input exists, try to set it
    const authInput = await page.$('#authToken');
    if (authInput) {
      await page.type('#authToken', 'test-auth-token');
      
      // Look for save/connect button
      const saveButton = await page.$('button[type="submit"], #saveAuth, .auth-save');
      if (saveButton) {
        await saveButton.click();
        
        // Wait for some feedback
        await page.waitForTimeout(1000);
      }
    }
  }, 30000);
  
  test('Dashboard is responsive', async () => {
    // Test mobile viewport
    await page.setViewport({ width: 375, height: 667 });
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle0' });
    
    // Check if mobile menu exists
    const hasMobileMenu = await page.$('.mobile-menu, .hamburger, [aria-label*="menu"]') !== null;
    expect(hasMobileMenu).toBe(true);
    
    // Test desktop viewport
    await page.setViewport({ width: 1920, height: 1080 });
    await page.reload({ waitUntil: 'networkidle0' });
    
    // Check layout adapts
    const hasDesktopLayout = await page.$('.desktop-layout, .sidebar, nav:not(.mobile)') !== null;
    expect(hasDesktopLayout).toBe(true);
  }, 30000);
});