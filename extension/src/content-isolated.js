console.log('Nellis Auction Helper: Content script loaded (isolated mode)');

// Unique namespace for our extension
const NAH_NAMESPACE = 'nah-ext-2024';
const NAH_SHADOW_HOST = `${NAH_NAMESPACE}-shadow-host`;

let extensionEnabled = false;
let monitoredAuctions = new Set();
let shadowRoots = new Map(); // Track shadow roots for cleanup

// Check for other extensions
function detectExtensionConflicts() {
  const potentialConflicts = [
    { selector: '[data-browser-mcp]', name: 'Browser MCP' },
    { selector: '.browser-mcp-root', name: 'Browser MCP' }
  ];
  
  const conflicts = [];
  potentialConflicts.forEach(conflict => {
    if (document.querySelector(conflict.selector)) {
      conflicts.push(conflict.name);
    }
  });
  
  if (conflicts.length > 0) {
    console.log(`NAH: Detected potential conflicts with: ${conflicts.join(', ')}`);
    console.log('NAH: Running in isolated mode with Shadow DOM');
  }
  
  return conflicts;
}

// Create a shadow DOM container for our UI
function createShadowContainer(hostElement, identifier) {
  // Check if we already have a shadow root here
  if (shadowRoots.has(identifier)) {
    return shadowRoots.get(identifier);
  }
  
  const shadowHost = document.createElement('div');
  shadowHost.className = NAH_SHADOW_HOST;
  shadowHost.setAttribute('data-nah-id', identifier);
  
  // Create shadow root with closed mode for better isolation
  const shadowRoot = shadowHost.attachShadow({ mode: 'closed' });
  
  // Inject our styles into the shadow DOM
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    :host {
      all: initial;
      display: block;
      position: relative;
      z-index: 999999;
      padding: 15px;
    }
    
    * {
      box-sizing: border-box;
    }
    
    .nah-monitor-panel {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 0.75rem;
      padding: 0;
      margin: 20px 0;
      max-width: 340px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
      overflow: hidden;
    }
    
    .nah-panel-header {
      background: #f9fafb;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .nah-panel-header h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: #111827;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .nah-toggle {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.875rem;
      color: #374151;
    }
    
    .nah-toggle input[type="checkbox"] {
      width: 2.5rem;
      height: 1.5rem;
      cursor: pointer;
      appearance: none;
      background: #d1d5db;
      border-radius: 9999px;
      position: relative;
      transition: all 0.2s ease;
    }
    
    .nah-toggle input[type="checkbox"]:checked {
      background: #6366f1;
    }
    
    .nah-toggle input[type="checkbox"]::after {
      content: '';
      position: absolute;
      width: 1.25rem;
      height: 1.25rem;
      background: white;
      border-radius: 50%;
      top: 0.125rem;
      left: 0.125rem;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
    }
    
    .nah-toggle input[type="checkbox"]:checked::after {
      transform: translateX(1rem);
    }
    
    .nah-panel-body {
      padding: 1.25rem;
      background: white;
    }
    
    .nah-setting {
      margin-bottom: 1rem;
    }
    
    .nah-setting label {
      display: block;
      margin-bottom: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
      color: #333;
    }
    
    .nah-setting input, .nah-setting select {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      color: #111827;
      background: white;
      transition: all 0.15s ease;
    }
    
    .nah-setting input:focus, .nah-setting select:focus {
      outline: none;
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgb(99 102 241 / 0.1);
    }
    
    /* Max bid input with inner label */
    .nah-max-bid-wrapper {
      position: relative;
      margin-bottom: 1.25rem;
    }
    
    .nah-max-bid-wrapper input {
      padding-left: 6rem;
      font-size: 1.125rem;
      font-weight: 600;
      height: 3rem;
      border: 2px solid #e5e7eb;
      transition: all 0.2s;
    }
    
    .nah-max-bid-wrapper input:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 4px rgb(99 102 241 / 0.1);
    }
    
    .nah-max-bid-label {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 5.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f3f4f6;
      border: 2px solid #e5e7eb;
      border-right: none;
      border-radius: 0.375rem 0 0 0.375rem;
      font-size: 0.875rem;
      font-weight: 600;
      color: #374151;
      pointer-events: none;
    }
    
    /* Binary pill strategy selector */
    .nah-strategy-pills {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    
    .nah-strategy-pill {
      flex: 1;
      padding: 0.5rem 1rem;
      border: 2px solid #e5e7eb;
      border-radius: 9999px;
      background: white;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      color: #6b7280;
      text-align: center;
      transition: all 0.2s;
    }
    
    .nah-strategy-pill:hover {
      border-color: #d1d5db;
      color: #374151;
    }
    
    .nah-strategy-pill.active {
      background: #6366f1;
      border-color: #6366f1;
      color: white;
    }
    
    /* Condensed auto-bid toggle */
    .nah-autobid-condensed {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
    }
    
    .nah-autobid-condensed-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
    }
    
    .nah-autobid-condensed-toggle {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .nah-status {
      margin-top: 1.25rem;
      padding: 1rem;
      background: #f9fafb;
      border-radius: 0.5rem;
      border: 1px solid #e5e7eb;
    }
    
    .nah-status p {
      margin: 0.375rem 0;
      font-size: 0.875rem;
      color: #6b7280;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .nah-status span {
      font-weight: 500;
      color: #111827;
    }
    
    .nah-status .active {
      color: #10b981;
      font-weight: 600;
    }
    
    /* Autobid section styles */
    .nah-autobid-section {
      margin-top: 1.25rem;
      padding: 1rem;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 0.5rem;
    }
    
    .nah-autobid-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    
    .nah-autobid-header h4 {
      margin: 0;
      font-size: 0.875rem;
      font-weight: 600;
      color: #111827;
    }
    
    .nah-autobid-status {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.75rem;
      font-weight: 500;
    }
    
    .nah-autobid-status .nah-status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #6b7280;
    }
    
    .nah-autobid-status[data-status="active"] .nah-status-dot {
      background: #10b981;
      animation: pulse 2s infinite;
    }
    
    .nah-autobid-status[data-status="active"] .nah-status-text {
      color: #059669;
    }
    
    .nah-autobid-toggle {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.625rem 1rem;
      border: 2px solid;
      border-radius: 0.5rem;
      background: white;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.2s;
    }
    
    .nah-autobid-toggle[data-enabled="false"] {
      border-color: #10b981;
      color: #059669;
    }
    
    .nah-autobid-toggle[data-enabled="false"]:hover {
      background: #f0fdf4;
      border-color: #059669;
    }
    
    .nah-autobid-toggle[data-enabled="true"] {
      border-color: #ef4444;
      color: #dc2626;
    }
    
    .nah-autobid-toggle[data-enabled="true"]:hover {
      background: #fef2f2;
      border-color: #dc2626;
    }
    
    .nah-toggle-icon {
      width: 16px;
      height: 16px;
    }
    
    .nah-autobid-note {
      margin: 0.5rem 0 0 0;
      font-size: 0.75rem;
      color: #6b7280;
      font-style: italic;
    }
    
    /* Floating button styles */
    .nah-floating-button {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
    }
    
    .nah-float-btn {
      background: #3498db;
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 50px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    
    .nah-float-btn:hover {
      background: #2980b9;
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0,0,0,0.2);
    }
    
    .nah-float-btn.active {
      background: #27ae60;
    }
    
    .nah-float-btn.active:hover {
      background: #229954;
    }
  `;
  
  shadowRoot.appendChild(styleSheet);
  hostElement.appendChild(shadowHost);
  shadowRoots.set(identifier, shadowRoot);
  
  return shadowRoot;
}

// Initialize on page load
chrome.storage.local.get(['extensionEnabled'], (result) => {
  extensionEnabled = result.extensionEnabled !== undefined ? result.extensionEnabled : true; // Default to enabled
  if (extensionEnabled) {
    detectExtensionConflicts();
    initializeAuctionMonitoring();
  }
});

// Listen for URL changes (single-page app navigation)
let lastUrl = location.href;

// Method 1: MutationObserver for URL changes
const urlObserver = new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    handleNavigation();
  }
});
urlObserver.observe(document, {subtree: true, childList: true});

// Method 2: Listen for popstate events (browser back/forward)
window.addEventListener('popstate', handleNavigation);

// Method 3: Intercept pushState and replaceState
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function() {
  originalPushState.apply(history, arguments);
  setTimeout(handleNavigation, 100);
};

history.replaceState = function() {
  originalReplaceState.apply(history, arguments);
  setTimeout(handleNavigation, 100);
};

// Enhanced navigation handler
function handleNavigation() {
  console.log('NAH: Enhanced navigation detected, cleaning up...');
  
  // Cancel any pending retries
  retryQueue.forEach(timeout => clearTimeout(timeout));
  retryQueue.clear();
  
  // Clean up existing UI elements
  removeAllIndicators();
  
  // Reinitialize if enabled
  if (extensionEnabled) {
    // Use requestIdleCallback for better performance
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        initializeAuctionMonitoring();
      }, { timeout: 1000 });
    } else {
      setTimeout(() => {
        initializeAuctionMonitoring();
      }, 300);
    }
  }
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.extensionEnabled) {
    extensionEnabled = changes.extensionEnabled.newValue;
    if (extensionEnabled) {
      detectExtensionConflicts();
      initializeAuctionMonitoring();
    } else {
      disableAuctionMonitoring();
    }
  }
});

function initializeAuctionMonitoring() {
  console.log('NAH: Initializing auction monitoring (isolated mode)...');
  detectAuctionPage();
  observePageChanges();
}

function disableAuctionMonitoring() {
  console.log('NAH: Disabling auction monitoring...');
  monitoredAuctions.clear();
  removeAllIndicators();
}

function detectAuctionPage() {
  const isSearchPage = window.location.pathname.includes('/search');
  const isAuctionDetailPage = window.location.pathname.match(/\/auction\/\d+/);
  const isProductPage = window.location.pathname.match(/\/p\/[^\/]+\/\d+/);
  const isEventPage = window.location.pathname.includes('/event');
  
  console.log('NAH: Page detection:', {
    isSearchPage,
    isAuctionDetailPage,
    isProductPage,
    isEventPage,
    pathname: window.location.pathname
  });
  
  if (isSearchPage || isEventPage) {
    detectAuctionItems();
  } else if (isAuctionDetailPage || isProductPage) {
    // Wait for page to load completely using multiple strategies
    if (document.readyState === 'complete') {
      setTimeout(() => detectSingleAuction(), 500);
    } else {
      window.addEventListener('load', () => {
        setTimeout(() => detectSingleAuction(), 500);
      });
    }
    // Also try after a longer delay as backup
    setTimeout(() => detectSingleAuction(), 2000);
  }
}

// Enhanced auction detection with retry logic and dynamic element waiting
async function detectSingleAuction() {
  const auctionId = extractAuctionIdFromUrl();
  if (!auctionId) {
    console.log('NAH: No auction ID found in URL');
    return;
  }
  
  console.log('NAH: Detecting auction with enhanced logic, ID:', auctionId);
  
  try {
    // First, check if auction is already monitored
    const monitoringStatus = await checkMonitoringStatus(auctionId);
    
    // Wait for critical page elements with intelligent retry
    const elementsReady = await waitForAuctionPageElements(auctionId);
    
    if (!elementsReady) {
      console.log('NAH: Critical elements not found after retries, attempting fallback initialization');
      // Still try to initialize with whatever we have
    }
    
    // Find or wait for suitable container
    const targetContainer = await findSuitableContainer();
    
    if (targetContainer) {
      console.log('NAH: Adding monitoring panel with enhanced detection');
      addDetailedMonitoringWithShadow(targetContainer, auctionId, monitoringStatus.isMonitored);
      addFloatingMonitorButtonWithShadow(auctionId, monitoringStatus.isMonitored);
      
      if (monitoringStatus.isMonitored && monitoringStatus.auction) {
        // Update display for already monitored auction
        setTimeout(() => {
          updateAuctionDisplay(auctionId, monitoringStatus.auction);
          updateMonitoringStatusInAllShadowRoots(auctionId, 'Monitoring active');
        }, 100);
      }
      
      // Set up observer for late-loading data
      observeForDataUpdates(auctionId);
    } else {
      console.error('NAH: No suitable container found for monitoring panel');
      // Schedule retry
      scheduleRetry(auctionId);
    }
  } catch (error) {
    console.error('NAH: Error in enhanced auction detection:', error);
    scheduleRetry(auctionId);
  }
}

// Wait for critical auction page elements with intelligent retry
async function waitForAuctionPageElements(auctionId, options = {}) {
  const {
    maxRetries = 20,
    initialDelay = 100,
    maxDelay = 1000,
    timeout = 10000
  } = options;
  
  console.log('NAH: Waiting for auction page elements to load...');
  
  return new Promise((resolve) => {
    let retryCount = 0;
    let currentDelay = initialDelay;
    const startTime = Date.now();
    
    // Set up MutationObserver for dynamic detection
    let observerCallCount = 0;
    const observer = new MutationObserver(() => {
      observerCallCount++;
      // Throttle checks to avoid excessive processing
      if (observerCallCount % 5 !== 0) return;
      
      if (checkRequiredElements()) {
        observer.disconnect();
        clearTimeout(retryTimeout);
        console.log('NAH: Required elements found via MutationObserver');
        resolve(true);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'id']
    });
    
    let retryTimeout;
    
    function checkRequiredElements() {
      // Check for essential elements that indicate page is loaded
      const checks = {
        hasTitle: !!document.querySelector('h1'),
        hasBidButton: !!Array.from(document.querySelectorAll('button')).find(btn => {
          const text = btn.textContent.trim().toUpperCase();
          return text.includes('BID') || text.includes('LOGIN');
        }),
        hasPrice: !!Array.from(document.querySelectorAll('*')).find(el => 
          el.textContent && (el.textContent.includes('CURRENT PRICE') || el.textContent.includes('Current Price'))
        ),
        hasProductContainer: !!document.querySelector('main > div, article, [role="main"]')
      };
      
      const requiredElements = Object.values(checks).filter(Boolean).length;
      const isReady = requiredElements >= 3; // At least 3 out of 4 elements
      
      // Only log status occasionally to avoid spam
      if (!isReady && retryCount > 0 && retryCount % 10 === 0) {
        console.log('NAH: Element check status:', checks);
      }
      
      return isReady;
    }
    
    function attemptRetry() {
      if (Date.now() - startTime > timeout) {
        observer.disconnect();
        console.log('NAH: Timeout waiting for elements');
        resolve(false);
        return;
      }
      
      if (checkRequiredElements()) {
        observer.disconnect();
        console.log(`NAH: Required elements found after ${retryCount} retries`);
        resolve(true);
        return;
      }
      
      retryCount++;
      
      // Exponential backoff with jitter
      currentDelay = Math.min(currentDelay * 1.5 + Math.random() * 100, maxDelay);
      
      retryTimeout = setTimeout(attemptRetry, currentDelay);
    }
    
    // Initial check
    if (checkRequiredElements()) {
      observer.disconnect();
      resolve(true);
    } else {
      // Start retry loop
      retryTimeout = setTimeout(attemptRetry, currentDelay);
    }
  });
}

// Find suitable container with fallback options
async function findSuitableContainer() {
  const strategies = [
    // Strategy 1: Find bid button container
    () => {
      const bidButton = Array.from(document.querySelectorAll('button')).find(btn => {
        const text = btn.textContent.trim().toUpperCase();
        return text.includes('BID') || text.includes('LOGIN');
      });
      
      if (bidButton) {
        let container = bidButton.parentElement;
        // Navigate up to find a suitable container
        while (container && container.parentElement) {
          if (container.children.length > 1 || 
              container.classList.toString().match(/container|wrapper|section/i)) {
            return container;
          }
          container = container.parentElement;
          if (container.tagName === 'MAIN' || container.tagName === 'ARTICLE') {
            return container;
          }
        }
      }
      return null;
    },
    
    // Strategy 2: Find price/bid section
    () => {
      const priceElement = Array.from(document.querySelectorAll('*')).find(el => 
        el.textContent && el.textContent.trim() === 'CURRENT PRICE'
      );
      if (priceElement) {
        let container = priceElement.closest('div[class*="col"], div[class*="section"], section');
        return container || priceElement.parentElement;
      }
      return null;
    },
    
    // Strategy 3: Find main product container
    () => {
      // Look for product detail containers
      const productContainer = document.querySelector('[class*="product-detail"], [class*="auction-detail"]');
      if (productContainer) return productContainer;
      
      // Look for main > div that contains h1
      const mainDiv = document.querySelector('main > div');
      if (mainDiv && mainDiv.querySelector('h1')) {
        return mainDiv;
      }
      
      return null;
    },
    
    // Strategy 4: Use main element
    () => document.querySelector('main') || document.querySelector('#root > div > div'),
    
    // Strategy 5: Last resort - create our own container
    () => {
      const main = document.querySelector('main') || document.body;
      const container = document.createElement('div');
      container.className = 'nah-injected-container';
      container.style.cssText = 'margin: 20px auto; max-width: 1200px; padding: 0 20px;';
      
      // Try to insert after h1 or at the beginning
      const h1 = document.querySelector('h1');
      if (h1 && h1.parentElement) {
        h1.parentElement.insertBefore(container, h1.nextSibling);
      } else {
        main.insertBefore(container, main.firstChild);
      }
      
      return container;
    }
  ];
  
  for (const strategy of strategies) {
    const container = strategy();
    if (container) {
      console.log('NAH: Found suitable container using strategy:', strategies.indexOf(strategy) + 1);
      return container;
    }
  }
  
  return null;
}

// Check monitoring status with proper error handling
async function checkMonitoringStatus(auctionId) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      action: 'getMonitoredAuctions'
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('NAH: Error checking monitored auctions:', chrome.runtime.lastError);
        resolve({ isMonitored: false, auction: null });
        return;
      }
      
      const isMonitored = response?.auctions?.some(auction => auction.id === auctionId) || false;
      const auction = response?.auctions?.find(auction => auction.id === auctionId);
      
      resolve({ isMonitored, auction });
    });
  });
}

// Observe for late-loading data updates
function observeForDataUpdates(auctionId) {
  let dataCheckInterval;
  let lastDataFetch = Date.now();
  let lastUpdateTime = 0;
  const UPDATE_THROTTLE = 2000; // Only update every 2 seconds
  
  // Monitor fetch requests for data updates
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    
    if (typeof url === 'string' && (url.includes('_data') || url.includes(`/${auctionId}`))) {
      lastDataFetch = Date.now();
      
      return originalFetch.apply(this, args).then(response => {
        // Clone response to read it
        response.clone().json().then(data => {
          // Throttle updates to avoid spam
          const now = Date.now();
          if (now - lastUpdateTime < UPDATE_THROTTLE) {
            return;
          }
          lastUpdateTime = now;
          
          // Wait a bit for React to render
          setTimeout(() => {
            extractAuctionData(auctionId).then(auctionData => {
              if (auctionData) {
                updateAuctionDisplay(auctionId, auctionData);
              }
            });
          }, 200);
        }).catch(() => {
          // Not JSON or error parsing
        });
        
        return response;
      });
    }
    
    return originalFetch.apply(this, args);
  };
  
  // Periodic check for data staleness
  dataCheckInterval = setInterval(() => {
    if (Date.now() - lastDataFetch > 30000) { // 30 seconds
      // Silently refresh auction data
      extractAuctionData(auctionId).then(auctionData => {
        if (auctionData) {
          updateAuctionDisplay(auctionId, auctionData);
        }
      });
      lastDataFetch = Date.now();
    }
  }, 10000);
  
  // Clean up on navigation
  window.addEventListener('beforeunload', () => {
    clearInterval(dataCheckInterval);
    window.fetch = originalFetch;
  }, { once: true });
}

// Schedule retry for initialization
const retryQueue = new Map();

function scheduleRetry(auctionId, delay = 2000) {
  if (retryQueue.has(auctionId)) {
    return; // Already scheduled
  }
  
  console.log(`NAH: Scheduling retry for auction ${auctionId} in ${delay}ms`);
  
  const timeout = setTimeout(() => {
    retryQueue.delete(auctionId);
    detectSingleAuction();
  }, delay);
  
  retryQueue.set(auctionId, timeout);
}

function addDetailedMonitoringWithShadow(targetElement, auctionId, isMonitored = false) {
  // Check if already exists
  if (shadowRoots.has(`auction-${auctionId}`)) {
    console.log('NAH: Monitoring panel already exists for', auctionId);
    return;
  }
  
  const shadowRoot = createShadowContainer(targetElement, `auction-${auctionId}`);
  
  const monitorPanel = document.createElement('div');
  monitorPanel.className = 'nah-monitor-panel';
  monitorPanel.innerHTML = `
    <div class="nah-panel-header">
      <h3>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="stroke: currentColor;">
          <circle cx="12" cy="12" r="10" stroke-width="2"/>
          <path d="M12 6v6l4 2" stroke-width="2" stroke-linecap="round"/>
        </svg>
        Auction Helper
      </h3>
      <label class="nah-toggle">
        <input type="checkbox" id="nah-monitor-toggle-${auctionId}" data-auction-id="${auctionId}" ${isMonitored ? 'checked' : ''}>
      </label>
    </div>
    <div class="nah-panel-body" style="display: ${isMonitored ? 'block' : 'none'}">
      <div class="nah-setting">
        <div class="nah-max-bid-wrapper">
          <span class="nah-max-bid-label">Max Bid</span>
          <input type="number" id="nah-max-bid-${auctionId}" placeholder="Enter max bid" step="1" min="1" pattern="[0-9]*" title="Enter maximum bid amount">
        </div>
      </div>
      <div class="nah-strategy-pills">
        <button class="nah-strategy-pill active" data-strategy="sniping" id="nah-strategy-sniping-${auctionId}">Snipe</button>
        <button class="nah-strategy-pill" data-strategy="manual" id="nah-strategy-manual-${auctionId}">Auto</button>
      </div>
      <div class="nah-autobid-condensed">
        <span class="nah-autobid-condensed-label">Auto-bidding</span>
        <div class="nah-autobid-condensed-toggle">
          <div class="nah-autobid-status" id="nah-autobid-status-${auctionId}" data-status="inactive">
            <span class="nah-status-dot"></span>
            <span class="nah-status-text">Paused</span>
          </div>
          <label class="nah-toggle">
            <input type="checkbox" id="nah-autobid-toggle-${auctionId}" data-enabled="false">
          </label>
        </div>
      </div>
    </div>
  `;
  
  shadowRoot.appendChild(monitorPanel);
  
  // Store reference for updates
  shadowRoots.set(`auction-${auctionId}`, shadowRoot);
  
  // Set up event listeners within shadow DOM
  const toggle = shadowRoot.querySelector(`#nah-monitor-toggle-${auctionId}`);
  const panelBody = shadowRoot.querySelector('.nah-panel-body');
  const maxBidInput = shadowRoot.querySelector(`#nah-max-bid-${auctionId}`);
  const snipingPill = shadowRoot.querySelector(`#nah-strategy-sniping-${auctionId}`);
  const manualPill = shadowRoot.querySelector(`#nah-strategy-manual-${auctionId}`);
  const autoBidToggle = shadowRoot.querySelector(`#nah-autobid-toggle-${auctionId}`);
  const autoBidStatus = shadowRoot.querySelector(`#nah-autobid-status-${auctionId}`);
  
  // Initialize autobid UI based on strategy
  const initializeAutoBidUI = () => {
    const strategy = snipingPill.classList.contains('active') ? 'sniping' : 'auto';
    const isAutoStrategy = strategy === 'sniping';
    
    // For sniping strategy, auto-bid is enabled by default
    if (isAutoStrategy) {
      updateAutoBidUI(true, shadowRoot, auctionId);
    }
  };
  
  // Ensure max bid is always whole dollars and validate against minimum bid
  maxBidInput.addEventListener('input', (e) => {
    // Remove any decimal points or non-numeric characters
    let value = e.target.value.replace(/[^\d]/g, '');
    e.target.value = value;
    
    // Validate against minimum bid in real-time
    validateMaxBidInExtension(auctionId, e.target);
  });
  
  maxBidInput.addEventListener('blur', (e) => {
    // Ensure it's a valid whole number on blur and validate
    const value = parseInt(e.target.value) || 0;
    e.target.value = value;
    
    // Final validation with user feedback
    if (!validateMaxBidInExtension(auctionId, e.target, true)) {
      // Validation failed, don't send update
      return;
    }
  });
  
  // Function to send config updates
  const sendConfigUpdate = (includeAutoBid = false) => {
    if (!monitoredAuctions.has(auctionId)) return;
    
    const maxBid = parseInt(maxBidInput.value) || 0;
    const strategy = snipingPill.classList.contains('active') ? 'sniping' : 'auto';
    const autoBid = autoBidToggle.dataset.enabled === 'true';
    
    // Validate max bid before sending
    if (maxBid > 0 && !validateMaxBidInExtension(auctionId, maxBidInput, true)) {
      console.log('NAH: Config update blocked due to validation failure');
      return;
    }
    
    const config = {
      maxBid: maxBid,
      strategy: strategy
    };
    
    // Include autoBid if explicitly requested or if strategy changed
    if (includeAutoBid) {
      config.autoBid = autoBid;
    }
    
    console.log('NAH: Sending config update:', { auctionId, config });
    
    chrome.runtime.sendMessage({
      action: 'updateAuctionConfig',
      auctionId: auctionId,
      config: config
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('NAH: Error updating config:', chrome.runtime.lastError);
      } else if (response && response.success) {
        console.log('NAH: Config updated successfully');
      }
    });
  };
  
  // Add change listeners for config updates
  maxBidInput.addEventListener('change', sendConfigUpdate);
  
  // Handle strategy pill clicks
  snipingPill.addEventListener('click', () => {
    if (!snipingPill.classList.contains('active')) {
      snipingPill.classList.add('active');
      manualPill.classList.remove('active');
      
      // Auto-enable auto-bid for sniping strategy
      if (!autoBidToggle.checked) {
        autoBidToggle.checked = true;
        updateAutoBidUI(true, shadowRoot, auctionId);
      }
      
      chrome.runtime.sendMessage({
        action: 'updateAuctionConfig',
        auctionId: auctionId,
        config: {
          maxBid: parseInt(maxBidInput.value) || 0,
          strategy: 'sniping',
          autoBid: true
        }
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('NAH: Error updating strategy:', chrome.runtime.lastError);
        } else if (response && response.success) {
          console.log('NAH: Strategy and autoBid updated successfully');
        }
      });
    }
  });
  
  manualPill.addEventListener('click', () => {
    if (!manualPill.classList.contains('active')) {
      manualPill.classList.add('active');
      snipingPill.classList.remove('active');
      
      chrome.runtime.sendMessage({
        action: 'updateAuctionConfig',
        auctionId: auctionId,
        config: {
          maxBid: parseInt(maxBidInput.value) || 0,
          strategy: 'auto',
          autoBid: autoBidToggle.checked
        }
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('NAH: Error updating strategy:', chrome.runtime.lastError);
        } else if (response && response.success) {
          console.log('NAH: Strategy updated successfully');
        }
      });
    }
  });
  
  // AutoBid toggle handler
  autoBidToggle.addEventListener('change', (e) => {
    const newEnabled = e.target.checked;
    
    // Update UI
    updateAutoBidUI(newEnabled, shadowRoot, auctionId);
    
    // Send update to backend
    chrome.runtime.sendMessage({
      action: 'updateAuctionConfig',
      auctionId: auctionId,
      config: {
        autoBid: newEnabled
      }
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('NAH: Error toggling autoBid:', chrome.runtime.lastError);
      } else if (response && response.success) {
        console.log('NAH: AutoBid toggled successfully to:', newEnabled);
      }
    });
  });
  
  toggle.addEventListener('change', async (e) => {
    console.log('NAH: Monitor toggle changed:', e.target.checked);
    if (e.target.checked) {
      // startMonitoringAuction will handle backend check and UI updates
      startMonitoringAuction(auctionId);
    } else {
      panelBody.style.display = 'none';
      stopMonitoringAuction(auctionId);
      updateMonitoringStatusInShadow(shadowRoot, auctionId, 'Not monitoring');
      // Update floating button
      const floatingRoot = shadowRoots.get(`floating-${auctionId}`);
      if (floatingRoot) {
        const btn = floatingRoot.querySelector('.nah-float-btn');
        if (btn) {
          btn.querySelector('.nah-text').textContent = 'Monitor Auction';
          btn.querySelector('.nah-icon').innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4l2 1" stroke-linecap="round"/>
            </svg>
          `;
          btn.classList.remove('active');
        }
      }
    }
  });
  
  // Initialize autobid UI based on initial strategy
  initializeAutoBidUI();
  
  // Populate panel with initial auction data
  extractAuctionData(auctionId).then(data => {
    if (data) {
      updateAuctionDisplay(auctionId, data);
    }
  }).catch(error => {
    console.log('NAH: Could not extract initial auction data:', error);
  });
}

function addFloatingMonitorButtonWithShadow(auctionId, isMonitored = false) {
  // Check if floating button already exists
  if (document.querySelector(`[data-nah-floating="${auctionId}"]`)) {
    return;
  }
  
  const floatingContainer = document.createElement('div');
  floatingContainer.setAttribute('data-nah-floating', auctionId);
  floatingContainer.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 999999;';
  
  const shadowRoot = floatingContainer.attachShadow({ mode: 'closed' });
  
  const styles = document.createElement('style');
  styles.textContent = `
    .nah-float-btn {
      background: #6366f1;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 9999px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s ease;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    
    .nah-float-btn:hover {
      background: #4f46e5;
      transform: translateY(-2px);
      box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
    }
    
    .nah-float-btn.active {
      background: #10b981;
    }
    
    .nah-float-btn.active:hover {
      background: #059669;
    }
    
    .nah-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
    }
  `;
  
  const button = document.createElement('button');
  button.className = isMonitored ? 'nah-float-btn active' : 'nah-float-btn';
  button.innerHTML = isMonitored 
    ? `<span class="nah-icon">
         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/>
         </svg>
       </span>
       <span class="nah-text">Monitoring Active</span>`
    : `<span class="nah-icon">
         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <circle cx="12" cy="12" r="10"/>
           <path d="M12 8v4l2 1" stroke-linecap="round"/>
         </svg>
       </span>
       <span class="nah-text">Monitor Auction</span>`;
  
  shadowRoot.appendChild(styles);
  shadowRoot.appendChild(button);
  
  button.addEventListener('click', () => {
    const isCurrentlyMonitoring = monitoredAuctions.has(auctionId);
    if (isCurrentlyMonitoring) {
      stopMonitoringAuction(auctionId);
      button.querySelector('.nah-text').textContent = 'Monitor Auction';
      button.querySelector('.nah-icon').innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v4l2 1" stroke-linecap="round"/>
        </svg>
      `;
      button.classList.remove('active');
      // Update checkbox and panel
      const panelRoot = shadowRoots.get(`auction-${auctionId}`);
      if (panelRoot) {
        const checkbox = panelRoot.querySelector(`#nah-monitor-toggle-${auctionId}`);
        const panelBody = panelRoot.querySelector('.nah-panel-body');
        if (checkbox) {
          checkbox.checked = false;
        }
        if (panelBody) {
          panelBody.style.display = 'none';
        }
        updateMonitoringStatusInShadow(panelRoot, auctionId, 'Not monitoring');
      }
    } else {
      startMonitoringAuction(auctionId);
      button.querySelector('.nah-text').textContent = 'Monitoring Active';
      button.querySelector('.nah-icon').innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      button.classList.add('active');
      // Update checkbox and panel
      const panelRoot = shadowRoots.get(`auction-${auctionId}`);
      if (panelRoot) {
        const checkbox = panelRoot.querySelector(`#nah-monitor-toggle-${auctionId}`);
        const panelBody = panelRoot.querySelector('.nah-panel-body');
        if (checkbox) {
          checkbox.checked = true;
        }
        if (panelBody) {
          panelBody.style.display = 'block';
        }
        updateMonitoringStatusInShadow(panelRoot, auctionId, 'Monitoring active');
      }
    }
  });
  
  document.body.appendChild(floatingContainer);
  shadowRoots.set(`floating-${auctionId}`, shadowRoot);
}

function updateMonitoringStatusInShadow(shadowRoot, auctionId, status) {
  const statusElement = shadowRoot.querySelector(`#nah-status-text-${auctionId}`);
  if (statusElement) {
    statusElement.textContent = status;
    statusElement.className = status.includes('active') ? 'active' : '';
  }
}

function updateAutoBidUI(isEnabled, shadowRoot, auctionId) {
  const autoBidToggle = shadowRoot.querySelector(`#nah-autobid-toggle-${auctionId}`);
  const autoBidStatus = shadowRoot.querySelector(`#nah-autobid-status-${auctionId}`);
  
  if (autoBidToggle) {
    autoBidToggle.checked = isEnabled;
  }
  
  if (autoBidStatus) {
    autoBidStatus.dataset.status = isEnabled ? 'active' : 'inactive';
    const statusText = autoBidStatus.querySelector('.nah-status-text');
    if (statusText) {
      statusText.textContent = isEnabled ? 'Active' : 'Paused';
    }
  }
}

function updateMonitoringStatusInAllShadowRoots(auctionId, status) {
  shadowRoots.forEach((shadowRoot, key) => {
    if (key.includes(auctionId)) {
      updateMonitoringStatusInShadow(shadowRoot, auctionId, status);
    }
  });
}

function extractAuctionIdFromUrl() {
  const auctionMatch = window.location.pathname.match(/\/auction\/(\d+)/);
  const productMatch = window.location.pathname.match(/\/p\/[^\/]+\/(\d+)/);
  return auctionMatch ? auctionMatch[1] : (productMatch ? productMatch[1] : null);
}

async function startMonitoringAuction(auctionId) {
  try {
    // Check backend status first
    const backendStatus = await chrome.runtime.sendMessage({ action: 'getBackendStatus' });
    if (!backendStatus?.connected) {
      alert('Backend service is not connected. Please ensure the backend is running to monitor auctions.');
      // Reset UI state
      updateMonitoringUIState(auctionId, false);
      return;
    }
    
    // Get configuration from the panel inputs
    const panelRoot = shadowRoots.get(`auction-${auctionId}`);
    let config = {};
    
    if (panelRoot) {
      const maxBidInput = panelRoot.querySelector(`#nah-max-bid-${auctionId}`);
      const strategySelect = panelRoot.querySelector(`#nah-strategy-${auctionId}`);
      const autoBidToggle = panelRoot.querySelector(`#nah-autobid-toggle-${auctionId}`);
      
      // Get max bid value and validate it
      let maxBidValue = parseInt(maxBidInput?.value || 0);
      
      // If max bid is 0 or invalid, try to set a reasonable default
      if (maxBidValue <= 0) {
        // Try to get the next bid amount as a default
        const nextBidElement = panelRoot.querySelector(`#nah-next-bid-${auctionId}`);
        if (nextBidElement) {
          const text = nextBidElement.textContent || '';
          const parsed = parseFloat(text.replace(/[^0-9.]/g, ''));
          if (!isNaN(parsed) && parsed > 0) {
            maxBidValue = Math.ceil(parsed) + 10; // Next bid + $10 buffer
            if (maxBidInput) {
              maxBidInput.value = maxBidValue;
            }
          }
        }
        
        // If still no valid value, use a reasonable minimum
        if (maxBidValue <= 0) {
          maxBidValue = 10; // $10 minimum default
          if (maxBidInput) {
            maxBidInput.value = maxBidValue;
          }
        }
      }
      
      config.maxBid = maxBidValue;
      config.strategy = strategySelect?.value || 'sniping';
      config.incrementAmount = 1; // Default increment
      
      // Set autoBid based on strategy or toggle state
      const isAutoStrategy = config.strategy !== 'manual';
      config.autoBid = isAutoStrategy || (autoBidToggle?.dataset.enabled === 'true');
      
      // Update UI to reflect autoBid state
      if (isAutoStrategy) {
        updateAutoBidUI(true, panelRoot, auctionId);
      }
    }
    
    const fetchedData = await extractAuctionData(auctionId);
    
    // Add to monitored set before sending message
    monitoredAuctions.add(auctionId);
    
    chrome.runtime.sendMessage({
      action: 'startMonitoring',
      auctionId: auctionId,
      auctionData: fetchedData,
      config: config
    }, (response) => {
      if (chrome.runtime.lastError || !response?.success) {
        console.error('NAH: Error starting monitoring:', chrome.runtime.lastError || response?.error);
        monitoredAuctions.delete(auctionId);
        alert('Failed to start monitoring. ' + (response?.error || 'Please check backend connection.'));
        updateMonitoringUIState(auctionId, false);
      } else {
        console.log('NAH: Monitoring started successfully with config:', config);
        // Update monitoring UI state to show active
        updateMonitoringUIState(auctionId, true);
        // Update displays with initial data
        updateAuctionDisplay(auctionId, fetchedData);
      }
    });
    
    console.log(`NAH: Started monitoring auction ${auctionId}`, fetchedData, config);
  } catch (error) {
    console.error('NAH: Error in startMonitoringAuction:', error);
    monitoredAuctions.delete(auctionId);
    updateMonitoringUIState(auctionId, false);
    alert('Failed to start monitoring: ' + error.message);
  }
}

function stopMonitoringAuction(auctionId) {
  monitoredAuctions.delete(auctionId);
  
  chrome.runtime.sendMessage({
    action: 'stopMonitoring',
    auctionId: auctionId
  });
  
  console.log(`NAH: Stopped monitoring auction ${auctionId}`);
}

function updateMonitoringUIState(auctionId, isMonitoring) {
  // Update detailed monitoring panel checkbox
  const panelRoot = shadowRoots.get(`auction-${auctionId}`);
  if (panelRoot) {
    const checkbox = panelRoot.querySelector(`#nah-monitor-toggle-${auctionId}`);
    if (checkbox) {
      checkbox.checked = isMonitoring;
    }
    const panelBody = panelRoot.querySelector('.nah-panel-body');
    if (panelBody) {
      panelBody.style.display = isMonitoring ? 'block' : 'none';
    }
    updateMonitoringStatusInShadow(panelRoot, auctionId, isMonitoring ? 'Monitoring active' : 'Not monitoring');
  }
  
  // Update floating button
  const floatingRoot = shadowRoots.get(`floating-${auctionId}`);
  if (floatingRoot) {
    const btn = floatingRoot.querySelector('.nah-float-btn');
    if (btn) {
      if (isMonitoring) {
        btn.querySelector('.nah-text').textContent = 'Monitoring Active';
        btn.querySelector('.nah-icon').innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
        btn.classList.add('active');
      } else {
        btn.querySelector('.nah-text').textContent = 'Monitor Auction';
        btn.querySelector('.nah-icon').innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4l2 1" stroke-linecap="round"/>
          </svg>
        `;
        btn.classList.remove('active');
      }
    }
  }
}

async function extractAuctionData(auctionId) {
  try {
    // Try to fetch data from JSON endpoint first
    const response = await fetchAuctionDataFromAPI(auctionId);
    if (response) {
      return {
        ...response,
        url: window.location.href
      };
    }
  } catch (error) {
    // Silently fall back to page scraping
  }
  
  // Fallback to scraping if API fails
  const data = {
    auctionId: auctionId,
    title: '',
    currentBid: 0,
    timeRemaining: 0,
    url: window.location.href
  };
  
  // Get title from h1
  const titleElement = document.querySelector('h1');
  if (titleElement) {
    data.title = titleElement.textContent.trim();
  }
  
  // Find current price - look for "CURRENT PRICE" text and get next element
  const allElements = document.querySelectorAll('p, span, div, strong');
  for (let i = 0; i < allElements.length; i++) {
    const elem = allElements[i];
    if (elem.textContent.trim() === 'CURRENT PRICE') {
      // Look for price in next sibling or parent's next child
      let priceElem = elem.nextElementSibling || 
                      (elem.parentElement && elem.parentElement.nextElementSibling);
      
      if (priceElem) {
        const priceText = priceElem.textContent.trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
        if (!isNaN(price)) {
          data.currentBid = price;
          break;
        }
      }
    }
  }
  
  // Find time remaining
  for (let i = 0; i < allElements.length; i++) {
    const elem = allElements[i];
    if (elem.textContent.trim() === 'Time Left') {
      const nextElem = elem.nextElementSibling || 
                      (elem.parentElement && elem.parentElement.nextElementSibling);
      if (nextElem) {
        const timeText = nextElem.textContent.trim();
        data.timeRemaining = parseTimeRemaining(timeText);
        break;
      }
    }
  }
  
  return data;
}

async function fetchAuctionDataFromAPI(auctionId) {
  try {
    // Extract product ID from various formats
    const productId = auctionId.toString().replace(/[^0-9]/g, '');
    
    // Use the _data parameter to get JSON
    const url = `${window.location.origin}${window.location.pathname}?_data=routes/p.$title.$productId._index`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      credentials: 'same-origin'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Parse the data structure
    if (data && data.product) {
      const product = data.product;
      
      const timeRemaining = calculateTimeRemaining(product.closeTime?.value);
      const isClosed = product.isClosed || product.marketStatus === 'sold' || timeRemaining <= 0;
      
      return {
        auctionId: product.id,
        title: product.title,
        currentBid: product.currentPrice || 0,
        nextBid: product.userState?.nextBid || product.currentPrice + 1,
        bidCount: product.bidCount || 0,
        bidderCount: product.bidderCount || 0,
        isWinning: product.userState?.isWinning || false,
        isWatching: product.userState?.isWatching || false,
        isClosed: isClosed,
        marketStatus: product.marketStatus,
        closeTime: product.closeTime?.value,
        extensionInterval: product.extensionInterval || 30,
        retailPrice: product.retailPrice,
        inventoryNumber: product.inventoryNumber,
        location: product.location,
        watchlistCount: product.watchlistCount || 0,
        timeRemaining: timeRemaining,
        imageUrl: product.photos?.[0]?.url || null
      };
    }
    
    return null;
    
  } catch (error) {
    console.error('NAH: Error fetching auction data:', error);
    return null;
  }
}

function calculateTimeRemaining(closeTimeString) {
  if (!closeTimeString) return 0;
  
  const closeTime = new Date(closeTimeString);
  const now = new Date();
  const diff = closeTime - now;
  
  return Math.max(0, Math.floor(diff / 1000)); // Return seconds
}

function parseTimeRemaining(timeText) {
  const patterns = [
    { regex: /(\d+)\s*hours?/, units: [3600] },
    { regex: /(\d+)\s*minutes?/, units: [60] },
    { regex: /(\d+)\s*seconds?/, units: [1] },
    { regex: /(\d+)h\s*(\d+)m\s*(\d+)s/, units: [3600, 60, 1] },
    { regex: /(\d+):(\d+):(\d+)/, units: [3600, 60, 1] },
    { regex: /(\d+)m\s*(\d+)s/, units: [60, 1] },
    { regex: /(\d+)s/, units: [1] }
  ];
  
  for (const pattern of patterns) {
    const match = timeText.match(pattern.regex);
    if (match) {
      let seconds = 0;
      for (let i = 1; i < match.length; i++) {
        seconds += parseInt(match[i]) * pattern.units[i - 1];
      }
      return seconds;
    }
  }
  
  return 0;
}

function detectAuctionItems() {
  // Implementation for search/browse pages would go here
  console.log('NAH: Detecting auction items on browse page');
}

// Keep track of page observer to avoid duplicates
let pageObserver = null;

function observePageChanges() {
  // Clean up existing observer if any
  if (pageObserver) {
    pageObserver.disconnect();
  }
  
  pageObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1 && !node.classList?.contains(NAH_SHADOW_HOST)) {
            detectAuctionItems();
          }
        });
      }
    });
  });
  
  pageObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function removeAllIndicators() {
  // Remove all shadow hosts
  document.querySelectorAll(`.${NAH_SHADOW_HOST}`).forEach(el => el.remove());
  document.querySelectorAll('[data-nah-floating]').forEach(el => el.remove());
  shadowRoots.clear();
  
  // Disconnect page observer if exists
  if (pageObserver) {
    pageObserver.disconnect();
    pageObserver = null;
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'auctionState':
      // Replace entire auction state from backend
      if (request.auction) {
        handleAuctionState(request.auction);
      }
      sendResponse({ success: true });
      break;
      
    case 'checkAuctionStatus':
      extractAuctionData(request.auctionId).then(data => {
        sendResponse(data);
      }).catch(error => {
        console.error('NAH: Error checking auction status:', error);
        sendResponse(null);
      });
      return true; // Keep message channel open for async response
      
    case 'allMonitoringCleared':
      // Clear all monitored auctions from UI
      console.log('NAH: All monitoring cleared, updating UI');
      monitoredAuctions.clear();
      
      // Update all monitoring UI elements to show as not monitored
      shadowRoots.forEach((shadowRoot, key) => {
        // Extract auction ID from the key (e.g., "auction-12345" or "floating-12345")
        const match = key.match(/(?:auction|floating)-(\d+)/);
        if (match) {
          const auctionId = match[1];
          
          // Update panel UI
          if (key.startsWith('auction-')) {
            const checkbox = shadowRoot.querySelector(`#nah-monitor-toggle-${auctionId}`);
            if (checkbox) {
              checkbox.checked = false;
            }
            const panelBody = shadowRoot.querySelector('.nah-panel-body');
            if (panelBody) {
              panelBody.style.display = 'none';
            }
            updateMonitoringStatusInShadow(shadowRoot, auctionId, 'Not monitoring');
          }
          
          // Update floating button UI
          if (key.startsWith('floating-')) {
            const btn = shadowRoot.querySelector('.nah-float-btn');
            if (btn && !btn.disabled) {
              btn.querySelector('.nah-text').textContent = 'Monitor Auction';
              btn.querySelector('.nah-icon').innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 8v4l2 1" stroke-linecap="round"/>
                </svg>
              `;
              btn.classList.remove('active');
            }
          }
        }
      });
      
      sendResponse({ success: true });
      break;
  }
  return true;
});

function handleAuctionState(auction) {
  console.log('NAH: Received auction state:', auction.id);
  
  // Update monitored state
  if (auction.status === 'monitoring') {
    monitoredAuctions.add(auction.id);
  } else {
    monitoredAuctions.delete(auction.id);
  }
  
  // Update all UI elements with full state
  updateAuctionDisplay(auction.id, auction);
}

function updateAuctionDisplay(auctionId, data) {
  // Update displays in all shadow roots
  shadowRoots.forEach((shadowRoot, key) => {
    if (key.includes(auctionId)) {
      const currentBidElement = shadowRoot.querySelector(`#nah-current-bid-${auctionId}`);
      if (currentBidElement && data.currentBid !== undefined) {
        currentBidElement.textContent = `$${data.currentBid.toFixed(2)}`;
      }
      
      const nextBidElement = shadowRoot.querySelector(`#nah-next-bid-${auctionId}`);
      if (nextBidElement && data.nextBid !== undefined) {
        nextBidElement.textContent = `$${data.nextBid.toFixed(2)}`;
        
        // Auto-populate max bid with a reasonable default if not already set
        const maxBidInput = shadowRoot.querySelector(`#nah-max-bid-${auctionId}`);
        if (maxBidInput && (!maxBidInput.value || maxBidInput.value === '0')) {
          const suggestedMaxBid = Math.ceil(data.nextBid) + 10; // Next bid + $10 buffer
          maxBidInput.value = suggestedMaxBid;
          maxBidInput.placeholder = suggestedMaxBid.toString();
        }
      }
      
      const timeLeftElement = shadowRoot.querySelector(`#nah-time-left-${auctionId}`);
      if (timeLeftElement && data.timeRemaining !== undefined) {
        timeLeftElement.textContent = formatTimeRemaining(data.timeRemaining);
        // Add visual indicator for 30-second rule
        if (data.timeRemaining <= 30 && data.timeRemaining > 0) {
          timeLeftElement.style.color = '#e74c3c';
          timeLeftElement.style.fontWeight = 'bold';
        } else {
          timeLeftElement.style.color = '';
          timeLeftElement.style.fontWeight = '';
        }
      }
      
      const bidderCountElement = shadowRoot.querySelector(`#nah-bidder-count-${auctionId}`);
      if (bidderCountElement && data.bidderCount !== undefined) {
        bidderCountElement.textContent = data.bidderCount;
      }
      
      const lastUpdateElement = shadowRoot.querySelector(`#nah-last-update-${auctionId}`);
      if (lastUpdateElement) {
        lastUpdateElement.textContent = `Updated - ${new Date().toLocaleTimeString()}`;
      }
      
      if (data.status) {
        updateMonitoringStatusInShadow(shadowRoot, auctionId, data.status);
      }
      
      // Update config values if provided
      if (data.config) {
        const maxBidInput = shadowRoot.querySelector(`#nah-max-bid-${auctionId}`);
        if (maxBidInput && data.config.maxBid !== undefined) {
          maxBidInput.value = data.config.maxBid;
          // Validate after updating value
          validateMaxBidInExtension(auctionId, maxBidInput);
        }
        
        // Update strategy pills
        if (data.config.strategy) {
          const snipingPill = shadowRoot.querySelector(`#nah-strategy-sniping-${auctionId}`);
          const manualPill = shadowRoot.querySelector(`#nah-strategy-manual-${auctionId}`);
          
          if (snipingPill && manualPill) {
            // Map backend strategy names to UI strategy names
            // Backend uses 'increment' but UI uses 'manual'
            if (data.config.strategy === 'sniping') {
              snipingPill.classList.add('active');
              manualPill.classList.remove('active');
            } else if (data.config.strategy === 'auto') {
              manualPill.classList.add('active');
              snipingPill.classList.remove('active');
            }
          }
        }
        
        // Update autobid UI if autoBid status is provided
        if (data.config.autoBid !== undefined) {
          updateAutoBidUI(data.config.autoBid, shadowRoot, auctionId);
        }
      }
      
      // Update max bid validation when nextBid changes
      if (data.nextBid !== undefined) {
        const maxBidInput = shadowRoot.querySelector(`#nah-max-bid-${auctionId}`);
        if (maxBidInput) {
          validateMaxBidInExtension(auctionId, maxBidInput);
        }
      }
      
      // Update status if auction is closed
      if (data.isClosed || data.status === 'ended') {
        updateMonitoringStatusInShadow(shadowRoot, auctionId, 'Auction ended');
        // Disable the monitoring checkbox
        const checkbox = shadowRoot.querySelector(`#nah-monitor-toggle-${auctionId}`);
        if (checkbox) {
          checkbox.checked = false;
          checkbox.disabled = true;
        }
        // Update floating button
        const floatingRoot = shadowRoots.get(`floating-${auctionId}`);
        if (floatingRoot) {
          const btn = floatingRoot.querySelector('.nah-float-btn');
          if (btn) {
            btn.querySelector('.nah-text').textContent = 'Auction Ended';
            btn.querySelector('.nah-icon').textContent = '⏱️';
            btn.classList.remove('active');
            btn.disabled = true;
            btn.style.opacity = '0.6';
            btn.style.cursor = 'not-allowed';
          }
        }
      }
    }
  });
}

function validateMaxBidInExtension(auctionId, inputElement, showAlert = false) {
  // Get the current auction data to find minimum bid
  let minimumBid = 0;
  
  // Look for nextBid in shadow DOM displays
  shadowRoots.forEach((shadowRoot, key) => {
    if (key.includes(auctionId)) {
      const nextBidElement = shadowRoot.querySelector(`#nah-next-bid-${auctionId}`);
      if (nextBidElement) {
        const text = nextBidElement.textContent || '';
        const parsed = parseFloat(text.replace(/[^0-9.]/g, ''));
        if (!isNaN(parsed)) {
          minimumBid = Math.ceil(parsed); // Round up for whole dollar bids
        }
      }
    }
  });
  
  const maxBid = parseInt(inputElement.value) || 0;
  
  // Update input attributes
  if (minimumBid > 0) {
    inputElement.min = minimumBid;
    inputElement.title = `Minimum bid: $${minimumBid}`;
    inputElement.placeholder = minimumBid.toString();
  }
  
  // Validate the value
  if (maxBid > 0 && maxBid < minimumBid) {
    // Visual feedback
    inputElement.style.borderColor = '#e74c3c';
    inputElement.style.backgroundColor = '#ffeaea';
    
    if (showAlert) {
      alert(`Maximum bid must be at least $${minimumBid} (the minimum next bid)`);
      inputElement.value = minimumBid;
      inputElement.style.borderColor = '';
      inputElement.style.backgroundColor = '';
    }
    
    return false;
  } else {
    // Clear error styling
    inputElement.style.borderColor = '';
    inputElement.style.backgroundColor = '';
    return true;
  }
}

function formatTimeRemaining(seconds) {
  if (seconds <= 0) return 'Ended';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

console.log('NAH: Content script initialization complete');