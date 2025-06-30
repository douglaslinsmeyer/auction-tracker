/**
 * Proposed fix for the detail panel loading issue
 * This code should replace or enhance the existing detectSingleAuction() function
 * in content-isolated.js
 */

// Enhanced auction detection with retry logic and dynamic element waiting
async function detectSingleAuctionEnhanced() {
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
    const observer = new MutationObserver(() => {
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
        hasPrice: !!document.querySelector('*:has-text("CURRENT PRICE"), *:has-text("Current Price")'),
        hasProductContainer: !!document.querySelector('main > div, article, [role="main"]')
      };
      
      const requiredElements = Object.values(checks).filter(Boolean).length;
      const isReady = requiredElements >= 3; // At least 3 out of 4 elements
      
      if (!isReady && retryCount % 5 === 0) {
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
      const priceElement = document.querySelector('*:has-text("CURRENT PRICE")');
      if (priceElement) {
        let container = priceElement.closest('div[class*="col"], div[class*="section"], section');
        return container || priceElement.parentElement;
      }
      return null;
    },
    
    // Strategy 3: Find main product container
    () => {
      const productContainer = document.querySelector(
        '[class*="product-detail"], [class*="auction-detail"], main > div:has(h1)'
      );
      return productContainer;
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
  
  // Monitor fetch requests for data updates
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    
    if (typeof url === 'string' && (url.includes('_data') || url.includes(`/${auctionId}`))) {
      lastDataFetch = Date.now();
      
      return originalFetch.apply(this, args).then(response => {
        // Clone response to read it
        response.clone().json().then(data => {
          console.log('NAH: Auction data fetched, updating display');
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
      console.log('NAH: Refreshing auction data');
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
    detectSingleAuctionEnhanced();
  }, delay);
  
  retryQueue.set(auctionId, timeout);
}

// Enhanced navigation handler
function handleNavigationEnhanced() {
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

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    detectSingleAuctionEnhanced,
    waitForAuctionPageElements,
    findSuitableContainer,
    observeForDataUpdates,
    handleNavigationEnhanced
  };
}