/**
 * Helper utilities for Chrome extension E2E testing
 */

/**
 * Configure extension with authentication token
 * @param {Page} popupPage - Extension popup page
 * @param {string} authToken - Backend authentication token
 */
async function configureAuthToken(popupPage, authToken) {
  // Wait for settings to be available
  await popupPage.waitForSelector('#authToken', { visible: true });

  // Clear existing value and type new token
  await popupPage.click('#authToken', { clickCount: 3 });
  await popupPage.type('#authToken', authToken);

  // Save settings
  const saveButton = await popupPage.$('#saveSettings');
  if (saveButton) {
    await saveButton.click();

    // Wait for save confirmation
    await popupPage.waitForFunction(
      () => document.querySelector('.success-message')?.textContent.includes('saved'),
      { timeout: 5000 }
    );
  }
}

/**
 * Connect extension to backend server
 * @param {Page} popupPage - Extension popup page
 * @param {string} backendUrl - Backend server URL (default: http://localhost:3000)
 */
async function connectToBackend(popupPage, backendUrl = 'http://localhost:3000') {
  // Check if already connected
  const connectionStatus = await popupPage.$eval('#connectionStatus', el => el.textContent);
  if (connectionStatus.includes('Connected')) {
    return true;
  }

  // Set backend URL if needed
  const urlInput = await popupPage.$('#backendUrl');
  if (urlInput) {
    await popupPage.click('#backendUrl', { clickCount: 3 });
    await popupPage.type('#backendUrl', backendUrl);
  }

  // Click connect button
  const connectButton = await popupPage.$('#connectButton');
  if (connectButton) {
    await connectButton.click();
  }

  // Wait for connection
  await popupPage.waitForFunction(
    () => document.querySelector('#connectionStatus')?.textContent.includes('Connected'),
    { timeout: 10000 }
  );

  return true;
}

/**
 * Navigate to Nellis auction page and wait for content script
 * @param {Browser} browser - Puppeteer browser instance
 * @param {string} auctionUrl - Nellis auction URL
 * @returns {Promise<Page>} Page with content script loaded
 */
async function navigateToAuction(browser, auctionUrl) {
  const page = await browser.newPage();

  // Navigate to auction page
  await page.goto(auctionUrl, { waitUntil: 'networkidle0' });

  // Wait for content script to inject its elements
  await page.waitForFunction(
    () => {
      // Check for extension-injected elements
      return document.querySelector('[data-nellis-helper]') !== null ||
             document.querySelector('.nellis-helper-button') !== null;
    },
    { timeout: 10000 }
  );

  return page;
}

/**
 * Start monitoring an auction from the auction page
 * @param {Page} auctionPage - Nellis auction page
 * @param {Object} options - Monitoring options
 */
async function startMonitoringFromPage(auctionPage, options = {}) {
  const {
    maxBid = '100.00',
    strategy = 'manual',
    incrementAmount = '5.00'
  } = options;

  // Click the extension's monitor button
  await auctionPage.click('.nellis-helper-monitor-button');

  // Wait for popup/modal to appear
  await auctionPage.waitForSelector('.nellis-helper-config', { visible: true });

  // Configure monitoring options
  await auctionPage.type('#maxBidInput', maxBid);
  await auctionPage.select('#strategySelect', strategy);
  await auctionPage.type('#incrementInput', incrementAmount);

  // Start monitoring
  await auctionPage.click('#startMonitoringButton');

  // Wait for confirmation
  await auctionPage.waitForFunction(
    () => document.querySelector('.monitoring-active') !== null,
    { timeout: 5000 }
  );
}

/**
 * Get monitoring status from popup
 * @param {Page} popupPage - Extension popup page
 * @returns {Promise<Array>} Array of monitored auctions
 */
async function getMonitoredAuctions(popupPage) {
  // Ensure we're on the monitoring tab
  const monitoringTab = await popupPage.$('#monitoringTab');
  if (monitoringTab) {
    await monitoringTab.click();
    await popupPage.waitForTimeout(500);
  }

  // Get auction list
  const auctions = await popupPage.evaluate(() => {
    const auctionElements = document.querySelectorAll('.auction-item');
    return Array.from(auctionElements).map(el => ({
      id: el.dataset.auctionId,
      title: el.querySelector('.auction-title')?.textContent,
      currentBid: el.querySelector('.current-bid')?.textContent,
      timeLeft: el.querySelector('.time-left')?.textContent,
      strategy: el.querySelector('.strategy')?.textContent,
      status: el.querySelector('.status')?.textContent
    }));
  });

  return auctions;
}

