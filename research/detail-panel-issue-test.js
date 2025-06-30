const { chromium } = require('playwright');

/**
 * Test script to reproduce the detail panel loading issue on nellisauction.com
 * 
 * Issue: Detail panel sometimes doesn't load until page is refreshed
 * This script attempts to reproduce the issue by navigating to auction items
 * in different ways to identify patterns.
 */

async function testDetailPanelLoading() {
  console.log('=== Testing Detail Panel Loading Issue ===\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[Console ERROR] ${msg.text()}`);
    }
  });
  
  // Track navigation events
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) {
      console.log(`[Navigation] ${frame.url()}`);
    }
  });
  
  // Monitor network failures
  page.on('requestfailed', request => {
    console.log(`[Request Failed] ${request.url()} - ${request.failure().errorText}`);
  });
  
  // Test scenarios
  const testScenarios = [
    {
      name: 'Direct navigation to detail page',
      test: async () => {
        console.log('\n--- Test 1: Direct navigation ---');
        await page.goto('https://www.nellisauction.com');
        await page.waitForLoadState('networkidle');
        
        // Get a product URL from the homepage
        const productLink = await page.$eval('a[href*="/p/"]', el => el.href);
        console.log(`Navigating directly to: ${productLink}`);
        
        await page.goto(productLink);
        await page.waitForLoadState('networkidle');
        await checkDetailPanel(page);
      }
    },
    {
      name: 'Click navigation from homepage',
      test: async () => {
        console.log('\n--- Test 2: Click navigation from homepage ---');
        await page.goto('https://www.nellisauction.com');
        await page.waitForLoadState('networkidle');
        
        // Click on first product
        console.log('Clicking on first product...');
        await page.click('a[href*="/p/"]:first-child');
        await page.waitForLoadState('networkidle');
        await checkDetailPanel(page);
      }
    },
    {
      name: 'Navigation from search results',
      test: async () => {
        console.log('\n--- Test 3: Navigation from search results ---');
        await page.goto('https://www.nellisauction.com/search');
        await page.waitForLoadState('networkidle');
        
        // Wait for products to load
        await page.waitForSelector('a[href*="/p/"]', { timeout: 10000 });
        
        console.log('Clicking on first search result...');
        await page.click('a[href*="/p/"]:first-child');
        await page.waitForLoadState('networkidle');
        await checkDetailPanel(page);
      }
    },
    {
      name: 'Multiple quick navigations',
      test: async () => {
        console.log('\n--- Test 4: Multiple quick navigations ---');
        await page.goto('https://www.nellisauction.com');
        await page.waitForLoadState('networkidle');
        
        // Get multiple product links
        const productLinks = await page.$$eval('a[href*="/p/"]', 
          els => els.slice(0, 3).map(el => el.href)
        );
        
        for (let i = 0; i < productLinks.length; i++) {
          console.log(`Quick navigation ${i + 1} to: ${productLinks[i]}`);
          await page.goto(productLinks[i]);
          // Don't wait for full load - simulate quick navigation
          await page.waitForTimeout(500);
        }
        
        await page.waitForLoadState('networkidle');
        await checkDetailPanel(page);
      }
    },
    {
      name: 'Back button navigation',
      test: async () => {
        console.log('\n--- Test 5: Back button navigation ---');
        await page.goto('https://www.nellisauction.com');
        await page.waitForLoadState('networkidle');
        
        // Navigate to a product
        await page.click('a[href*="/p/"]:first-child');
        await page.waitForLoadState('networkidle');
        
        // Go back
        console.log('Going back...');
        await page.goBack();
        await page.waitForLoadState('networkidle');
        
        // Click another product
        console.log('Clicking second product...');
        await page.click('a[href*="/p/"]:nth-child(2)');
        await page.waitForLoadState('networkidle');
        await checkDetailPanel(page);
      }
    }
  ];
  
  // Run all test scenarios
  for (const scenario of testScenarios) {
    try {
      await scenario.test();
    } catch (error) {
      console.error(`Error in scenario "${scenario.name}":`, error.message);
    }
    
    // Wait between tests
    await page.waitForTimeout(2000);
  }
  
  // Additional diagnostics
  console.log('\n=== Additional Diagnostics ===');
  await runDiagnostics(page);
  
  console.log('\n=== Test Complete ===');
  console.log('Keep browser open to inspect...');
  
  // Keep browser open for manual inspection
  await page.pause();
}

