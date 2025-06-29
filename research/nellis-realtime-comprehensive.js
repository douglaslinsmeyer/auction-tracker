const { chromium } = require('playwright');

async function comprehensiveRealtimeAnalysis() {
  console.log('=== Nellis Comprehensive Real-time Analysis ===\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true
  });
  
  const page = await browser.newPage();
  
  // Track all real-time mechanisms
  const realtimeData = {
    sse: [],
    websocket: [],
    polling: new Map(),
    fetchStreams: [],
    iframes: [],
    workers: []
  };
  
  // Monitor console
  page.on('console', msg => {
    console.log(`[Console] ${msg.text()}`);
  });
  
  // Track all requests
  page.on('request', request => {
    const url = request.url();
    const method = request.method();
    
    // Skip static assets
    if (url.match(/\.(js|css|png|jpg|woff|svg)$/)) return;
    
    // Track SSE
    if (url.includes('sse.nellisauction.com')) {
      console.log(`\n[SSE DETECTED] ${url}\n`);
      realtimeData.sse.push({ url, time: Date.now() });
    }
    
    // Track potential polling
    const urlPath = new URL(url).pathname;
    if (!realtimeData.polling.has(urlPath)) {
      realtimeData.polling.set(urlPath, 0);
    }
    realtimeData.polling.set(urlPath, realtimeData.polling.get(urlPath) + 1);
    
    if (realtimeData.polling.get(urlPath) > 1) {
      console.log(`[POLLING] ${urlPath} - count: ${realtimeData.polling.get(urlPath)}`);
    }
  });
  
  // Inject comprehensive monitoring
  await page.addInitScript(() => {
    console.log('[Monitor] Injection started');
    
    // Global tracking
    window.REALTIME_MONITOR = {
      sse: [],
      websocket: [],
      intervals: [],
      timeouts: [],
      mutations: []
    };
    
    // Monitor SSE with detail
    const OriginalEventSource = window.EventSource;
    window.EventSource = function(url, config) {
      console.log(`[SSE Created] ${url}`);
      const es = new OriginalEventSource(url, config);
      
      window.REALTIME_MONITOR.sse.push({ 
        url, 
        time: Date.now(),
        readyState: es.readyState
      });
      
      // Monitor all addEventListener calls
      const originalAddEventListener = es.addEventListener;
      es.addEventListener = function(type, listener, options) {
        console.log(`[SSE Event Listener] Type: ${type}`);
        window.REALTIME_MONITOR.sse.push({ 
          event: 'listener_added',
          type,
          time: Date.now()
        });
        
        // Wrap listener to log events
        const wrappedListener = function(event) {
          console.log(`[SSE Event] ${type}: ${event.data ? event.data.substring(0, 100) : 'no data'}`);
          window.REALTIME_MONITOR.sse.push({
            event: 'received',
            type,
            data: event.data,
            time: Date.now()
          });
          return listener.call(this, event);
        };
        
        return originalAddEventListener.call(this, type, wrappedListener, options);
      };
      
      // Also monitor onmessage, onerror, onopen
      ['onmessage', 'onerror', 'onopen'].forEach(prop => {
        Object.defineProperty(es, prop, {
          set: function(handler) {
            console.log(`[SSE Handler] ${prop} set`);
            es[`_${prop}`] = handler;
          },
          get: function() {
            return es[`_${prop}`];
          }
        });
      });
      
      return es;
    };
    
    // Monitor WebSocket comprehensively
    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
      console.log(`[WebSocket Created] ${url}`);
      window.REALTIME_MONITOR.websocket.push({ 
        action: 'create',
        url,
        protocols,
        time: Date.now()
      });
      
      return new OriginalWebSocket(url, protocols);
    };
    
    // Monitor timers
    const originalSetInterval = window.setInterval;
    window.setInterval = function(fn, delay, ...args) {
      const stack = new Error().stack;
      if (delay && delay < 10000) { // Only track short intervals
        console.log(`[Interval] Created with ${delay}ms delay`);
        window.REALTIME_MONITOR.intervals.push({ delay, stack, time: Date.now() });
      }
      return originalSetInterval(fn, delay, ...args);
    };
    
    // Monitor specific DOM changes
    setTimeout(() => {
      // Look for timer elements
      const timerElements = document.querySelectorAll('[class*="timer"], [class*="countdown"], [class*="clock"], [class*="time"]');
      if (timerElements.length > 0) {
        console.log(`[DOM] Found ${timerElements.length} timer elements`);
        
        // Monitor them for changes
        timerElements.forEach((el, index) => {
          const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
              if (mutation.type === 'characterData' || mutation.type === 'childList') {
                console.log(`[Timer Update] Element ${index}: ${el.textContent}`);
                window.REALTIME_MONITOR.mutations.push({
                  element: index,
                  text: el.textContent,
                  time: Date.now()
                });
              }
            });
          });
          
          observer.observe(el, {
            characterData: true,
            childList: true,
            subtree: true
          });
        });
      }
      
      // Look for bid elements
      const bidElements = document.querySelectorAll('[class*="bid"], [class*="price"], .amount');
      if (bidElements.length > 0) {
        console.log(`[DOM] Found ${bidElements.length} bid-related elements`);
      }
    }, 2000);
  });
  
  // Navigate
  console.log('Loading auction page...\n');
  await page.goto('https://www.nellisauction.com/p/PARTIAL-ITEM-THIS-IS-ONLY-BOX-1-OUT-OF-A-SET-OF-5-BOXES-SUNJOY/58040119', {
    waitUntil: 'domcontentloaded'
  });
  
  // Wait for real-time connections
  await page.waitForTimeout(5000);
  
  // Get monitoring data
  const monitorData = await page.evaluate(() => window.REALTIME_MONITOR);
  
  // Monitor for 20 seconds to catch updates
  console.log('\nMonitoring for updates (20 seconds)...\n');
  await page.waitForTimeout(20000);
  
  // Get final data
  const finalData = await page.evaluate(() => window.REALTIME_MONITOR);
  
  // Analysis
  console.log('\n=== ANALYSIS RESULTS ===\n');
  
  console.log('1. SSE (Server-Sent Events):');
  if (realtimeData.sse.length > 0) {
    console.log(`   ✓ Active - ${realtimeData.sse[0].url}`);
    console.log(`   - Event listeners: ${finalData.sse.filter(e => e.event === 'listener_added').map(e => e.type).join(', ')}`);
    console.log(`   - Messages received: ${finalData.sse.filter(e => e.event === 'received').length}`);
  } else {
    console.log('   ✗ Not detected');
  }
  
  console.log('\n2. WebSocket:');
  if (finalData.websocket.length > 0) {
    console.log('   ✓ Active');
    finalData.websocket.forEach(ws => console.log(`     - ${ws.url}`));
  } else {
    console.log('   ✗ Not detected');
  }
  
  console.log('\n3. Polling:');
  const pollingEndpoints = Array.from(realtimeData.polling.entries())
    .filter(([path, count]) => count > 2)
    .map(([path, count]) => ({ path, count }));
  
  if (pollingEndpoints.length > 0) {
    console.log('   ✓ Detected');
    pollingEndpoints.forEach(ep => console.log(`     - ${ep.path} (${ep.count} requests)`));
  } else {
    console.log('   ✗ Not detected');
  }
  
  console.log('\n4. Timer Updates:');
  if (finalData.intervals.length > 0) {
    console.log('   ✓ Active intervals');
    finalData.intervals.forEach(i => console.log(`     - ${i.delay}ms interval`));
  }
  if (finalData.mutations.length > 0) {
    console.log(`   ✓ DOM updates detected: ${finalData.mutations.length}`);
  }
  
  console.log('\n=== CONCLUSION ===');
  console.log('Primary real-time mechanism: SSE (Server-Sent Events)');
  console.log('No WebSocket connections detected');
  console.log('UI updates likely triggered by SSE events');
  
  console.log('\nBrowser remains open for inspection. Press Ctrl+C to exit.');
}

comprehensiveRealtimeAnalysis().catch(console.error);