const { chromium } = require('playwright');

async function captureSSEPayloads() {
  console.log('=== Nellis SSE Payload Capture ===\n');
  console.log('Target: https://www.nellisauction.com/p/PARTIAL-ITEM-THIS-IS-ONLY-BOX-1-OUT-OF-A-SET-OF-5-BOXES-SUNJOY/58040119\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true 
  });
  
  const page = await browser.newPage();
  
  // Store all SSE data
  const sseData = {
    connection: null,
    messages: [],
    events: {}
  };
  
  // Enhanced console monitoring for SSE
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[SSE')) {
      console.log(text);
    }
  });
  
  // Inject comprehensive SSE monitoring
  await page.addInitScript(() => {
    console.log('[SSE Monitor] Injection started');
    
    window.SSE_CAPTURE = {
      connection: null,
      messages: [],
      events: {},
      raw: []
    };
    
    // Override EventSource
    const OriginalEventSource = window.EventSource;
    window.EventSource = function(url, options) {
      console.log(`[SSE] Creating connection to: ${url}`);
      window.SSE_CAPTURE.connection = { url, options, time: new Date().toISOString() };
      
      const es = new OriginalEventSource(url, options);
      
      // Capture raw message events
      es.addEventListener('message', (event) => {
        const payload = {
          type: 'message',
          data: event.data,
          id: event.lastEventId,
          time: new Date().toISOString()
        };
        window.SSE_CAPTURE.messages.push(payload);
        console.log(`[SSE Message] ${event.data}`);
      });
      
      // Capture open event
      es.addEventListener('open', (event) => {
        console.log('[SSE] Connection opened');
        window.SSE_CAPTURE.messages.push({
          type: 'open',
          readyState: es.readyState,
          time: new Date().toISOString()
        });
      });
      
      // Capture error events
      es.addEventListener('error', (event) => {
        console.log('[SSE] Error event');
        window.SSE_CAPTURE.messages.push({
          type: 'error',
          readyState: es.readyState,
          time: new Date().toISOString()
        });
      });
      
      // Override addEventListener to capture custom events
      const originalAddEventListener = es.addEventListener;
      es.addEventListener = function(type, listener, options) {
        console.log(`[SSE] Registering listener for: ${type}`);
        
        // Initialize event type array if needed
        if (!window.SSE_CAPTURE.events[type]) {
          window.SSE_CAPTURE.events[type] = [];
        }
        
        // Wrap the listener to capture data
        const wrappedListener = function(event) {
          const eventData = {
            type: type,
            data: event.data,
            origin: event.origin,
            lastEventId: event.lastEventId,
            time: new Date().toISOString()
          };
          
          window.SSE_CAPTURE.events[type].push(eventData);
          window.SSE_CAPTURE.raw.push(eventData);
          
          console.log(`[SSE Event: ${type}] ${event.data ? event.data.substring(0, 200) : 'no data'}`);
          
          // Try to parse JSON if possible
          try {
            if (event.data && event.data.startsWith('{')) {
              const parsed = JSON.parse(event.data);
              console.log(`[SSE Parsed: ${type}]`, JSON.stringify(parsed, null, 2));
            }
          } catch (e) {
            // Not JSON, that's fine
          }
          
          return listener.call(this, event);
        };
        
        return originalAddEventListener.call(this, type, wrappedListener, options);
      };
      
      return es;
    };
  });
  
  // Navigate to page
  console.log('Loading auction page...\n');
  await page.goto('https://www.nellisauction.com/p/PARTIAL-ITEM-THIS-IS-ONLY-BOX-1-OUT-OF-A-SET-OF-5-BOXES-SUNJOY/58040119', {
    waitUntil: 'domcontentloaded'
  });
  
  // Wait for SSE to establish
  await page.waitForTimeout(3000);
  
  console.log('\nMonitoring for SSE events (60 seconds)...\n');
  console.log('Try placing a bid or wait for timer updates to capture event payloads.\n');
  
  // Try to interact with the page to trigger events
  try {
    // Find and click on elements that might trigger updates
    const bidButton = await page.$('button:has-text("Bid"), button:has-text("Place Bid"), button:has-text("BID")');
    if (bidButton) {
      console.log('Found bid button - hovering to potentially trigger updates...\n');
      await bidButton.hover();
    }
  } catch (e) {
    // Ignore interaction errors
  }
  
  // Monitor for 60 seconds to catch various events
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(5000);
    
    // Periodically check captured data
    const capturedData = await page.evaluate(() => window.SSE_CAPTURE);
    if (capturedData.raw.length > 0 && i % 3 === 0) {
      console.log(`\n[Progress] Captured ${capturedData.raw.length} SSE events so far...`);
    }
  }
  
  // Get final captured data
  const finalData = await page.evaluate(() => window.SSE_CAPTURE);
  
  // Analysis and output
  console.log('\n\n=== SSE PAYLOAD ANALYSIS ===\n');
  
  console.log('Connection Details:');
  if (finalData.connection) {
    console.log(`  URL: ${finalData.connection.url}`);
    console.log(`  Time: ${finalData.connection.time}`);
  }
  
  console.log('\n\nMessage Events (type="message"):');
  if (finalData.messages.length > 0) {
    finalData.messages.forEach((msg, idx) => {
      console.log(`\n[${idx + 1}] ${msg.type} at ${msg.time}`);
      if (msg.data) {
        console.log(`Data: ${msg.data}`);
      }
    });
  } else {
    console.log('  No standard message events captured');
  }
  
  console.log('\n\nCustom Event Payloads:');
  Object.keys(finalData.events).forEach(eventType => {
    const events = finalData.events[eventType];
    if (events.length > 0) {
      console.log(`\n${eventType} (${events.length} events):`);
      events.forEach((event, idx) => {
        console.log(`\n  [${idx + 1}] Time: ${event.time}`);
        console.log(`  Data: ${event.data || 'null'}`);
        
        // Try to parse and pretty-print JSON
        if (event.data) {
          try {
            const parsed = JSON.parse(event.data);
            console.log('  Parsed JSON:');
            console.log(JSON.stringify(parsed, null, 4).split('\n').map(line => '    ' + line).join('\n'));
          } catch (e) {
            // Not JSON
          }
        }
      });
    }
  });
  
  console.log('\n\n=== PAYLOAD EXAMPLES FOR DOCUMENTATION ===\n');
  
  // Generate examples for documentation
  if (finalData.raw.length > 0) {
    const uniqueEvents = {};
    finalData.raw.forEach(event => {
      if (!uniqueEvents[event.type]) {
        uniqueEvents[event.type] = event;
      }
    });
    
    Object.values(uniqueEvents).forEach(event => {
      console.log(`Event Type: ${event.type}`);
      console.log(`Example Payload:`);
      console.log('```json');
      if (event.data) {
        try {
          const parsed = JSON.parse(event.data);
          console.log(JSON.stringify(parsed, null, 2));
        } catch (e) {
          console.log(event.data);
        }
      } else {
        console.log('null');
      }
      console.log('```\n');
    });
  }
  
  await browser.close();
  
  console.log('\nCapture complete. Check above for payload examples.');
}

captureSSEPayloads().catch(console.error);