/**
 * Place a bid through the extension popup
 * @param {Page} popupPage - Extension popup page
 * @param {string} auctionId - Auction ID
 * @param {string} bidAmount - Bid amount
 */
async function placeBidFromPopup(popupPage, auctionId, bidAmount) {
  // Find the auction item
  const auctionSelector = `.auction-item[data-auction-id="${auctionId}"]`;
  await popupPage.waitForSelector(auctionSelector);

  // Click on the auction to expand details
  await popupPage.click(auctionSelector);

  // Enter bid amount
  await popupPage.type(`${auctionSelector} .bid-input`, bidAmount);

  // Click bid button
  await popupPage.click(`${auctionSelector} .bid-button`);

  // Wait for bid confirmation
  await popupPage.waitForFunction(
    (selector) => {
      const el = document.querySelector(selector);
      return el?.querySelector('.bid-status')?.textContent.includes('Bid placed');
    },
    { timeout: 10000 },
    auctionSelector
  );
}

/**
 * Update auction strategy
 * @param {Page} popupPage - Extension popup page
 * @param {string} auctionId - Auction ID
 * @param {string} strategy - New strategy (manual, aggressive, lastSecond)
 */
async function updateStrategy(popupPage, auctionId, strategy) {
  const auctionSelector = `.auction-item[data-auction-id="${auctionId}"]`;

  // Find and click strategy dropdown
  await popupPage.click(`${auctionSelector} .strategy-dropdown`);
  await popupPage.select(`${auctionSelector} .strategy-select`, strategy);

  // Wait for update confirmation
  await popupPage.waitForFunction(
    (selector, expectedStrategy) => {
      const el = document.querySelector(selector);
      return el?.querySelector('.strategy')?.textContent === expectedStrategy;
    },
    { timeout: 5000 },
    auctionSelector,
    strategy
  );
}

/**
 * Wait for real-time update in popup
 * @param {Page} popupPage - Extension popup page
 * @param {string} auctionId - Auction ID
 * @param {Function} condition - Condition function to evaluate
 * @param {number} timeout - Maximum wait time
 */
async function waitForAuctionUpdate(popupPage, auctionId, condition, timeout = 10000) {
  const auctionSelector = `.auction-item[data-auction-id="${auctionId}"]`;

  await popupPage.waitForFunction(
    (selector, conditionStr) => {
      const el = document.querySelector(selector);
      if (!el) { return false; }

      const auctionData = {
        currentBid: el.querySelector('.current-bid')?.textContent,
        timeLeft: el.querySelector('.time-left')?.textContent,
        status: el.querySelector('.status')?.textContent,
        myBid: el.querySelector('.my-bid')?.textContent
      };

      // Evaluate condition
      return new Function('auction', `return ${conditionStr}`)(auctionData);
    },
    { timeout },
    auctionSelector,
    condition.toString()
  );
}

/**
 * Check WebSocket connection status
 * @param {Page} popupPage - Extension popup page
 * @returns {Promise<boolean>} Connection status
 */
async function isWebSocketConnected(popupPage) {
  const status = await popupPage.evaluate(() => {
    // Check connection indicator
    const indicator = document.querySelector('#connectionStatus');
    return indicator?.classList.contains('connected') ||
           indicator?.textContent.includes('Connected');
  });

  return status;
}

/**
 * Get extension logs from service worker
 * @param {Page} backgroundPage - Service worker page
 * @returns {Promise<Array>} Console logs
 */
function getServiceWorkerLogs(backgroundPage) {
  const logs = [];

  backgroundPage.on('console', msg => {
    logs.push({
      type: msg.type(),
      text: msg.text(),
      timestamp: new Date()
    });
  });

  return logs;
}

module.exports = {
  configureAuthToken,
  connectToBackend,
  navigateToAuction,
  startMonitoringFromPage,
  getMonitoredAuctions,
  placeBidFromPopup,
  updateStrategy,
  waitForAuctionUpdate,
  isWebSocketConnected,
  getServiceWorkerLogs
};