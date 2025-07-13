const { chromium } = require('playwright');

async function testConnectionStatus() {
  console.log('Testing dashboard connection status...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: false 
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[ERROR] ${msg.text()}`);
    }
  });
  
  try {
    console.log('1. Loading dashboard...');
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    
    // Wait for the app to initialize
    await page.waitForTimeout(2000);
    
    // Check if monitorUI exists
    const appInfo = await page.evaluate(() => {
      if (typeof monitorUI !== 'undefined') {
        return {
          exists: true,
          hasWs: !!monitorUI.ws,
          wsState: monitorUI.ws ? monitorUI.ws.readyState : null,
          wsStateText: monitorUI.ws ? ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][monitorUI.ws.readyState] : null,
          wsUrl: monitorUI.ws ? monitorUI.ws.url : null,
          reconnectAttempts: monitorUI.reconnectAttempts,
          authFailed: monitorUI.authFailed
        };
      }
      return { exists: false };
    });
    console.log('\n2. App status:', JSON.stringify(appInfo, null, 2));
    
    // Check connection status elements
    const connectionStatus = await page.$eval('#connection-text', el => el.textContent);
    const authStatus = await page.$eval('#auth-text', el => el.textContent);
    const auctionCount = await page.$eval('#auction-count', el => el.textContent);
    
    console.log('\n3. UI Status:');
    console.log(`   Connection: ${connectionStatus}`);
    console.log(`   Auth: ${authStatus}`);
    console.log(`   Auctions monitored: ${auctionCount}`);
    
    // Check connection dot color
    const connectionDotColor = await page.$eval('#connection-dot', el => {
      const computedStyle = window.getComputedStyle(el);
      return computedStyle.backgroundColor;
    });
    console.log(`   Connection indicator: ${connectionDotColor}`);
    
    // Take screenshot
    await page.screenshot({ path: 'dashboard-status.png', fullPage: true });
    console.log('\nScreenshot saved as dashboard-status.png');
    
    // Summary
    console.log('\n=== SUMMARY ===');
    if (appInfo.exists && appInfo.wsState === 1) {
      console.log('✓ Dashboard is connected to backend WebSocket');
      console.log('✓ WebSocket URL:', appInfo.wsUrl);
      if (authStatus.includes('Authenticated')) {
        console.log('✓ Authentication successful');
      } else {
        console.log('✗ Not authenticated');
      }
    } else {
      console.log('✗ Dashboard is NOT connected');
      console.log('  App exists:', appInfo.exists);
      console.log('  WebSocket state:', appInfo.wsStateText || 'N/A');
    }
    
  } catch (error) {
    console.error('Test error:', error);
    await page.screenshot({ path: 'dashboard-error-status.png', fullPage: true });
  }
  
  await browser.close();
}

testConnectionStatus().catch(console.error);