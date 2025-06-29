const EventSource = require('eventsource');
const https = require('https');

async function testNellisSSE() {
  console.log('=== Testing Nellis SSE Connection Directly ===\n');
  
  // First, let's check if the SSE endpoint is accessible
  console.log('1. Testing SSE endpoint availability...');
  
  const checkSSE = new Promise((resolve) => {
    const options = {
      hostname: 'sse.nellisauction.com',
      path: '/',
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };
    
    const req = https.request(options, (res) => {
      console.log(`   Status: ${res.statusCode}`);
      console.log(`   Headers:`, res.headers);
      resolve();
    });
    
    req.on('error', (error) => {
      console.log(`   Error: ${error.message}`);
      resolve();
    });
    
    req.end();
  });
  
  await checkSSE;
  
  console.log('\n2. Attempting EventSource connection...');
  
  try {
    const eventSource = new EventSource('https://sse.nellisauction.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    });
    
    eventSource.onopen = () => {
      console.log('   [SSE] Connection opened!');
    };
    
    eventSource.onmessage = (event) => {
      console.log('   [SSE] Default message:', event.data);
    };
    
    eventSource.onerror = (error) => {
      console.log('   [SSE] Error:', error.message || 'Connection failed');
      eventSource.close();
    };
    
    // Listen for custom event types that might be auction-specific
    const customEvents = [
      'auction-update',
      'bid-update',
      'timer-update',
      'auction',
      'bid',
      'update',
      'ping',
      'heartbeat'
    ];
    
    customEvents.forEach(eventType => {
      eventSource.addEventListener(eventType, (event) => {
        console.log(`   [SSE] Custom event '${eventType}':`, event.data);
      });
    });
    
    // Listen for 15 seconds
    setTimeout(() => {
      eventSource.close();
      console.log('\n   [SSE] Connection closed after 15 seconds');
      testWithBrowser();
    }, 15000);
    
  } catch (error) {
    console.log('   [SSE] Failed to create EventSource:', error.message);
    testWithBrowser();
  }
}

async function testWithBrowser() {
  console.log('\n3. Testing with browser context...');
  
  const { chromium } = require('playwright');
  
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // Monitor console for SSE messages
    page.on('console', msg => {
      if (msg.text().includes('SSE') || msg.text().includes('EventSource')) {
        console.log('   Browser console:', msg.text());
      }
    });
    
    // Inject SSE monitoring before navigation
    await page.addInitScript(() => {
      window.SSE_LOG = [];
      
      const originalEventSource = window.EventSource;
      window.EventSource = function(url, options) {
        console.log('[SSE] Creating EventSource:', url);
        window.SSE_LOG.push({ type: 'create', url, time: new Date().toISOString() });
        
        const es = new originalEventSource(url, options);
        
        // Log all events
        const originalAddEventListener = es.addEventListener;
        es.addEventListener = function(type, listener, options) {
          console.log('[SSE] Adding listener for:', type);
          window.SSE_LOG.push({ type: 'listener', event: type, time: new Date().toISOString() });
          
          // Wrap the listener to log events
          const wrappedListener = function(event) {
            console.log(`[SSE] Event '${type}':`, event.data ? event.data.substring(0, 100) : 'no data');
            window.SSE_LOG.push({ 
              type: 'event', 
              event: type, 
              data: event.data, 
              time: new Date().toISOString() 
            });
            return listener.call(this, event);
          };
          
          return originalAddEventListener.call(this, type, wrappedListener, options);
        };
        
        return es;
      };
    });
    
    console.log('   Navigating to auction page...');
    await page.goto('https://www.nellisauction.com/browse', { 
      waitUntil: 'domcontentloaded',
      timeout: 20000 
    });
    
    // Wait for potential SSE initialization
    await page.waitForTimeout(5000);
    
    // Check if SSE was created
    const sseLog = await page.evaluate(() => window.SSE_LOG || []);
    
    if (sseLog.length > 0) {
      console.log('\n   SSE Activity Detected:');
      sseLog.forEach(log => {
        console.log(`   - ${log.type}: ${log.event || log.url || ''} ${log.data ? '(data: ' + log.data.substring(0, 50) + '...)' : ''}`);
      });
    } else {
      console.log('   No SSE activity detected in browser');
    }
    
    await browser.close();
    
  } catch (error) {
    console.log('   Browser test error:', error.message);
  }
  
  console.log('\n=== Analysis Complete ===');
}

testNellisSSE().catch(console.error);