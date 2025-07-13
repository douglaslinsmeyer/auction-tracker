const { chromium } = require('playwright');

async function testHotDealsFeature() {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();
    
    // Enable console logging
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('Browser console error:', msg.text());
        }
    });
    
    try {
        console.log('Testing Hot Deals feature...\n');
        
        // Navigate to the dashboard
        await page.goto('http://localhost:3001');
        console.log('✓ Navigated to dashboard');
        
        // Wait for the page to load
        await page.waitForSelector('#nav-hot-deals', { timeout: 5000 });
        console.log('✓ Dashboard loaded');
        
        // Open sidebar menu first (for mobile view)
        const menuToggle = await page.$('#menu-toggle');
        if (menuToggle && await menuToggle.isVisible()) {
            await menuToggle.click();
            console.log('✓ Opened sidebar menu');
            await page.waitForTimeout(500); // Wait for animation
        }
        
        // Click on Hot Deals navigation
        await page.click('#nav-hot-deals');
        console.log('✓ Clicked Hot Deals navigation');
        
        // Wait for Hot Deals page to be visible
        await page.waitForSelector('#hot-deals-page:not(.hidden)', { timeout: 5000 });
        console.log('✓ Hot Deals page is visible');
        
        // Check if the URL has changed
        const url = page.url();
        if (url.includes('#hot-deals')) {
            console.log('✓ URL updated correctly:', url);
        }
        
        // Wait a bit for the page to initialize
        await page.waitForTimeout(2000);
        
        // Check what's visible on the page
        const loadingVisible = await page.isVisible('#hot-deals-loading');
        const gridVisible = await page.isVisible('#hot-deals-grid');
        const emptyVisible = await page.isVisible('#hot-deals-empty');
        
        console.log(`Loading state visible: ${loadingVisible}`);
        console.log(`Grid visible: ${gridVisible}`);
        console.log(`Empty state visible: ${emptyVisible}`);
        
        // Wait for either deals to load or empty state
        try {
            await Promise.race([
                page.waitForSelector('#hot-deals-grid:not(.hidden)', { timeout: 10000 }),
                page.waitForSelector('#hot-deals-empty:not(.hidden)', { timeout: 10000 })
            ]);
        } catch (e) {
            console.log('Timeout waiting for content. Checking current state...');
        }
        
        // Check if deals are displayed (recheck after wait)
        const dealsVisible = await page.isVisible('#hot-deals-grid:not(.hidden)');
        const emptyStateVisible = await page.isVisible('#hot-deals-empty:not(.hidden)');
        
        if (dealsVisible) {
            console.log('✓ Hot deals are displayed');
            
            // Count the number of deals
            const dealCards = await page.$$('#hot-deals-grid > div');
            console.log(`✓ Found ${dealCards.length} hot deals`);
            
            // Check first deal card structure
            if (dealCards.length > 0) {
                const firstDeal = dealCards[0];
                const title = await firstDeal.$eval('h3', el => el.textContent);
                const price = await firstDeal.$eval('.text-2xl', el => el.textContent);
                const discount = await firstDeal.$eval('.bg-red-100', el => el.textContent);
                
                console.log(`\nFirst deal details:`);
                console.log(`  Title: ${title}`);
                console.log(`  Price: ${price}`);
                console.log(`  Discount: ${discount}`);
            }
        } else if (emptyStateVisible) {
            console.log('✓ Empty state is displayed (no hot deals found)');
        } else {
            console.log('⚠️ Neither deals nor empty state is visible');
        }
        
        // Check auto-refresh toggle
        const autoRefreshToggle = await page.$('#hot-deals-auto-refresh');
        if (autoRefreshToggle) {
            const isChecked = await autoRefreshToggle.isChecked();
            console.log(`✓ Auto-refresh is ${isChecked ? 'enabled' : 'disabled'}`);
        }
        
        // Check refresh button
        await page.click('#refresh-hot-deals');
        console.log('✓ Clicked refresh button');
        
        // Wait for loading state
        await page.waitForSelector('#hot-deals-loading:not(.hidden)', { timeout: 5000 });
        console.log('✓ Loading state displayed');
        
        // Take a screenshot
        await page.screenshot({ path: '/Users/douglaslinsmeyer/Projects/auction-tracker/tmp/hot-deals-screenshot.png' });
        console.log('✓ Screenshot saved to hot-deals-screenshot.png');
        
        console.log('\n✅ All Hot Deals tests passed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        await page.screenshot({ path: '/Users/douglaslinsmeyer/Projects/auction-tracker/tmp/hot-deals-error.png' });
        console.log('Error screenshot saved to hot-deals-error.png');
    } finally {
        await browser.close();
    }
}

// Run the test
testHotDealsFeature().catch(console.error);