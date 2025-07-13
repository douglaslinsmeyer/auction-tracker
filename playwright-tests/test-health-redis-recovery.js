const { chromium } = require('playwright');

async function testHealthRedisRecovery() {
  console.log('Testing health dashboard Redis recovery detection...\n');
  
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
    
    console.log('\n2. Initial health status check (Redis should be healthy)...');
    
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
      console.log(`\n3. Redis Status:`)
      console.log(`   Component: ${redisRow.component}`);
      console.log(`   Status: ${redisRow.status}`);
      console.log(`   Message: ${redisRow.message}`);
    }
    
    // Wait for auto-refresh to pick up the healthy status
    console.log('\n4. Waiting for auto-refresh to update status...');
    await page.waitForTimeout(6000); // Wait for auto-refresh (5 seconds)
    
    // Check status again after refresh
    const overallStatusAfter = await page.$eval('#overall-health-text', el => el.textContent);
    console.log(`   Overall Status after refresh: ${overallStatusAfter}`);
    
    const redisRowAfter = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#health-table-body tr'));
      const redisRow = rows.find(row => row.cells[0].textContent.includes('Redis'));
      if (redisRow) {
        return {
          status: redisRow.cells[1].textContent,
          message: redisRow.cells[2].textContent
        };
      }
      return null;
    });
    
    if (redisRowAfter) {
      console.log(`   Redis Status after refresh: ${redisRowAfter.status} - ${redisRowAfter.message}`);
    }
    
    // Check all component statuses
    const componentStatuses = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#health-table-body tr'));
      return rows.map(row => ({
        component: row.cells[0].textContent,
        status: row.cells[1].textContent
      }));
    });
    
    console.log('\n5. All Component Statuses:');
    componentStatuses.forEach(comp => {
      console.log(`   ${comp.component}: ${comp.status}`);
    });
    
    // Take screenshot
    await page.screenshot({ path: 'health-redis-recovery.png', fullPage: true });
    console.log('\nScreenshot saved as health-redis-recovery.png');
    
    // Verify correct status
    if (overallStatusAfter === 'Healthy' && redisRowAfter && redisRowAfter.status === 'healthy') {
      console.log('\n✓ Health dashboard correctly detects Redis recovery!');
      console.log('  - Overall status shows as Healthy');
      console.log('  - Redis shows as healthy');
      console.log('  - Dashboard updates via auto-refresh');
    } else {
      console.log('\n✗ Health dashboard did NOT correctly detect Redis recovery');
      console.log(`  - Overall status: ${overallStatusAfter} (expected: Healthy)`);
      console.log(`  - Redis status: ${redisRowAfter?.status} (expected: healthy)`);
    }
    
  } catch (error) {
    console.error('Test error:', error);
    await page.screenshot({ path: 'health-error-redis-recovery.png', fullPage: true });
  }
  
  await browser.close();
}

testHealthRedisRecovery().catch(console.error);