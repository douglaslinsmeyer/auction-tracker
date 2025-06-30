/**
 * Diagnostic script to analyze the extension's behavior during navigation
 * This script should be injected into the page to monitor how the extension
 * handles different navigation scenarios on nellisauction.com
 */

(function() {
  console.log('=== Extension Navigation Diagnostic Started ===');
  
  // Track navigation events
  const navigationLog = [];
  const extensionLog = [];
  
  // Helper to log with timestamp
  function log(type, message, data = {}) {
    const entry = {
      timestamp: Date.now(),
      type,
      message,
      data,
      url: window.location.href,
      readyState: document.readyState
    };
    
    if (type === 'navigation') {
      navigationLog.push(entry);
    } else {
      extensionLog.push(entry);
    }
    
    console.log(`[${type.toUpperCase()}] ${message}`, data);
  }
  
  // Monitor URL changes
  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      log('navigation', 'URL changed via MutationObserver', { 
        from: lastUrl, 
        to: url 
      });
      checkExtensionState();
    }
  });
  urlObserver.observe(document, { subtree: true, childList: true });
  
  // Monitor history API
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function() {
    log('navigation', 'pushState called', { arguments: Array.from(arguments) });
    originalPushState.apply(history, arguments);
    setTimeout(() => checkExtensionState(), 100);
  };
  
  history.replaceState = function() {
    log('navigation', 'replaceState called', { arguments: Array.from(arguments) });
    originalReplaceState.apply(history, arguments);
    setTimeout(() => checkExtensionState(), 100);
  };
  
  window.addEventListener('popstate', () => {
    log('navigation', 'popstate event fired');
    setTimeout(() => checkExtensionState(), 100);
  });
  
  // Monitor page lifecycle events
  document.addEventListener('DOMContentLoaded', () => {
    log('navigation', 'DOMContentLoaded fired');
    checkExtensionState();
  });
  
  window.addEventListener('load', () => {
    log('navigation', 'window load fired');
    checkExtensionState();
  });
  
  // Monitor for extension elements
  function checkExtensionState() {
    const checks = {
      shadowHosts: document.querySelectorAll('[data-nah-id]').length,
      floatingButtons: document.querySelectorAll('[data-nah-floating]').length,
      nahShadowHosts: document.querySelectorAll('.nah-ext-2024-shadow-host').length,
      detailPanelContainer: null,
      bidButton: null,
      productData: null
    };
    
    // Check if we're on a detail page
    const isDetailPage = window.location.pathname.match(/\/p\/[^\/]+\/\d+/);
    if (isDetailPage) {
      // Look for key elements that the extension needs
      checks.bidButton = !!Array.from(document.querySelectorAll('button')).find(
        btn => {
          const text = btn.textContent.trim();
          return text === 'PLACE BID' || text === 'RAISE BID' || text.includes('LOGIN TO BID');
        }
      );
      
      // Check for product data
      const h1 = document.querySelector('h1');
      checks.productData = {
        hasTitle: !!h1,
        title: h1?.textContent || 'none',
        hasPrice: !!document.querySelector('p:has-text("CURRENT PRICE"), span:has-text("CURRENT PRICE")')
      };
      
      // Look for potential container elements
      const containers = document.querySelectorAll('main > div, #root > div > div');
      checks.detailPanelContainer = containers.length;
    }
    
    log('extension', 'Extension state check', checks);
    
    // Check for timing issues
    if (isDetailPage && checks.shadowHosts === 0) {
      log('extension', 'WARNING: No extension shadow hosts found on detail page');
      
      // Try to identify why
      const possibleReasons = [];
      
      if (!checks.bidButton) {
        possibleReasons.push('Bid button not found - page may not be fully loaded');
      }
      
      if (document.readyState !== 'complete') {
        possibleReasons.push(`Document readyState is "${document.readyState}" - not complete`);
      }
      
      // Check for loading indicators
      const loadingIndicators = document.querySelectorAll('[class*="loading"], [class*="spinner"], [class*="skeleton"]');
      if (loadingIndicators.length > 0) {
        possibleReasons.push(`Found ${loadingIndicators.length} loading indicators`);
      }
      
      // Check React root
      const reactRoot = document.querySelector('#root, [data-reactroot]');
      if (reactRoot && reactRoot.children.length === 0) {
        possibleReasons.push('React root element is empty');
      }
      
      if (possibleReasons.length > 0) {
        log('extension', 'Possible reasons for missing extension UI', possibleReasons);
      }
      
      // Schedule recheck
      setTimeout(() => {
        log('extension', 'Rechecking after delay...');
        checkExtensionState();
      }, 2000);
    }
  }
  
  // Monitor DOM mutations for dynamic content
  const contentObserver = new MutationObserver((mutations) => {
    let significantChange = false;
    
    for (const mutation of mutations) {
      // Look for significant additions
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) { // Element node
            // Check if it's a significant element
            if (node.matches && (
              node.matches('main, article, section, [role="main"]') ||
              node.querySelector && node.querySelector('h1, button, [class*="product"], [class*="auction"]')
            )) {
              significantChange = true;
              break;
            }
          }
        }
      }
    }
    
    if (significantChange) {
      log('extension', 'Significant DOM change detected');
      checkExtensionState();
    }
  });
  
  contentObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Monitor network activity for page data loading
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    
    if (url.includes('_data') || url.includes('/api/') || url.includes('/products/')) {
      log('navigation', 'Data fetch detected', { url });
      
      return originalFetch.apply(this, args).then(response => {
        response.clone().json().then(data => {
          log('navigation', 'Data fetch completed', { 
            url, 
            status: response.status,
            hasData: !!data 
          });
          setTimeout(() => checkExtensionState(), 500);
        }).catch(() => {
          // Not JSON, ignore
        });
        return response;
      });
    }
    
    return originalFetch.apply(this, args);
  };
  
  // Periodic check for extension health
  setInterval(() => {
    const isDetailPage = window.location.pathname.match(/\/p\/[^\/]+\/\d+/);
    if (isDetailPage) {
      const hasExtension = document.querySelector('[data-nah-id]');
      if (!hasExtension) {
        log('extension', 'ALERT: Extension UI missing on detail page during periodic check');
      }
    }
  }, 5000);
  
  // Expose diagnostic data globally
  window.NAH_DIAGNOSTIC = {
    navigationLog,
    extensionLog,
    checkState: checkExtensionState,
    report: function() {
      console.log('=== Navigation Diagnostic Report ===');
      console.log('Navigation Events:', navigationLog.length);
      console.log('Extension Events:', extensionLog.length);
      
      // Find issues
      const issues = extensionLog.filter(e => 
        e.message.includes('WARNING') || 
        e.message.includes('ALERT') ||
        e.message.includes('missing')
      );
      
      if (issues.length > 0) {
        console.log('\nIssues Found:');
        issues.forEach(issue => {
          console.log(`  - ${new Date(issue.timestamp).toLocaleTimeString()}: ${issue.message}`);
        });
      }
      
      return {
        navigationLog,
        extensionLog,
        issues
      };
    }
  };
  
  // Initial check
  checkExtensionState();
  
  console.log('Diagnostic script loaded. Use window.NAH_DIAGNOSTIC.report() to see results.');
})();