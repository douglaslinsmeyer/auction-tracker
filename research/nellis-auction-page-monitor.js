const { chromium } = require('playwright');

async function monitorAuctionPage() {
  console.log('=== Nellis Auction Item Page Monitor ===\n');
  console.log('Target: PARTIAL ITEM - THIS IS ONLY BOX 1 OUT OF A SET OF 5 BOXES (SUNJOY)\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Enhanced logging
  const findings = {
    sse: [],
    websocket: [],
    api: [],
    polling: [],
    updates: []
  };
  
  // Monitor console logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('SSE') || text.includes('EventSource') || text.includes('WebSocket') || 
        text.includes('bid') || text.includes('timer') || text.includes('update')) {
      console.log(`[Console] ${text}`);
      findings.updates.push({ type: 'console', message: text, time: new Date().toISOString() });
    }
  });
  
  // Monitor all network requests
  page.on('request', request => {
    const url = request.url();
    const method = request.method();
    const resourceType = request.resourceType();
    
    // SSE Detection
    if (url.includes('sse.nellisauction.com') || url.includes('event-stream')) {
      console.log(`[SSE] ${method} ${url}`);
      findings.sse.push({ url, method, time: new Date().toISOString() });
    }
    
    // WebSocket Detection
    if (url.startsWith('ws://') || url.startsWith('wss://')) {
      console.log(`[WebSocket] ${url}`);
      findings.websocket.push({ url, time: new Date().toISOString() });
    }
    
    // API Calls
    if ((resourceType === 'xhr' || resourceType === 'fetch') && 
        (url.includes('/api/') || url.includes('cargo.prd.nellis.run'))) {
      console.log(`[API ${resourceType.toUpperCase()}] ${method} ${url}`);
      findings.api.push({ url, method, type: resourceType, time: new Date().toISOString() });
      
      // Check if this might be polling
      const urlPath = new URL(url).pathname;
      if (findings.api.filter(r => r.url === url).length > 1) {
        console.log(`[POLLING DETECTED] Repeated request to ${urlPath}`);
        findings.polling.push({ url, count: findings.api.filter(r => r.url === url).length });
      }
    }
  });
  
  // Monitor responses
  page.on('response', async response => {
    const url = response.url();
    const status = response.status();
    
    if (url.includes('/api/') || url.includes('sse.') || url.includes('cargo.prd.nellis.run')) {
      console.log(`[Response] ${status} ${url}`);
      
      // Try to capture response data
      if (status === 200) {
        try {
          const contentType = response.headers()['content-type'];
          if (contentType && contentType.includes('application/json')) {
            const body = await response.json();
            console.log(`[Response Data] ${JSON.stringify(body).substring(0, 200)}...`);
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    }
  });
  
  // Inject comprehensive monitoring
  await page.addInitScript(() => {
    window.NELLIS_MONITOR = {
      sse: [],
      websocket: [],
      timers: [],
      mutations: []
    };
    
    // Monitor EventSource
    const originalEventSource = window.EventSource;
    window.EventSource = function(url, options) {
      console.log('[SSE] Creating EventSource:', url);
      window.NELLIS_MONITOR.sse.push({ action: 'create', url, time: Date.now() });
      
      const es = new originalEventSource(url, options);
      
      es.addEventListener('open', () => {
        console.log('[SSE] Connection opened');
        window.NELLIS_MONITOR.sse.push({ action: 'open', time: Date.now() });
      });
      
      es.addEventListener('message', (event) => {
        console.log('[SSE] Message:', event.data);
        window.NELLIS_MONITOR.sse.push({ action: 'message', data: event.data, time: Date.now() });
      });
      
      es.addEventListener('error', () => {
        console.log('[SSE] Error occurred');
        window.NELLIS_MONITOR.sse.push({ action: 'error', time: Date.now() });
      });
      
      // Monitor all event types
      const originalAddEventListener = es.addEventListener;
      es.addEventListener = function(type, listener, options) {
        if (type !== 'open' && type !== 'message' && type !== 'error') {
          console.log('[SSE] Custom event registered:', type);
          window.NELLIS_MONITOR.sse.push({ action: 'custom_event', type, time: Date.now() });
        }
        return originalAddEventListener.call(this, type, listener, options);
      };
      
      return es;
    };
    
    // Monitor WebSocket
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
      console.log('[WebSocket] Creating connection:', url);
      window.NELLIS_MONITOR.websocket.push({ action: 'create', url, time: Date.now() });
      
      const ws = new originalWebSocket(url, protocols);
      
      ws.addEventListener('open', () => {
        console.log('[WebSocket] Connection opened');
        window.NELLIS_MONITOR.websocket.push({ action: 'open', time: Date.now() });
      });
      
      ws.addEventListener('message', (event) => {
        console.log('[WebSocket] Message:', event.data.substring(0, 100));
        window.NELLIS_MONITOR.websocket.push({ action: 'message', data: event.data, time: Date.now() });
      });
      
      return ws;
    };
    
    // Monitor setInterval (for polling detection)
    const originalSetInterval = window.setInterval;
    window.setInterval = function(fn, delay) {
      console.log('[Timer] setInterval created with delay:', delay);
      window.NELLIS_MONITOR.timers.push({ type: 'interval', delay, time: Date.now() });
      return originalSetInterval(fn, delay);
    };
    
    // Monitor DOM mutations for timer/bid updates
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        const target = mutation.target;
        const text = target.textContent || '';
        
        // Look for timer or bid-related changes
        if (text.match(/\d+:\d+/) || // Timer format
            text.match(/\$[\d,]+/) || // Price format
            text.includes('bid') || 
            text.includes('Bid') ||
            target.className && (target.className.includes('timer') || target.className.includes('bid'))) {
          
          console.log('[DOM Update]', mutation.type, ':', text.substring(0, 50));
          window.NELLIS_MONITOR.mutations.push({
            type: mutation.type,
            text: text.substring(0, 100),
            time: Date.now()
          });
        }
      });
    });
    
    // Start observing once DOM is ready
    setTimeout(() => {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }, 1000);
  });
  
  // Navigate to the auction page
  console.log('Navigating to auction item page...\n');
  try {
    await page.goto('https://www.nellisauction.com/p/PARTIAL-ITEM-THIS-IS-ONLY-BOX-1-OUT-OF-A-SET-OF-5-BOXES-SUNJOY/58040119', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    console.log('Page loaded successfully. Monitoring for 30 seconds...\n');
    
    // Check for bid button and timer elements
    const bidButton = await page.$('button:has-text("Place Bid"), button:has-text("Bid Now"), button:has-text("BID")');
    if (bidButton) {
      console.log('[Found] Bid button present\n');
    }
    
    const timerElements = await page.$$('[class*="timer"], [class*="countdown"], [class*="time"], *:has-text(":")');
    if (timerElements.length > 0) {
      console.log(`[Found] ${timerElements.length} potential timer elements\n`);
    }
    
    // Monitor for 30 seconds
    await page.waitForTimeout(30000);
    
    // Get monitoring results
    const monitoringData = await page.evaluate(() => window.NELLIS_MONITOR);
    
    // Print summary
    console.log('\n=== MONITORING SUMMARY ===\n');
    
    console.log('Real-time Connections:');
    console.log(`- SSE Events: ${monitoringData.sse.length}`);
    console.log(`- WebSocket Events: ${monitoringData.websocket.length}`);
    console.log(`- API Calls: ${findings.api.length}`);
    console.log(`- Timers Created: ${monitoringData.timers.length}`);
    console.log(`- DOM Updates: ${monitoringData.mutations.length}`);
    
    if (findings.polling.length > 0) {
      console.log('\nPolling Detected:');
      findings.polling.forEach(p => console.log(`  - ${p.url} (${p.count} requests)`));
    }
    
    if (monitoringData.timers.length > 0) {
      console.log('\nTimer Intervals:');
      monitoringData.timers.forEach(t => console.log(`  - ${t.type}: ${t.delay}ms`));
    }
    
    if (monitoringData.mutations.length > 0) {
      console.log('\nDOM Updates Detected:');
      monitoringData.mutations.slice(0, 5).forEach(m => 
        console.log(`  - ${m.type}: ${m.text}`));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\nBrowser remains open for inspection. Press Ctrl+C to exit.');
}

monitorAuctionPage().catch(console.error);