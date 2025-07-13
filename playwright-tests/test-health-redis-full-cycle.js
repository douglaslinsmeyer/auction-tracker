const { chromium } = require('playwright');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

async function testHealthRedisFullCycle() {
  console.log('Testing health dashboard Redis failure and recovery cycle...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: false 
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('503')) {
      console.log(`[Browser Error] ${msg.text()}`);
    }
  });
  
  try {
    console.log('1. Loading health page...');
    await page.goto('http://localhost:3001/#health', { waitUntil: 'networkidle' });
    
    // Wait for health data to load
    await page.waitForSelector('#health-table-body tr', { timeout: 10000 });
    
    // Check initial status
    console.log('\n2. Initial status (Redis should be healthy)...');
    let overallStatus = await page.$eval('#overall-health-text', el => el.textContent);
    let redisStatus = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#health-table-body tr'));
      const redisRow = rows.find(row => row.cells[0].textContent.includes('Redis'));
      return redisRow ? redisRow.cells[1].textContent.trim() : null;
    });
    console.log(`   Overall: ${overallStatus}, Redis: ${redisStatus}`);
    
    // Stop Redis
    console.log('\n3. Stopping Redis...');
    await execAsync('docker-compose stop redis');
    console.log('   Redis stopped');
    
    // Wait for auto-refresh to detect failure
    console.log('\n4. Waiting for dashboard to detect Redis failure...');
    await page.waitForTimeout(7000); // Wait for auto-refresh
    
    overallStatus = await page.$eval('#overall-health-text', el => el.textContent);
    redisStatus = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#health-table-body tr'));
      const redisRow = rows.find(row => row.cells[0].textContent.includes('Redis'));
      return redisRow ? redisRow.cells[1].textContent.trim() : null;
    });
    console.log(`   Overall: ${overallStatus}, Redis: ${redisStatus}`);
    
    if (overallStatus !== 'Unhealthy' || redisStatus !== 'unhealthy') {
      console.log('   ✗ Dashboard did not detect Redis failure!');
    } else {
      console.log('   ✓ Dashboard correctly detected Redis failure');
    }
    
    // Start Redis again
    console.log('\n5. Starting Redis...');
    await execAsync('docker-compose start redis');
    console.log('   Redis started');
    
    // Wait for backend to reconnect and dashboard to update
    console.log('\n6. Waiting for dashboard to detect Redis recovery...');
    let recovered = false;
    let attempts = 0;
    const maxAttempts = 12; // 60 seconds max
    
    while (!recovered && attempts < maxAttempts) {
      await page.waitForTimeout(5000); // Wait for auto-refresh
      
      overallStatus = await page.$eval('#overall-health-text', el => el.textContent);
      redisStatus = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('#health-table-body tr'));
        const redisRow = rows.find(row => row.cells[0].textContent.includes('Redis'));
        return redisRow ? redisRow.cells[1].textContent.trim() : null;
      });
      
      console.log(`   Attempt ${attempts + 1}: Overall: ${overallStatus}, Redis: ${redisStatus}`);
      
      if (overallStatus === 'Healthy' && redisStatus === 'healthy') {
        recovered = true;
      }
      attempts++;
    }
    
    // Final status
    console.log('\n7. Final status:');
    const componentStatuses = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#health-table-body tr'));
      return rows.map(row => ({
        component: row.cells[0].textContent,
        status: row.cells[1].textContent.trim()
      }));
    });
    
    componentStatuses.forEach(comp => {
      console.log(`   ${comp.component}: ${comp.status}`);
    });
    
    // Take screenshot
    await page.screenshot({ path: 'health-redis-full-cycle.png', fullPage: true });
    console.log('\nScreenshot saved as health-redis-full-cycle.png');
    
    // Summary
    if (recovered) {
      console.log('\n✓ Health dashboard correctly handles Redis failure and recovery!');
      console.log('  - Detected Redis going down');
      console.log('  - Detected Redis coming back up');
      console.log('  - Overall status updated correctly');
    } else {
      console.log('\n✗ Health dashboard did NOT detect Redis recovery');
      console.log('  - Redis reconnection may need more time');
      console.log('  - Check backend logs for connection issues');
    }
    
  } catch (error) {
    console.error('Test error:', error);
    await page.screenshot({ path: 'health-error-full-cycle.png', fullPage: true });
  }
  
  await browser.close();
}

testHealthRedisFullCycle().catch(console.error);