const { chromium } = require('playwright');

async function monitorNellisWithPlaywright() {
  console.log('=== Nellis Auction Network Monitor (Playwright) ===\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true 
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Track network requests
  const networkLog = {
    requests: [],
    responses: [],
    websockets: [],
    sse: []
  };
  
  // Monitor all requests
  page.on('request', request => {
    const url = request.url();
    const method = request.method();
    const resourceType = request.resourceType();
    
    if (url.includes('sse.nellisauction.com') || 
        url.includes('/api/') || 
        url.includes('auction') ||
        url.includes('bid') ||
        resourceType === 'fetch' ||
        resourceType === 'xhr') {
      
      console.log(`[${method}] ${resourceType} - ${url}`);
      networkLog.requests.push({
        url,
        method,
        resourceType,
        headers: request.headers(),
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Monitor responses
  page.on('response', response => {
    const url = response.url();
    const status = response.status();
    
    if (url.includes('sse.nellisauction.com') || 
        url.includes('/api/') || 
        url.includes('auction') ||
        url.includes('bid')) {
      
      console.log(`[RESPONSE] ${status} - ${url}`);
      networkLog.responses.push({
        url,
        status,
        headers: response.headers(),
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Inject monitoring for WebSocket and SSE
  await page.addInitScript(() => {
    // Monitor WebSocket
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(...args) {
      console.log('[WEBSOCKET] Creating connection:', args[0]);
      const ws = new originalWebSocket(...args);
      
      ws.addEventListener('open', () => {
        console.log('[WEBSOCKET] Opened:', args[0]);
      });
      
      ws.addEventListener('message', (event) => {
        console.log('[WEBSOCKET] Message:', event.data.substring(0, 200));
      });
      
      ws.addEventListener('close', (event) => {
        console.log('[WEBSOCKET] Closed:', args[0], 'Code:', event.code);
      });
      
      return ws;
    };
    
    // Monitor EventSource (SSE)
    const originalEventSource = window.EventSource;
    window.EventSource = function(...args) {
      console.log('[SSE] Creating connection:', args[0]);
      const es = new originalEventSource(...args);
      
      es.addEventListener('open', () => {
        console.log('[SSE] Opened:', args[0]);
      });
      
      es.addEventListener('message', (event) => {
        console.log('[SSE] Message:', event.data.substring(0, 200));
      });
      
      es.addEventListener('error', (event) => {
        console.log('[SSE] Error:', args[0]);
      });
      
      // Monitor custom event types
      const originalAddEventListener = es.addEventListener;
      es.addEventListener = function(type, listener, options) {
        if (type !== 'open' && type !== 'message' && type !== 'error') {
          console.log('[SSE] Custom event type registered:', type);
        }
        return originalAddEventListener.call(this, type, listener, options);
      };
      
      return es;
    };
  });
  
  // Navigate to auction page
  console.log('Navigating to Nellis Auction...\n');
  await page.goto('https://www.nellisauction.com/browse', { 
    waitUntil: 'networkidle' 
  });
  
  // Try to find and click on an active auction item
  console.log('Looking for active auction items...\n');
  try {
    // Wait for auction items to load
    await page.waitForSelector('a[href*="/products/"]', { timeout: 5000 });
    
    // Click on the first auction item
    const firstItem = await page.$('a[href*="/products/"]');
    if (firstItem) {
      const href = await firstItem.getAttribute('href');
      console.log(`Navigating to auction item: ${href}\n`);
      await firstItem.click();
      await page.waitForLoadState('networkidle');
    }
  } catch (e) {
    console.log('No auction items found or timeout occurred\n');
  }
  
  // Monitor for 30 seconds
  console.log('Monitoring network activity for 30 seconds...\n');
  await page.waitForTimeout(30000);
  
  // Summary
  console.log('\n=== Network Activity Summary ===');
  console.log(`Total Requests: ${networkLog.requests.length}`);
  console.log(`Total Responses: ${networkLog.responses.length}`);
  
  // Analyze patterns
  const apiEndpoints = [...new Set(networkLog.requests
    .filter(r => r.url.includes('/api/') || r.url.includes('sse.'))
    .map(r => new URL(r.url).pathname))];
  
  if (apiEndpoints.length > 0) {
    console.log('\nAPI Endpoints detected:');
    apiEndpoints.forEach(endpoint => console.log(`  - ${endpoint}`));
  }
  
  console.log('\nBrowser remains open for inspection. Press Ctrl+C to exit.');
}

// Check if playwright is installed
try {
  require.resolve('playwright');
  monitorNellisWithPlaywright().catch(console.error);
} catch(e) {
  console.log('Playwright not installed. Install it with:');
  console.log('npm install playwright');
  console.log('\nThen install browsers with:');
  console.log('npx playwright install chromium');
}