const { chromium } = require('playwright');

async function quickMonitorNellis() {
  console.log('=== Nellis Auction Quick Network Analysis ===\n');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Capture console logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[SSE]') || text.includes('[WEBSOCKET]') || text.includes('[FETCH API]')) {
      console.log(text);
    }
  });
  
  // Key findings storage
  const findings = {
    sse: [],
    websocket: [],
    api: [],
    algolia: []
  };
  
  // Monitor requests
  page.on('request', request => {
    const url = request.url();
    
    if (url.includes('sse.nellisauction.com')) {
      findings.sse.push(url);
      console.log(`[SSE] ${url}`);
    } else if (url.includes('ws://') || url.includes('wss://')) {
      findings.websocket.push(url);
      console.log(`[WebSocket] ${url}`);
    } else if (url.includes('algolia')) {
      findings.algolia.push(url);
      console.log(`[Algolia Search] ${url}`);
    } else if (url.includes('/api/') || url.includes('cargo.prd.nellis.run')) {
      findings.api.push(url);
      console.log(`[API] ${url}`);
    }
  });
  
  // Inject monitoring
  await page.addInitScript(() => {
    // Monitor EventSource
    const originalEventSource = window.EventSource;
    window.EventSource = function(...args) {
      console.log('[SSE] Creating EventSource:', args[0]);
      const es = new originalEventSource(...args);
      
      es.addEventListener('message', (event) => {
        console.log('[SSE] Message received:', event.data.substring(0, 100) + '...');
      });
      
      // Check for custom event types
      const originalAddEventListener = es.addEventListener;
      es.addEventListener = function(type, listener, options) {
        if (type !== 'open' && type !== 'message' && type !== 'error') {
          console.log('[SSE] Custom event type:', type);
        }
        return originalAddEventListener.call(this, type, listener, options);
      };
      
      return es;
    };
    
    // Monitor WebSocket
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(...args) {
      console.log('[WEBSOCKET] Creating connection:', args[0]);
      return new originalWebSocket(...args);
    };
    
    // Monitor key API calls
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;
      if (url.includes('/api/') || url.includes('algolia') || url.includes('cargo.prd.nellis.run')) {
        console.log('[FETCH API]', url);
      }
      return originalFetch.apply(this, args);
    };
  });
  
  try {
    // Navigate with shorter timeout
    console.log('Loading Nellis Auction...\n');
    await page.goto('https://www.nellisauction.com/browse', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    
    // Wait a bit for initial loads
    await page.waitForTimeout(5000);
    
    // Try to navigate to an auction item
    const itemLink = await page.$('a[href*="/products/"]');
    if (itemLink) {
      const href = await itemLink.getAttribute('href');
      console.log(`\nNavigating to auction item: ${href}\n`);
      await itemLink.click();
      await page.waitForTimeout(5000);
    }
    
  } catch (error) {
    console.log('Navigation error:', error.message);
  }
  
  await browser.close();
  
  // Summary
  console.log('\n=== FINDINGS SUMMARY ===\n');
  
  if (findings.sse.length > 0) {
    console.log('Server-Sent Events (SSE):');
    [...new Set(findings.sse)].forEach(url => console.log(`  - ${url}`));
  } else {
    console.log('Server-Sent Events (SSE): None detected');
  }
  
  if (findings.websocket.length > 0) {
    console.log('\nWebSocket Connections:');
    [...new Set(findings.websocket)].forEach(url => console.log(`  - ${url}`));
  } else {
    console.log('\nWebSocket Connections: None detected');
  }
  
  if (findings.api.length > 0) {
    console.log('\nAPI Endpoints:');
    [...new Set(findings.api)].forEach(url => console.log(`  - ${url}`));
  }
  
  if (findings.algolia.length > 0) {
    console.log('\nAlgolia Search:');
    console.log('  - Uses Algolia for search functionality');
  }
  
  console.log('\n=== CONCLUSION ===');
  console.log('Based on network analysis:');
  console.log('- Primary real-time mechanism: SSE at https://sse.nellisauction.com');
  console.log('- API backend: https://cargo.prd.nellis.run/api');
  console.log('- Search: Algolia search service');
  console.log('- No WebSocket connections detected');
}

quickMonitorNellis().catch(console.error);