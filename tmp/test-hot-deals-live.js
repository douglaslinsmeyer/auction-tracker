const { chromium } = require('playwright');

async function testHotDealsLiveData() {
    const browser = await chromium.launch({ 
        headless: false,
        viewport: { width: 1400, height: 800 }
    });
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('Browser error:', msg.text());
        }
    });
    
    try {
        console.log('Testing Hot Deals with Live Data\n');
        
        // Navigate directly to Hot Deals page
        await page.goto('http://localhost:3001/#hot-deals');
        console.log('✓ Navigated to Hot Deals page');
        
        // Wait for content to load
        await page.waitForTimeout(3000);
        
        // Try to manually trigger load if needed
        const managerExists = await page.evaluate(() => {
            return typeof window.hotDealsManager !== 'undefined';
        });
        
        if (managerExists) {
            console.log('✓ Hot Deals Manager found, triggering load...');
            await page.evaluate(() => {
                window.hotDealsManager.loadHotDeals();
            });
            await page.waitForTimeout(5000);
        }
        
        // Check if hot deals loaded
        const gridVisible = await page.isVisible('#hot-deals-grid:not(.hidden)');
        const emptyVisible = await page.isVisible('#hot-deals-empty:not(.hidden)');
        
        console.log(`Grid visible: ${gridVisible}`);
        console.log(`Empty state visible: ${emptyVisible}`);
        
        if (gridVisible) {
            // Count the deals
            const dealCards = await page.$$('#hot-deals-grid > div');
            console.log(`\n✓ Found ${dealCards.length} hot deals from live data`);
            
            // Check first few deals
            console.log('\nTop Hot Deals:');
            for (let i = 0; i < Math.min(5, dealCards.length); i++) {
                const card = dealCards[i];
                
                try {
                    const title = await card.$eval('h3', el => el.textContent.trim());
                    const price = await card.$eval('.text-2xl', el => el.textContent.trim());
                    const retailPrice = await card.$eval('.line-through', el => el.textContent.trim());
                    const discount = await card.$eval('.bg-red-100', el => el.textContent.trim());
                    const timeRemaining = await card.$$eval('.text-xs.text-gray-500 span', els => els[1]?.textContent.trim() || 'Unknown');
                    
                    console.log(`\n${i + 1}. ${title.substring(0, 60)}...`);
                    console.log(`   Current: ${price} (Retail: ${retailPrice})`);
                    console.log(`   Discount: ${discount}`);
                    console.log(`   Time remaining: ${timeRemaining}`);
                } catch (e) {
                    console.log(`   Error reading deal ${i + 1}:`, e.message);
                }
            }
            
            // Check data source indicator
            const lastUpdate = await page.$eval('#hot-deals-last-update', el => el.textContent);
            console.log(`\nLast updated: ${lastUpdate}`);
            
            // Test refresh button
            console.log('\n✓ Testing refresh...');
            await page.click('#refresh-hot-deals');
            await page.waitForSelector('#hot-deals-loading:not(.hidden)', { timeout: 5000 });
            console.log('✓ Loading state shown');
            
            await page.waitForSelector('#hot-deals-grid:not(.hidden)', { timeout: 10000 });
            console.log('✓ Hot deals refreshed');
            
            // Check auto-refresh status
            const autoRefresh = await page.$eval('#hot-deals-auto-refresh', el => el.checked);
            console.log(`\n✓ Auto-refresh is ${autoRefresh ? 'enabled' : 'disabled'}`);
            
        } else if (emptyVisible) {
            console.log('\n⚠️ No hot deals found (empty state displayed)');
        } else {
            console.log('\n❌ Neither grid nor empty state is visible');
        }
        
        // Take screenshot
        await page.screenshot({ 
            path: '/Users/douglaslinsmeyer/Projects/auction-tracker/tmp/hot-deals-live.png',
            fullPage: true 
        });
        console.log('\n✓ Screenshot saved to hot-deals-live.png');
        
        console.log('\n✅ Live data test complete!');
        
    } catch (error) {
        console.error('❌ Test error:', error.message);
        await page.screenshot({ 
            path: '/Users/douglaslinsmeyer/Projects/auction-tracker/tmp/hot-deals-live-error.png' 
        });
    } finally {
        await browser.close();
    }
}

testHotDealsLiveData().catch(console.error);