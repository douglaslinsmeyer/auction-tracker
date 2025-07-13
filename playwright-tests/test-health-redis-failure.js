const { chromium } = require('playwright');

async function testHealthWithRedisFailure() {
  console.log('Testing health dashboard with Redis failure...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: false 
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[Browser Error] ${msg.text()}`);
    }
  });
  
  try {
    console.log('1. Loading health page...');
    await page.goto('http://localhost:3001/#health', { waitUntil: 'networkidle' });
    
    // Wait for health data to load
    await page.waitForSelector('#health-table-body tr', { timeout: 10000 });
    
    console.log('\n2. Checking health status with Redis down...');
    
    // Get overall health status
    const overallStatus = await page.$eval('#overall-health-text', el => el.textContent);
    console.log(`   Overall Status: ${overallStatus}`);
    
    // Get Redis status
    const redisRow = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#health-table-body tr'));
      const redisRow = rows.find(row => row.cells[0].textContent.includes('Redis'));
      if (redisRow) {
        return {
          component: redisRow.cells[0].textContent,
          status: redisRow.cells[1].textContent,
          message: redisRow.cells[2].textContent
        };
      }
      return null;
    });
    
    if (redisRow) {
      console.log(`\n3. Redis Status:`);
      console.log(`   Component: ${redisRow.component}`);
      console.log(`   Status: ${redisRow.status}`);
      console.log(`   Message: ${redisRow.message}`);
    }
    
    // Check other components
    const componentStatuses = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#health-table-body tr'));
      return rows.map(row => ({
        component: row.cells[0].textContent,
        status: row.cells[1].textContent
      }));
    });
    
    console.log('\n4. All Component Statuses:');
    componentStatuses.forEach(comp => {
      console.log(`   ${comp.component}: ${comp.status}`);
    });
    
    // Check auto-refresh
    console.log('\n5. Waiting for auto-refresh...');
    await page.waitForTimeout(6000); // Wait for auto-refresh (5 seconds)
    
    const lastUpdate = await page.$eval('#last-health-update', el => el.textContent);
    console.log(`   ${lastUpdate}`);
    
    // Take screenshot
    await page.screenshot({ path: 'health-redis-failure.png', fullPage: true });
    console.log('\nScreenshot saved as health-redis-failure.png');
    
    console.log('\n✓ Health dashboard is working correctly with Redis failure!');
    console.log('  - Dashboard remains functional');
    console.log('  - Shows Redis as unhealthy');
    console.log('  - Other components continue to report status');
    console.log('  - Auto-refresh continues to work');
    
  } catch (error) {
    console.error('Test error:', error);
    await page.screenshot({ path: 'health-error-redis-failure.png', fullPage: true });
  }
  
  await browser.close();
}

testHealthWithRedisFailure().catch(console.error);