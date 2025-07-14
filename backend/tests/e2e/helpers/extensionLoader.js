const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;

/**
 * Launch Chrome browser with Nellis Auction Helper extension loaded
 * @param {Object} options - Launch options
 * @param {boolean} options.headless - Whether to run in headless mode (default: false)
 * @param {boolean} options.devtools - Whether to open devtools (default: false)
 * @returns {Promise<{browser: Browser, extensionId: string}>}
 */
async function launchBrowserWithExtension(options = {}) {
  // Respect HEADLESS environment variable for CI/CD
  const headlessEnv = process.env.HEADLESS === 'true';
  const { headless = headlessEnv, devtools = false } = options;

  // Chrome extensions cannot be loaded in headless mode
  if (headless) {
    throw new Error('Chrome extensions cannot be loaded in headless mode. Set HEADLESS=false or skip extension tests in CI.');
  }

  // Path to the extension directory
  const extensionPath = path.join(__dirname, '../../../../extension');

  // Verify extension exists
  try {
    await fs.access(extensionPath);
  } catch (error) {
    throw new Error(`Extension not found at ${extensionPath}. Make sure the extension directory exists.`);
  }

  // Launch browser with extension
  const browser = await puppeteer.launch({
    headless,
    devtools,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ],
    defaultViewport: null // Use full window size
  });

  // Get extension ID
  const extensionId = await getExtensionId(browser);

  return { browser, extensionId };
}

/**
 * Get the extension ID from chrome://extensions
 * @param {Browser} browser - Puppeteer browser instance
 * @returns {Promise<string>} Extension ID
 */
async function getExtensionId(browser) {
  const page = await browser.newPage();

  try {
    // Navigate to extensions page
    await page.goto('chrome://extensions/', { waitUntil: 'networkidle0' });

    // Enable developer mode to see extension IDs
    await page.evaluate(() => {
      const devModeToggle = document.querySelector('extensions-manager').shadowRoot
        .querySelector('extensions-toolbar').shadowRoot
        .querySelector('cr-toggle');
      if (!devModeToggle.checked) {
        devModeToggle.click();
      }
    });

    // Wait a bit for the UI to update
    await page.waitForTimeout(500);

    // Get extension ID
    const extensionId = await page.evaluate(() => {
      const extensionsManager = document.querySelector('extensions-manager');
      const itemList = extensionsManager.shadowRoot.querySelector('extensions-item-list');
      const items = itemList.shadowRoot.querySelectorAll('extensions-item');

      for (const item of items) {
        const name = item.shadowRoot.querySelector('#name').textContent;
        if (name.includes('Nellis Auction Helper')) {
          return item.id;
        }
      }

      return null;
    });

    if (!extensionId) {
      throw new Error('Could not find Nellis Auction Helper extension');
    }

    return extensionId;
  } finally {
    await page.close();
  }
}

/**
 * Open the extension popup in a new tab
 * @param {Browser} browser - Puppeteer browser instance
 * @param {string} extensionId - Extension ID
 * @returns {Promise<Page>} Page with extension popup
 */
async function openExtensionPopup(browser, extensionId) {
  const page = await browser.newPage();
  const popupUrl = `chrome-extension://${extensionId}/popup.html`;

  await page.goto(popupUrl, { waitUntil: 'networkidle0' });

  // Wait for popup to be fully loaded
  await page.waitForSelector('body', { visible: true });

  return page;
}

/**
 * Wait for the extension's service worker to be active
 * @param {Browser} browser - Puppeteer browser instance
 * @param {string} extensionId - Extension ID
 * @param {number} timeout - Maximum wait time in ms (default: 10000)
 */
async function waitForServiceWorker(browser, extensionId, timeout = 10000) {
  const page = await browser.newPage();

  try {
    await page.goto(`chrome://extensions/?id=${extensionId}`, { waitUntil: 'networkidle0' });

    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const isActive = await page.evaluate((extId) => {
        const extensionsManager = document.querySelector('extensions-manager');
        const itemList = extensionsManager.shadowRoot.querySelector('extensions-item-list');
        const items = itemList.shadowRoot.querySelectorAll('extensions-item');

        for (const item of items) {
          if (item.id === extId) {
            const serviceWorkerText = item.shadowRoot.querySelector('#inspect-views').textContent;
            return serviceWorkerText.includes('service worker');
          }
        }

        return false;
      }, extensionId);

      if (isActive) {
        return true;
      }

      await page.waitForTimeout(500);
    }

    throw new Error('Service worker did not become active within timeout');
  } finally {
    await page.close();
  }
}

/**
 * Get extension background page for debugging
 * @param {Browser} browser - Puppeteer browser instance
 * @param {string} extensionId - Extension ID
 * @returns {Promise<Page>} Background page
 */
async function getBackgroundPage(browser, extensionId) {
  const targets = await browser.targets();
  const backgroundPageTarget = targets.find(
    target => target.type() === 'service_worker' && target.url().includes(extensionId)
  );

  if (!backgroundPageTarget) {
    throw new Error('Could not find service worker target');
  }

  return backgroundPageTarget.page();
}

module.exports = {
  launchBrowserWithExtension,
  getExtensionId,
  openExtensionPopup,
  waitForServiceWorker,
  getBackgroundPage
};