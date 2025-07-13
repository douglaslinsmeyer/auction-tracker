const { chromium } = require('playwright');

async function testDashboardDetailed() {
  console.log('Starting detailed dashboard test...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true 
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Inject console logging before page loads
  await page.addInitScript(() => {
    // Override WebSocket constructor to log attempts
    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = class extends OriginalWebSocket {
      constructor(url, protocols) {
        console.log('[WebSocket] Creating new WebSocket:', url);
        super(url, protocols);
        
        this.addEventListener('open', () => {
          console.log('[WebSocket] Connection opened:', url);
        });
        
        this.addEventListener('error', (event) => {
          console.log('[WebSocket] Connection error:', url, event);
        });
        
        this.addEventListener('close', (event) => {
          console.log('[WebSocket] Connection closed:', url, 'Code:', event.code, 'Reason:', event.reason);
        });
        
        this.addEventListener('message', (event) => {
          console.log('[WebSocket] Message received:', event.data);
        });
        
        // Override send to log outgoing messages
        const originalSend = this.send.bind(this);
        this.send = (data) => {
          console.log('[WebSocket] Sending message:', data);
          return originalSend(data);
        };
      }
    };
    
    // Log fetch requests
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      console.log('[Fetch] Request:', args[0]);
      try {
        const response = await originalFetch(...args);
        console.log('[Fetch] Response:', args[0], 'Status:', response.status);
        return response;
      } catch (error) {
        console.log('[Fetch] Error:', args[0], error.message);
        throw error;
      }
    };
  });
  
  // Capture all console messages
  page.on('console', msg => {
    console.log(`Browser: ${msg.text()}`);
  });
  
  page.on('pageerror', error => {
    console.log('Page error:', error.message);
  });
  
  try {
    console.log('1. Loading dashboard...');
    await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
    
    // Wait a bit for JavaScript to initialize
    await page.waitForTimeout(2000);
    
    // Check if app object exists
    console.log('\n2. Checking app initialization...');
    const appInfo = await page.evaluate(() => {
      if (typeof app !== 'undefined') {
        return {
          exists: true,
          hasWs: !!app.ws,
          wsState: app.ws ? app.ws.readyState : null,
          wsUrl: app.ws ? app.ws.url : null
        };
      }
      return { exists: false };
    });
    console.log('App info:', JSON.stringify(appInfo, null, 2));
    
    // Check if logger exists
    const loggerInfo = await page.evaluate(() => {
      return {
        logger: typeof logger !== 'undefined',
        Logger: typeof Logger !== 'undefined',
        windowLogger: typeof window.Logger !== 'undefined'
      };
    });
    console.log('Logger availability:', JSON.stringify(loggerInfo, null, 2));
    
    // Wait for any async operations
    await page.waitForTimeout(3000);
    
    // Take screenshot
    await page.screenshot({ path: 'dashboard-detailed.png', fullPage: true });
    console.log('\nScreenshot saved as dashboard-detailed.png');
    
  } catch (error) {
    console.error('Test error:', error);
    await page.screenshot({ path: 'dashboard-error-detailed.png', fullPage: true });
  }
  
  console.log('\nTest complete. Press Ctrl+C to close browser...');
  await new Promise(() => {}); // Wait indefinitely
}

testDashboardDetailed().catch(console.error);