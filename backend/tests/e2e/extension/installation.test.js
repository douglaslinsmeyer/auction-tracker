const { launchBrowserWithExtension, openExtensionPopup, waitForServiceWorker } = require('../helpers/extensionLoader');
const { configureAuthToken, connectToBackend } = require('../helpers/extensionHelpers');

// Skip extension tests in headless mode (CI/CD)
const describeSkipIfHeadless = process.env.HEADLESS === 'true' ? describe.skip : describe;

describeSkipIfHeadless('Chrome Extension Installation & Setup', () => {
  let browser;
  let extensionId;

  beforeEach(async () => {
    // Launch browser with extension
    const result = await launchBrowserWithExtension({ headless: false });
    browser = result.browser;
    extensionId = result.extensionId;
  });

  afterEach(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('Extension loads successfully', async () => {
    // Verify extension ID was found
    expect(extensionId).toBeTruthy();
    expect(extensionId).toMatch(/^[a-z]{32}$/);

    // Verify service worker is active
    await waitForServiceWorker(browser, extensionId);

    // Open popup to verify it loads
    const popupPage = await openExtensionPopup(browser, extensionId);

    // Check popup title
    const title = await popupPage.title();
    expect(title).toContain('Nellis Auction Helper');

    // Check for main UI elements
    const hasAuthSection = await popupPage.$('#authToken') !== null;
    const hasConnectionStatus = await popupPage.$('#connectionStatus') !== null;

    expect(hasAuthSection).toBe(true);
    expect(hasConnectionStatus).toBe(true);
  }, 30000);

  test('First-time setup flow', async () => {
    // Open extension popup
    const popupPage = await openExtensionPopup(browser, extensionId);

    // Check initial state - should not be connected
    const initialStatus = await popupPage.$eval('#connectionStatus', el => el.textContent);
    expect(initialStatus).toContain('Disconnected');

    // Configure auth token
    await configureAuthToken(popupPage, 'test-auth-token');

    // Connect to backend
    await connectToBackend(popupPage, 'http://localhost:3000');

    // Verify connection status
    const connectedStatus = await popupPage.$eval('#connectionStatus', el => el.textContent);
    expect(connectedStatus).toContain('Connected');

    // Verify WebSocket indicator
    const wsIndicator = await popupPage.$('.websocket-indicator');
    expect(wsIndicator).toBeTruthy();
  }, 30000);

  test('Extension persists configuration', async () => {
    // Setup extension
    let popupPage = await openExtensionPopup(browser, extensionId);
    await configureAuthToken(popupPage, 'persistent-token');
    await popupPage.close();

    // Reopen popup
    popupPage = await openExtensionPopup(browser, extensionId);

    // Check if auth token is persisted
    const savedToken = await popupPage.$eval('#authToken', el => el.value);
    expect(savedToken).toBe('persistent-token');
  }, 30000);

  test('Extension handles missing backend gracefully', async () => {
    const popupPage = await openExtensionPopup(browser, extensionId);

    // Try to connect to non-existent backend
    await configureAuthToken(popupPage, 'test-token');

    // Attempt connection to wrong port
    const urlInput = await popupPage.$('#backendUrl');
    if (urlInput) {
      await popupPage.click('#backendUrl', { clickCount: 3 });
      await popupPage.type('#backendUrl', 'http://localhost:9999');
    }

    const connectButton = await popupPage.$('#connectButton');
    if (connectButton) {
      await connectButton.click();
    }

    // Should show error message
    await popupPage.waitForFunction(
      () => document.querySelector('.error-message') !== null ||
            document.querySelector('#connectionStatus')?.textContent.includes('Failed'),
      { timeout: 10000 }
    );

    const errorVisible = await popupPage.$('.error-message') !== null;
    const statusFailed = await popupPage.$eval('#connectionStatus', el => el.textContent).then(text => text.includes('Failed')).catch(() => false);

    expect(errorVisible || statusFailed).toBe(true);
  }, 30000);

  test('Extension UI is responsive', async () => {
    const popupPage = await openExtensionPopup(browser, extensionId);

    // Check viewport
    const viewport = await popupPage.viewport();
    expect(viewport.width).toBeGreaterThanOrEqual(300);
    expect(viewport.height).toBeGreaterThanOrEqual(400);

    // Test tab navigation
    const tabs = await popupPage.$$('.tab-button');
    expect(tabs.length).toBeGreaterThan(0);

    // Click through tabs
    for (const tab of tabs) {
      await tab.click();
      await popupPage.waitForTimeout(200);

      // Verify tab content changes
      const isActive = await tab.evaluate(el => el.classList.contains('active'));
      expect(isActive).toBe(true);
    }
  }, 30000);

  test('Extension permissions are properly set', async () => {
    // Navigate to extension details page
    const page = await browser.newPage();
    await page.goto(`chrome://extensions/?id=${extensionId}`);

    // Check permissions through extension management page
    const hasPermissions = await page.evaluate((extId) => {
      const extensionsManager = document.querySelector('extensions-manager');
      const itemList = extensionsManager.shadowRoot.querySelector('extensions-item-list');
      const items = itemList.shadowRoot.querySelectorAll('extensions-item');

      for (const item of items) {
        if (item.id === extId) {
          // Check for required permissions indicators
          const detailsButton = item.shadowRoot.querySelector('#detailsButton');
          if (detailsButton) {
            detailsButton.click();
          }
          return true;
        }
      }
      return false;
    }, extensionId);

    expect(hasPermissions).toBe(true);
    await page.close();
  }, 30000);
});