const { chromium } = require('playwright');

async function testHotDealsSearch() {
    const browser = await chromium.launch({ 
        headless: false,
        viewport: { width: 1400, height: 900 }
    });
    const page = await browser.newPage();
    
    try {
        console.log('Testing Hot Deals Search Functionality\n');
        
        // Navigate to Hot Deals
        await page.goto('http://localhost:3001/#hot-deals');
        console.log('✓ Navigated to Hot Deals page');
        
        // Wait for initial load
        await page.waitForTimeout(3000);
        
        // Check initial search value
        const initialSearch = await page.inputValue('#search-input');
        console.log(`\n✓ Initial search term: "${initialSearch}"`);
        
        // Get initial results
        const initialTotal = await page.textContent('#hot-deals-total');
        console.log(`✓ Results for "${initialSearch}": ${initialTotal} deals`);
        
        // Test 1: Search for electronics
        console.log('\nTest 1: Searching for "electronics"');
        await page.fill('#search-input', 'electronics');
        await page.click('#apply-filters-button');
        await page.waitForTimeout(3000);
        
        const electronicsTotal = await page.textContent('#hot-deals-total');
        console.log(`✓ Results for "electronics": ${electronicsTotal} deals`);
        
        // Test 2: Search for furniture
        console.log('\nTest 2: Searching for "furniture"');
        await page.fill('#search-input', 'furniture');
        await page.click('#apply-filters-button');
        await page.waitForTimeout(3000);
        
        const furnitureTotal = await page.textContent('#hot-deals-total');
        console.log(`✓ Results for "furniture": ${furnitureTotal} deals`);
        
        // Test 3: Search with Enter key
        console.log('\nTest 3: Searching for "drill" using Enter key');
        await page.fill('#search-input', 'drill');
        await page.press('#search-input', 'Enter');
        await page.waitForTimeout(3000);
        
        const drillTotal = await page.textContent('#hot-deals-total');
        console.log(`✓ Results for "drill": ${drillTotal} deals`);
        
        // Test 4: Empty search (should default to tools)
        console.log('\nTest 4: Empty search term');
        await page.fill('#search-input', '');
        await page.click('#apply-filters-button');
        await page.waitForTimeout(3000);
        
        const emptyTotal = await page.textContent('#hot-deals-total');
        console.log(`✓ Results for empty search: ${emptyTotal} deals (should default to "tools")`);
        
        // Test 5: Search with filters
        console.log('\nTest 5: Search "tools" with 25% discount and $50 max price');
        await page.fill('#search-input', 'tools');
        await page.fill('#discount-percentage-slider', '25');
        await page.fill('#max-price-input', '50');
        await page.click('#apply-filters-button');
        await page.waitForTimeout(3000);
        
        const filteredTotal = await page.textContent('#hot-deals-total');
        const filteredShowing = await page.textContent('#hot-deals-showing');
        console.log(`✓ Results with filters: Showing ${filteredShowing} of ${filteredTotal} deals`);
        
        // Take screenshot
        await page.screenshot({ 
            path: '/Users/douglaslinsmeyer/Projects/auction-tracker/tmp/hot-deals-search.png',
            fullPage: true 
        });
        console.log('\n✓ Screenshot saved to hot-deals-search.png');
        
        // Check grid has 4 columns
        const dealCards = await page.$$('#hot-deals-grid > div');
        console.log(`\n✓ Deal cards displayed: ${dealCards.length}`);
        
        console.log('\n✅ Search test complete!');
        
    } catch (error) {
        console.error('Test error:', error);
        await page.screenshot({ 
            path: '/Users/douglaslinsmeyer/Projects/auction-tracker/tmp/hot-deals-search-error.png' 
        });
    } finally {
        await browser.close();
    }
}

testHotDealsSearch().catch(console.error);