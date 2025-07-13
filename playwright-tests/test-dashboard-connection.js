const { chromium } = require('playwright');

async function testDashboardConnection() {
  console.log('Starting dashboard connection test...');
  
  const browser = await chromium.launch({ 
    headless: false, // Set to true for CI/CD
    devtools: true 
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Capture console logs
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(`[${msg.type()}] ${text}`);
    console.log(`Browser console: [${msg.type()}] ${text}`);
  });
  
  // Capture network requests
  page.on('request', request => {
    if (request.url().includes('ws://') || request.url().includes('wss://')) {
      console.log(`WebSocket request: ${request.url()}`);
    }
  });
  
  // Capture WebSocket frames
  page.on('websocket', ws => {
    console.log(`WebSocket created: ${ws.url()}`);
    
    ws.on('framesent', ({ payload }) => {
      console.log(`WebSocket sent: ${payload}`);
    });
    
    ws.on('framereceived', ({ payload }) => {
      console.log(`WebSocket received: ${payload}`);
    });
    
    ws.on('close', () => {
      console.log('WebSocket closed');
    });
  });
  
  try {
    console.log('\n1. Loading dashboard...');
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    
    // Check if page loaded
    const title = await page.title();
    console.log(`   Page title: ${title}`);
    
    // Wait for connection status element
    console.log('\n2. Checking connection status...');
    const connectionStatus = await page.waitForSelector('#connection-status', { timeout: 5000 });
    const statusText = await connectionStatus.textContent();
    console.log(`   Connection status: ${statusText}`);
    
    // Check WebSocket state
    console.log('\n3. Checking WebSocket state...');
    const wsState = await page.evaluate(() => {
      if (window.app && window.app.ws) {
        return {
          exists: true,
          readyState: window.app.ws.readyState,
          url: window.app.ws.url,
          stateText: ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][window.app.ws.readyState]
        };
      }
      return { exists: false };
    });
    console.log('   WebSocket state:', JSON.stringify(wsState, null, 2));
    
    // Check for any errors
    console.log('\n4. Checking for errors...');
    const errors = logs.filter(log => log.includes('[error]'));
    if (errors.length > 0) {
      console.log('   Errors found:');
      errors.forEach(err => console.log(`   - ${err}`));
    } else {
      console.log('   No errors found');
    }
    
    // Wait a bit to see if connection establishes
    console.log('\n5. Waiting for connection...');
    await page.waitForTimeout(3000);
    
    // Final status check
    const finalStatus = await connectionStatus.textContent();
    const authStatus = await page.$eval('#auth-status', el => el.textContent).catch(() => 'Not found');
    
    console.log('\n=== Final Status ===');
    console.log(`Connection: ${finalStatus}`);
    console.log(`Auth: ${authStatus}`);
    
    // Get all console logs
    console.log('\n=== All Console Logs ===');
    logs.forEach(log => console.log(log));
    
    // Take screenshot
    await page.screenshot({ path: 'dashboard-test.png', fullPage: true });
    console.log('\nScreenshot saved as dashboard-test.png');
    
  } catch (error) {
    console.error('Test error:', error);
    await page.screenshot({ path: 'dashboard-error.png', fullPage: true });
  }
  
  // Keep browser open for manual inspection
  console.log('\nTest complete. Press Ctrl+C to close browser...');
  await new Promise(() => {}); // Wait indefinitely
}

// Check if playwright is installed
try {
  require.resolve('playwright');
  testDashboardConnection().catch(console.error);
} catch (e) {
  console.log('Installing Playwright...');
  const { execSync } = require('child_process');
  execSync('npm install playwright', { stdio: 'inherit' });
  console.log('Playwright installed. Please run the script again.');
}