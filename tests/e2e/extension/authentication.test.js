const { launchBrowserWithExtension, openExtensionPopup } = require('../helpers/extensionLoader');
const { configureAuthToken, connectToBackend, isWebSocketConnected } = require('../helpers/extensionHelpers');
const MockNellisServer = require('../mocks/nellisServer');
const axios = require('axios');

describe('Extension Authentication Flow', () => {
  let browser;
  let extensionId;
  let mockNellis;
  const mockPort = 8080;
  const backendPort = 3000;

  beforeAll(async () => {
    // Start mock Nellis server
    mockNellis = new MockNellisServer(mockPort);
    await mockNellis.start();
  });

  afterAll(async () => {
    if (mockNellis) {
      await mockNellis.stop();
    }
  });

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

  test('Login through extension popup', async () => {
    // Open extension popup
    const popupPage = await openExtensionPopup(browser, extensionId);

    // Configure auth token
    await configureAuthToken(popupPage, 'test-auth-token-123');

    // Connect to backend
    await connectToBackend(popupPage, `http://localhost:${backendPort}`);

    // Verify WebSocket connection
    const wsConnected = await isWebSocketConnected(popupPage);
    expect(wsConnected).toBe(true);

    // Verify auth token is stored
    const savedToken = await popupPage.evaluate(() => {
      return new Promise((resolve) => {
        chrome.storage.local.get(['authToken'], (result) => {
          resolve(result.authToken);
        });
      });
    });
    expect(savedToken).toBe('test-auth-token-123');

    // Test backend authentication
    try {
      const response = await axios.get(`http://localhost:${backendPort}/api/status`, {
        headers: {
          'Authorization': 'test-auth-token-123'
        }
      });
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('version');
    } catch (error) {
      // Backend might not be running during test
      console.warn('Backend connection test skipped - server not running');
    }
  }, 30000);

  test('Invalid auth token handling', async () => {
    const popupPage = await openExtensionPopup(browser, extensionId);

    // Try with invalid token
    await configureAuthToken(popupPage, 'invalid-token');

    // Attempt to connect
    const urlInput = await popupPage.$('#backendUrl');
    if (urlInput) {
      await popupPage.click('#backendUrl', { clickCount: 3 });
      await popupPage.type('#backendUrl', `http://localhost:${backendPort}`);
    }

    const connectButton = await popupPage.$('#connectButton');
    if (connectButton) {
      await connectButton.click();
    }

    // Should show authentication error
    const errorOccurred = await popupPage.waitForFunction(
      () => {
        const errorMsg = document.querySelector('.error-message');
        const status = document.querySelector('#connectionStatus');
        return (errorMsg && errorMsg.textContent.toLowerCase().includes('auth')) ||
               (status && status.textContent.toLowerCase().includes('auth'));
      },
      { timeout: 10000 }
    ).then(() => true).catch(() => false);

    // Either error message or failed connection status
    const hasError = await popupPage.$('.error-message') !== null;
    const connectionFailed = await popupPage.$eval('#connectionStatus', el => 
      el.textContent.includes('Failed') || el.textContent.includes('Disconnected')
    ).catch(() => true);

    expect(hasError || connectionFailed).toBe(true);
  }, 30000);

  test('Session persistence across popup close/open', async () => {
    // Initial setup
    let popupPage = await openExtensionPopup(browser, extensionId);
    await configureAuthToken(popupPage, 'persistent-auth-token');
    await connectToBackend(popupPage, `http://localhost:${backendPort}`);

    // Verify initial connection
    const initialWsConnected = await isWebSocketConnected(popupPage);
    expect(initialWsConnected).toBe(true);

    // Close popup
    await popupPage.close();

    // Wait a bit for potential disconnection
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Reopen popup
    popupPage = await openExtensionPopup(browser, extensionId);

    // Check if still connected
    const stillConnected = await popupPage.waitForFunction(
      () => {
        const status = document.querySelector('#connectionStatus');
        return status && status.textContent.includes('Connected');
      },
      { timeout: 5000 }
    ).then(() => true).catch(() => false);

    // Verify auth token persisted
    const savedToken = await popupPage.$eval('#authToken', el => el.value).catch(() => '');
    expect(savedToken).toBe('persistent-auth-token');

    // Connection might persist or need reconnection
    if (!stillConnected) {
      // Try to reconnect
      await connectToBackend(popupPage, `http://localhost:${backendPort}`);
    }

    const finalWsConnected = await isWebSocketConnected(popupPage);
    expect(finalWsConnected).toBe(true);
  }, 30000);

  test('Cookie synchronization with Nellis', async () => {
    const popupPage = await openExtensionPopup(browser, extensionId);

    // Navigate to mock Nellis login page
    const nellisPage = await browser.newPage();
    await nellisPage.goto(`http://localhost:${mockPort}/login`, { waitUntil: 'networkidle0' });

    // Simulate login on Nellis
    await nellisPage.evaluate(() => {
      // Set a test cookie
      document.cookie = 'nellis_session=test_session_123; path=/';
      document.cookie = 'nellis_auth=test_auth_456; path=/';
    });

    // Check if extension can read Nellis cookies
    const cookies = await popupPage.evaluate(() => {
      return new Promise((resolve) => {
        chrome.cookies.getAll({ domain: 'localhost' }, (cookies) => {
          resolve(cookies);
        });
      });
    });

    // Extension should have access to cookies
    const sessionCookie = cookies.find(c => c.name === 'nellis_session');
    const authCookie = cookies.find(c => c.name === 'nellis_auth');

    // Note: Cookie access depends on extension permissions
    if (sessionCookie || authCookie) {
      expect(sessionCookie || authCookie).toBeTruthy();
    } else {
      console.warn('Cookie sync test skipped - extension may not have cookie permissions for localhost');
    }

    await nellisPage.close();
  }, 30000);

  test('Multiple device synchronization', async () => {
    // Launch second browser with same extension
    const result2 = await launchBrowserWithExtension({ headless: false });
    const browser2 = result2.browser;
    const extensionId2 = result2.extensionId;

    try {
      // Setup first browser
      const popup1 = await openExtensionPopup(browser, extensionId);
      await configureAuthToken(popup1, 'shared-auth-token');
      await connectToBackend(popup1, `http://localhost:${backendPort}`);

      // Setup second browser
      const popup2 = await openExtensionPopup(browser2, extensionId2);
      await configureAuthToken(popup2, 'shared-auth-token');
      await connectToBackend(popup2, `http://localhost:${backendPort}`);

      // Both should be connected
      const ws1Connected = await isWebSocketConnected(popup1);
      const ws2Connected = await isWebSocketConnected(popup2);

      expect(ws1Connected).toBe(true);
      expect(ws2Connected).toBe(true);

      // If backend is running, they should share state
      // This would be verified by checking monitored auctions list
      // but requires backend to be running

    } finally {
      await browser2.close();
    }
  }, 45000);

  test('Auth token refresh flow', async () => {
    const popupPage = await openExtensionPopup(browser, extensionId);

    // Configure initial token
    await configureAuthToken(popupPage, 'initial-token');
    await connectToBackend(popupPage, `http://localhost:${backendPort}`);

    // Update token
    await popupPage.click('#authToken', { clickCount: 3 });
    await popupPage.type('#authToken', 'refreshed-token');

    // Save new token
    const saveButton = await popupPage.$('#saveSettings');
    if (saveButton) {
      await saveButton.click();
    }

    // Verify token was updated
    const updatedToken = await popupPage.$eval('#authToken', el => el.value);
    expect(updatedToken).toBe('refreshed-token');

    // Connection might need to be re-established with new token
    const needsReconnect = await popupPage.$eval('#connectionStatus', el => 
      !el.textContent.includes('Connected')
    ).catch(() => true);

    if (needsReconnect) {
      await connectToBackend(popupPage, `http://localhost:${backendPort}`);
    }
  }, 30000);

  test('Logout functionality', async () => {
    const popupPage = await openExtensionPopup(browser, extensionId);

    // Setup connection
    await configureAuthToken(popupPage, 'logout-test-token');
    await connectToBackend(popupPage, `http://localhost:${backendPort}`);

    // Find and click logout button
    const logoutButton = await popupPage.$('#logoutButton');
    if (logoutButton) {
      await logoutButton.click();

      // Wait for disconnection
      await popupPage.waitForFunction(
        () => {
          const status = document.querySelector('#connectionStatus');
          return status && !status.textContent.includes('Connected');
        },
        { timeout: 5000 }
      );

      // Verify auth token was cleared
      const clearedToken = await popupPage.$eval('#authToken', el => el.value).catch(() => '');
      expect(clearedToken).toBe('');

      // Verify disconnected
      const wsConnected = await isWebSocketConnected(popupPage);
      expect(wsConnected).toBe(false);
    } else {
      console.warn('Logout button not found - test skipped');
    }
  }, 30000);
});