async function checkDetailPanel(page) {
  console.log('Checking for detail panel...');
  
  try {
    // Check if the page has the expected structure
    const hasTitle = await page.$('h1');
    const hasBidButton = await page.$('button:has-text("BID"), button:has-text("LOGIN")');
    const hasPrice = await page.$('text=/CURRENT PRICE|Current Price/i');
    
    console.log('Page elements found:');
    console.log(`  - Title (h1): ${!!hasTitle}`);
    console.log(`  - Bid button: ${!!hasBidButton}`);
    console.log(`  - Price element: ${!!hasPrice}`);
    
    // Check for common issues
    const errors = await page.$$eval('body', bodies => {
      const body = bodies[0];
      const issues = [];
      
      // Check if body is empty or has very little content
      if (body.textContent.trim().length < 100) {
        issues.push('Page appears to have very little content');
      }
      
      // Check for loading indicators
      const loadingElements = body.querySelectorAll('[class*="loading"], [class*="spinner"]');
      if (loadingElements.length > 0) {
        issues.push(`Found ${loadingElements.length} loading indicators`);
      }
      
      // Check for error messages
      const errorElements = body.querySelectorAll('[class*="error"], [class*="Error"]');
      if (errorElements.length > 0) {
        issues.push(`Found ${errorElements.length} error elements`);
      }
      
      return issues;
    });
    
    if (errors.length > 0) {
      console.log('Potential issues found:');
      errors.forEach(issue => console.log(`  - ${issue}`));
    }
    
    // Check React/framework specific issues
    const reactRoot = await page.$('#root, #app, [data-reactroot]');
    if (reactRoot) {
      const isEmpty = await reactRoot.evaluate(el => el.children.length === 0);
      if (isEmpty) {
        console.log('  - React/App root element is empty!');
      }
    }
    
    // Check for our extension's shadow DOM
    const extensionPanel = await page.$('[data-nah-id]');
    console.log(`  - Extension panel present: ${!!extensionPanel}`);
    
  } catch (error) {
    console.error('Error checking detail panel:', error.message);
  }
}

async function runDiagnostics(page) {
  // Check for JavaScript errors
  const jsErrors = await page.evaluate(() => {
    return window.COLLECTED_ERRORS || [];
  });
  
  if (jsErrors.length > 0) {
    console.log('\nJavaScript errors detected:');
    jsErrors.forEach(err => console.log(`  - ${err}`));
  }
  
  // Check for failed network requests
  console.log('\nChecking for common API endpoints...');
  const apiPatterns = [
    '/api/',
    '/graphql',
    '/_data',
    '/products/',
    '/auction/'
  ];
  
  for (const pattern of apiPatterns) {
    const requests = await page.evaluate((pattern) => {
      return performance.getEntriesByType('resource')
        .filter(entry => entry.name.includes(pattern))
        .map(entry => ({
          url: entry.name,
          status: entry.responseStatus || 'unknown',
          duration: entry.duration
        }));
    }, pattern);
    
    if (requests.length > 0) {
      console.log(`  ${pattern} requests:`, requests.length);
      requests.forEach(req => {
        if (req.status >= 400 || req.status === 'unknown') {
          console.log(`    - ${req.url} (${req.status})`);
        }
      });
    }
  }
  
  // Check for DOM mutation activity
  const mutationActivity = await page.evaluate(() => {
    return new Promise(resolve => {
      let mutationCount = 0;
      const observer = new MutationObserver(() => mutationCount++);
      observer.observe(document.body, { childList: true, subtree: true });
      
      setTimeout(() => {
        observer.disconnect();
        resolve(mutationCount);
      }, 1000);
    });
  });
  
  console.log(`\nDOM mutations in 1 second: ${mutationActivity}`);
  
  // Check page timing
  const timing = await page.evaluate(() => {
    const perf = window.performance.timing;
    return {
      domContentLoaded: perf.domContentLoadedEventEnd - perf.navigationStart,
      loadComplete: perf.loadEventEnd - perf.navigationStart
    };
  });
  
  console.log('\nPage timing:');
  console.log(`  - DOM Content Loaded: ${timing.domContentLoaded}ms`);
  console.log(`  - Load Complete: ${timing.loadComplete}ms`);
}

// Inject error collection
async function injectErrorCollection(page) {
  await page.addInitScript(() => {
    window.COLLECTED_ERRORS = [];
    window.addEventListener('error', (e) => {
      window.COLLECTED_ERRORS.push(`${e.message} at ${e.filename}:${e.lineno}:${e.colno}`);
    });
    window.addEventListener('unhandledrejection', (e) => {
      window.COLLECTED_ERRORS.push(`Unhandled rejection: ${e.reason}`);
    });
  });
}

// Run the test
testDetailPanelLoading().catch(console.error);