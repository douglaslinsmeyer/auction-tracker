const puppeteer = require('puppeteer');

async function monitorNellisAuction() {
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true 
  });
  
  const page = await browser.newPage();
  
  // Enable request interception
  await page.setRequestInterception(true);
  
  // Monitor all network requests
  const requests = {
    xhr: [],
    fetch: [],
    websocket: [],
    eventSource: []
  };
  
  // Track XHR and Fetch requests
  page.on('request', request => {
    const url = request.url();
    const resourceType = request.resourceType();
    
    if (resourceType === 'xhr' || resourceType === 'fetch') {
      console.log(`[${resourceType.toUpperCase()}] ${request.method()} ${url}`);
      requests[resourceType].push({
        url,
        method: request.method(),
        headers: request.headers(),
        timestamp: new Date().toISOString()
      });
    }
    
    request.continue();
  });
  
  // Monitor responses
  page.on('response', response => {
    const url = response.url();
    const status = response.status();
    
    if (url.includes('sse.nellisauction.com') || 
        url.includes('/api/') || 
        url.includes('auction') ||
        url.includes('bid')) {
      console.log(`[RESPONSE] ${status} ${url}`);
    }
  });
  
  // Monitor WebSocket connections
  await page.evaluateOnNewDocument(() => {
    // Override WebSocket constructor
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(...args) {
      console.log('[WEBSOCKET] Creating connection:', args[0]);
      const ws = new originalWebSocket(...args);
      
      ws.addEventListener('open', () => {
        console.log('[WEBSOCKET] Connection opened:', args[0]);
      });
      
      ws.addEventListener('message', (event) => {
        console.log('[WEBSOCKET] Message received:', event.data);
      });
      
      ws.addEventListener('close', () => {
        console.log('[WEBSOCKET] Connection closed:', args[0]);
      });
      
      return ws;
    };
    
    // Monitor EventSource (SSE)
    const originalEventSource = window.EventSource;
    window.EventSource = function(...args) {
      console.log('[SSE] Creating connection:', args[0]);
      const es = new originalEventSource(...args);
      
      es.addEventListener('open', () => {
        console.log('[SSE] Connection opened:', args[0]);
      });
      
      es.addEventListener('message', (event) => {
        console.log('[SSE] Message received:', event.data);
      });
      
      es.addEventListener('error', () => {
        console.log('[SSE] Connection error:', args[0]);
      });
      
      return es;
    };
    
    // Monitor fetch calls
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      console.log('[FETCH] Request:', args[0]);
      return originalFetch.apply(this, args)
        .then(response => {
          console.log('[FETCH] Response:', response.status, args[0]);
          return response;
        });
    };
  });
  
  // Navigate to auction browse page
  console.log('Navigating to Nellis Auction...');
  await page.goto('https://www.nellisauction.com/browse', { 
    waitUntil: 'networkidle2' 
  });
  
  // Wait and monitor for 30 seconds
  console.log('\nMonitoring network activity for 30 seconds...\n');
  await page.waitForTimeout(30000);
  
  // Log summary
  console.log('\n=== Network Activity Summary ===');
  console.log(`XHR Requests: ${requests.xhr.length}`);
  console.log(`Fetch Requests: ${requests.fetch.length}`);
  
  // Keep browser open for manual inspection
  console.log('\nBrowser will remain open for manual inspection. Press Ctrl+C to exit.');
}

monitorNellisAuction().catch(console.error);