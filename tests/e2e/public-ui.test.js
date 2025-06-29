const puppeteer = require('puppeteer');

describe('Nellis Auction Monitor UI', () => {
  let browser;
  let page;
  const baseURL = 'http://localhost:3000';

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.goto(baseURL);
  });

  afterEach(async () => {
    await page.close();
  });

  describe('Page Load and Basic Elements', () => {
    test('should load the page successfully', async () => {
      await expect(page.title()).resolves.toBe('Nellis Auction Monitor');
    });

    test('should have header with title', async () => {
      const headerText = await page.$eval('h1', el => el.textContent);
      expect(headerText).toBe('Nellis Auction Monitor');
    });

    test('should have navigation sidebar', async () => {
      const sidebar = await page.$('#sidebar');
      expect(sidebar).toBeTruthy();
    });

    test('should have auctions and settings navigation links', async () => {
      const auctionsLink = await page.$('#nav-auctions');
      const settingsLink = await page.$('#nav-settings');
      expect(auctionsLink).toBeTruthy();
      expect(settingsLink).toBeTruthy();
    });
  });

  describe('Dark Mode Toggle', () => {
    test('should toggle dark mode when button is clicked', async () => {
      // Check initial state (should be light mode)
      const initialDarkClass = await page.$eval('html', el => el.classList.contains('dark'));
      expect(initialDarkClass).toBe(false);

      // Click dark mode toggle
      await page.click('#theme-toggle');
      
      // Check if dark mode is enabled
      const darkModeEnabled = await page.$eval('html', el => el.classList.contains('dark'));
      expect(darkModeEnabled).toBe(true);

      // Click again to toggle back
      await page.click('#theme-toggle');
      
      // Check if dark mode is disabled
      const darkModeDisabled = await page.$eval('html', el => el.classList.contains('dark'));
      expect(darkModeDisabled).toBe(false);
    });
  });

  describe('Navigation', () => {
    test('should navigate to settings page', async () => {
      // Click settings link
      await page.click('#nav-settings');
      
      // Check if settings page is visible
      const settingsPageVisible = await page.$eval('#settings-page', el => !el.classList.contains('hidden'));
      expect(settingsPageVisible).toBe(true);
      
      // Check if auctions page is hidden
      const auctionsPageHidden = await page.$eval('#auctions-page', el => el.classList.contains('hidden'));
      expect(auctionsPageHidden).toBe(true);
    });

    test('should navigate back to auctions page', async () => {
      // Navigate to settings first
      await page.click('#nav-settings');
      
      // Navigate back to auctions
      await page.click('#nav-auctions');
      
      // Check if auctions page is visible
      const auctionsPageVisible = await page.$eval('#auctions-page', el => !el.classList.contains('hidden'));
      expect(auctionsPageVisible).toBe(true);
      
      // Check if settings page is hidden
      const settingsPageHidden = await page.$eval('#settings-page', el => el.classList.contains('hidden'));
      expect(settingsPageHidden).toBe(true);
    });
  });

  describe('Sidebar Toggle', () => {
    test('should open and close sidebar on mobile', async () => {
      // Set viewport to mobile size
      await page.setViewport({ width: 375, height: 667 });
      
      // Check initial state (sidebar should be closed)
      const initialSidebarState = await page.$eval('#sidebar', el => el.classList.contains('-translate-x-full'));
      expect(initialSidebarState).toBe(true);
      
      // Click menu toggle
      await page.click('#menu-toggle');
      
      // Check if sidebar is open
      const sidebarOpen = await page.$eval('#sidebar', el => !el.classList.contains('-translate-x-full'));
      expect(sidebarOpen).toBe(true);
      
      // Click close button
      await page.click('#close-sidebar');
      
      // Check if sidebar is closed
      const sidebarClosed = await page.$eval('#sidebar', el => el.classList.contains('-translate-x-full'));
      expect(sidebarClosed).toBe(true);
    });
  });

  describe('Settings Page', () => {
    beforeEach(async () => {
      // Navigate to settings page
      await page.click('#nav-settings');
      await page.waitForSelector('#settings-page:not(.hidden)');
    });

    test('should display all bidding settings fields', async () => {
      const defaultMaxBid = await page.$('#default-max-bid');
      const defaultStrategy = await page.$('#default-strategy');
      const autoBidDefault = await page.$('#auto-bid-default');
      const snipeTiming = await page.$('#snipe-timing');
      const bidBuffer = await page.$('#bid-buffer');
      const retryAttempts = await page.$('#retry-attempts');
      
      expect(defaultMaxBid).toBeTruthy();
      expect(defaultStrategy).toBeTruthy();
      expect(autoBidDefault).toBeTruthy();
      expect(snipeTiming).toBeTruthy();
      expect(bidBuffer).toBeTruthy();
      expect(retryAttempts).toBeTruthy();
    });

    test('should update input values', async () => {
      // Clear and type new value for max bid
      await page.click('#default-max-bid', { clickCount: 3 });
      await page.type('#default-max-bid', '250');
      
      const maxBidValue = await page.$eval('#default-max-bid', el => el.value);
      expect(maxBidValue).toBe('250');
      
      // Change strategy dropdown
      await page.select('#default-strategy', 'sniping');
      const strategyValue = await page.$eval('#default-strategy', el => el.value);
      expect(strategyValue).toBe('sniping');
    });

    test('should have save button', async () => {
      const saveButton = await page.$('#save-settings');
      expect(saveButton).toBeTruthy();
      
      const buttonText = await page.$eval('#save-settings', el => el.textContent);
      expect(buttonText.trim()).toBe('Save Settings');
    });
  });

  describe('Status Bar', () => {
    test('should display connection status', async () => {
      const connectionStatus = await page.$('#connection-status');
      expect(connectionStatus).toBeTruthy();
      
      const connectionText = await page.$eval('#connection-text', el => el.textContent);
      expect(connectionText).toBe('Connecting');
    });

    test('should display auction count', async () => {
      const auctionCount = await page.$eval('#auction-count', el => el.textContent);
      expect(auctionCount).toBe('0');
    });
  });

  describe('Empty State', () => {
    test('should show empty state when no auctions', async () => {
      const emptyState = await page.$('#empty-state');
      expect(emptyState).toBeTruthy();
      
      const emptyStateText = await page.$eval('#empty-state p', el => el.textContent);
      expect(emptyStateText).toContain('No auctions being monitored');
    });
  });

  describe('Responsive Design', () => {
    test('should adapt layout for desktop', async () => {
      await page.setViewport({ width: 1920, height: 1080 });
      
      // On desktop, sidebar toggle should still work
      const menuToggle = await page.$('#menu-toggle');
      expect(menuToggle).toBeTruthy();
    });

    test('should adapt layout for tablet', async () => {
      await page.setViewport({ width: 768, height: 1024 });
      
      // Check if grid layout adjusts
      const gridClasses = await page.$eval('#auctions-grid', el => el.className);
      expect(gridClasses).toContain('sm:grid-cols-2');
    });
  });
});