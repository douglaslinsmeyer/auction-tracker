const { chromium } = require('playwright');

async function testHotDealsPagination() {
    const browser = await chromium.launch({ 
        headless: false,
        viewport: { width: 1400, height: 900 }
    });
    const page = await browser.newPage();
    
    try {
        console.log('Testing Hot Deals Pagination\n');
        
        // Navigate to Hot Deals
        await page.goto('http://localhost:3001/#hot-deals');
        console.log('✓ Navigated to Hot Deals page');
        
        // Wait for initial load
        await page.waitForTimeout(3000);
        
        // Check counts
        const showingText = await page.textContent('#hot-deals-showing');
        const totalText = await page.textContent('#hot-deals-total');
        console.log(`\n✓ Initial load: Showing ${showingText} of ${totalText} deals`);
        
        // Check if Load More button is visible
        const loadMoreVisible = await page.isVisible('#hot-deals-load-more-container');
        console.log(`✓ Load More button visible: ${loadMoreVisible}`);
        
        if (loadMoreVisible) {
            const remainingText = await page.textContent('#hot-deals-remaining');
            console.log(`✓ ${remainingText} more deals available`);
            
            // Click Load More
            console.log('\nClicking Load More...');
            await page.click('#hot-deals-load-more');
            await page.waitForTimeout(2000);
            
            const newShowingText = await page.textContent('#hot-deals-showing');
            console.log(`✓ After loading more: Showing ${newShowingText} of ${totalText} deals`);
            
            // Check if more deals were loaded
            const dealCards = await page.$$('#hot-deals-grid > div');
            console.log(`✓ Total cards displayed: ${dealCards.length}`);
        }
        
        // Test filters with larger range
        console.log('\nTesting with 50% discount filter...');
        await page.fill('#discount-percentage-slider', '50');
        await page.click('#apply-filters-button');
        await page.waitForTimeout(3000);
        
        const newTotalText = await page.textContent('#hot-deals-total');
        const newShowingAfterFilter = await page.textContent('#hot-deals-showing');
        console.log(`✓ With 50% filter: Showing ${newShowingAfterFilter} of ${newTotalText} deals`);
        
        // Take screenshot
        await page.screenshot({ 
            path: '/Users/douglaslinsmeyer/Projects/auction-tracker/tmp/hot-deals-pagination.png',
            fullPage: true 
        });
        console.log('\n✓ Screenshot saved to hot-deals-pagination.png');
        
        // Check that auto-refresh is removed
        const autoRefreshExists = await page.$('#hot-deals-auto-refresh');
        console.log(`\n✓ Auto-refresh removed: ${!autoRefreshExists}`);
        
        console.log('\n✅ Pagination test complete!');
        
    } catch (error) {
        console.error('Test error:', error);
        await page.screenshot({ 
            path: '/Users/douglaslinsmeyer/Projects/auction-tracker/tmp/hot-deals-pagination-error.png' 
        });
    } finally {
        await browser.close();
    }
}

testHotDealsPagination().catch(console.error);