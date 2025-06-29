const { chromium } = require('playwright');

async function deepWebSocketMonitor() {
  console.log('=== Nellis Deep WebSocket Analysis ===\n');
  console.log('Target URL: https://www.nellisauction.com/p/PARTIAL-ITEM-THIS-IS-ONLY-BOX-1-OUT-OF-A-SET-OF-5-BOXES-SUNJOY/58040119\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true,
    args: ['--enable-logging', '--v=1']
  });
  
  const context = await browser.newContext({
    // Capture all network traffic
    recordHar: { path: 'nellis-network.har' },
    recordVideo: { dir: './videos' }
  });
  
  const page = await context.newPage();
  
  // Comprehensive tracking
  const networkActivity = {
    websockets: [],
    polling: [],
    longPolling: [],
    fetchStreams: [],
    hiddenFrames: [],
    workers: []
  };
  
  // CDP Session for low-level network monitoring
  const client = await page.context().newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Runtime.enable');
  
  // Monitor WebSocket at CDP level
  client.on('Network.webSocketCreated', (params) => {
    console.log(`[CDP WebSocket Created] ${params.url}`);
    networkActivity.websockets.push({
      url: params.url,
      requestId: params.requestId,
      initiator: params.initiator,
      time: new Date().toISOString()
    });
  });
  
  client.on('Network.webSocketFrameSent', (params) => {
    console.log(`[CDP WebSocket Sent] ${params.response.payloadData.substring(0, 100)}`);
  });
  
  client.on('Network.webSocketFrameReceived', (params) => {
    console.log(`[CDP WebSocket Received] ${params.response.payloadData.substring(0, 100)}`);
  });
  
  // Monitor all requests for patterns
  page.on('request', request => {
    const url = request.url();
    const method = request.method();
    const headers = request.headers();
    
    // Check for WebSocket upgrade headers
    if (headers['upgrade'] === 'websocket' || headers['connection']?.includes('Upgrade')) {
      console.log(`[WebSocket Upgrade Request] ${url}`);
      networkActivity.websockets.push({ url, method: 'UPGRADE', time: new Date().toISOString() });
    }
    
    // Check for Socket.IO patterns
    if (url.includes('socket.io') || url.includes('engine.io') || url.includes('/socket/')) {
      console.log(`[Socket.IO Pattern] ${url}`);
    }
    
    // Check for SignalR patterns
    if (url.includes('signalr') || url.includes('/hubs/') || url.includes('negotiate')) {
      console.log(`[SignalR Pattern] ${url}`);
    }
    
    // Check for long polling
    if (url.includes('poll') || url.includes('comet')) {
      console.log(`[Polling Pattern] ${url}`);
      networkActivity.polling.push({ url, time: new Date().toISOString() });
    }
    
    // Log all non-static requests
    if (!url.includes('.js') && !url.includes('.css') && !url.includes('.png') && 
        !url.includes('.jpg') && !url.includes('.woff') && !url.includes('google') && 
        !url.includes('tiktok') && !url.includes('sentry')) {
      console.log(`[${method}] ${url}`);
    }
  });
  
  // Monitor responses for streaming
  page.on('response', async response => {
    const url = response.url();
    const headers = response.headers();
    
    // Check for streaming responses
    if (headers['content-type']?.includes('stream') || 
        headers['transfer-encoding'] === 'chunked' ||
        headers['x-content-type-options']?.includes('stream')) {
      console.log(`[Streaming Response] ${url}`);
      networkActivity.fetchStreams.push({ url, headers, time: new Date().toISOString() });
    }
  });
  
  // Inject comprehensive monitoring
  await page.addInitScript(() => {
    window.WEBSOCKET_LOG = [];
    
    // Monitor WebSocket with full detail
    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = new Proxy(OriginalWebSocket, {
      construct(target, args) {
        const url = args[0];
        const protocols = args[1];
        console.log(`[WebSocket Constructor] URL: ${url}, Protocols: ${protocols}`);
        window.WEBSOCKET_LOG.push({ 
          action: 'construct', 
          url, 
          protocols, 
          time: Date.now(),
          stack: new Error().stack 
        });
        
        const ws = new target(...args);
        
        // Override send
        const originalSend = ws.send.bind(ws);
        ws.send = function(data) {
          console.log(`[WebSocket Send] ${typeof data === 'string' ? data.substring(0, 100) : 'binary data'}`);
          window.WEBSOCKET_LOG.push({ action: 'send', data: data.toString().substring(0, 200), time: Date.now() });
          return originalSend(data);
        };
        
        // Monitor all events
        ['open', 'message', 'error', 'close'].forEach(eventType => {
          ws.addEventListener(eventType, (event) => {
            if (eventType === 'message') {
              console.log(`[WebSocket Message] ${event.data.substring(0, 100)}`);
              window.WEBSOCKET_LOG.push({ 
                action: 'message', 
                data: event.data.substring(0, 200), 
                time: Date.now() 
              });
            } else {
              console.log(`[WebSocket ${eventType}]`, eventType === 'close' ? `Code: ${event.code}` : '');
              window.WEBSOCKET_LOG.push({ action: eventType, time: Date.now() });
            }
          });
        });
        
        return ws;
      }
    });
    
    // Monitor fetch for streaming responses
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const response = await originalFetch(...args);
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;
      
      // Check if response is streaming
      if (response.body && response.body.getReader) {
        console.log(`[Fetch Stream] ${url}`);
        
        // Wrap the body to monitor streaming
        const originalBody = response.body;
        const monitoredBody = new ReadableStream({
          async start(controller) {
            const reader = originalBody.getReader();
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                console.log(`[Stream Chunk] ${url} - ${value.length} bytes`);
                controller.enqueue(value);
              }
              controller.close();
            } catch (error) {
              controller.error(error);
            }
          }
        });
        
        // Return response with monitored body
        return new Response(monitoredBody, response);
      }
      
      return response;
    };
    
    // Monitor Worker creation
    if (window.Worker) {
      const OriginalWorker = window.Worker;
      window.Worker = new Proxy(OriginalWorker, {
        construct(target, args) {
          console.log(`[Worker Created] ${args[0]}`);
          return new target(...args);
        }
      });
    }
    
    // Monitor SharedWorker
    if (window.SharedWorker) {
      const OriginalSharedWorker = window.SharedWorker;
      window.SharedWorker = new Proxy(OriginalSharedWorker, {
        construct(target, args) {
          console.log(`[SharedWorker Created] ${args[0]}`);
          return new target(...args);
        }
      });
    }
    
    // Check for hidden iframes that might use WebSocket
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.tagName === 'IFRAME') {
            console.log(`[Hidden iframe] ${node.src || 'about:blank'}`);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
  
  // Navigate and wait
  console.log('Navigating to auction page...\n');
  try {
    await page.goto('https://www.nellisauction.com/p/PARTIAL-ITEM-THIS-IS-ONLY-BOX-1-OUT-OF-A-SET-OF-5-BOXES-SUNJOY/58040119', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
  } catch (e) {
    console.log('Navigation timeout - continuing analysis...\n');
  }
  
  console.log('Page loaded. Monitoring for 30 seconds...\n');
  
  // Try interacting with the page
  try {
    // Look for bid button and hover/click
    const bidButton = await page.$('button:has-text("Bid"), button:has-text("Place Bid")');
    if (bidButton) {
      console.log('Found bid button - hovering to trigger any lazy connections...\n');
      await bidButton.hover();
      await page.waitForTimeout(2000);
    }
    
    // Scroll to trigger lazy loading
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo(0, 0));
  } catch (e) {
    console.log('Interaction error:', e.message);
  }
  
  // Wait and collect data
  await page.waitForTimeout(30000);
  
  // Get injected monitoring data
  const wsLog = await page.evaluate(() => window.WEBSOCKET_LOG || []);
  
  // Final analysis
  console.log('\n=== WEBSOCKET ANALYSIS RESULTS ===\n');
  
  if (networkActivity.websockets.length > 0 || wsLog.length > 0) {
    console.log('WebSocket Connections Detected:');
    networkActivity.websockets.forEach(ws => {
      console.log(`  - ${ws.url}`);
      console.log(`    Time: ${ws.time}`);
      if (ws.initiator) console.log(`    Initiator: ${JSON.stringify(ws.initiator).substring(0, 100)}`);
    });
    
    if (wsLog.length > 0) {
      console.log('\nWebSocket Activity Log:');
      wsLog.forEach(log => {
        console.log(`  - ${log.action}: ${log.url || log.data || ''}`);
      });
    }
  } else {
    console.log('No WebSocket connections detected.\n');
    
    if (networkActivity.polling.length > 0) {
      console.log('Polling Endpoints Found:');
      const uniquePolls = [...new Set(networkActivity.polling.map(p => p.url))];
      uniquePolls.forEach(url => console.log(`  - ${url}`));
    }
    
    if (networkActivity.fetchStreams.length > 0) {
      console.log('\nStreaming Responses:');
      networkActivity.fetchStreams.forEach(stream => {
        console.log(`  - ${stream.url}`);
      });
    }
  }
  
  // Save HAR file info
  console.log('\n=== ADDITIONAL DATA ===');
  console.log('- Network HAR file saved to: nellis-network.har');
  console.log('- Video recording saved to: ./videos/');
  
  await context.close();
  await browser.close();
  
  console.log('\nAnalysis complete.');
}

deepWebSocketMonitor().catch(console.error);