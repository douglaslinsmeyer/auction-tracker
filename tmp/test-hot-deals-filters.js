const { chromium } = require('playwright');

async function testHotDealsFilters() {
    const browser = await chromium.launch({ 
        headless: false,
        viewport: { width: 1400, height: 900 }
    });
    const page = await browser.newPage();
    
    try {
        console.log('Testing Hot Deals Filters\n');
        
        // Navigate to Hot Deals
        await page.goto('http://localhost:3001/#hot-deals');
        console.log('✓ Navigated to Hot Deals page');
        
        // Wait for initial load
        await page.waitForTimeout(3000);
        
        // Check initial state
        const initialDeals = await page.$$('#hot-deals-grid > div');
        console.log(`\n✓ Initial load: ${initialDeals.length} deals`);
        
        // Test 1: Change discount percentage to 25%
        console.log('\nTest 1: Changing discount to 25%');
        await page.fill('#discount-percentage-slider', '25');
        await page.click('#apply-filters-button');
        await page.waitForTimeout(3000);
        
        const deals25 = await page.$$('#hot-deals-grid > div');
        console.log(`✓ With 25% filter: ${deals25.length} deals`);
        
        // Test 2: Add max price of $20
        console.log('\nTest 2: Adding max price $20');
        await page.fill('#max-price-input', '20');
        await page.click('#apply-filters-button');
        await page.waitForTimeout(3000);
        
        const dealsPrice20 = await page.$$('#hot-deals-grid > div');
        console.log(`✓ With 25% and $20 max: ${dealsPrice20.length} deals`);
        
        // Test 3: Change to more restrictive - 10% and $10
        console.log('\nTest 3: More restrictive - 10% and $10');
        await page.fill('#discount-percentage-slider', '10');
        await page.fill('#max-price-input', '10');
        await page.click('#apply-filters-button');
        await page.waitForTimeout(3000);
        
        const dealsStrict = await page.$$('#hot-deals-grid > div');
        console.log(`✓ With 10% and $10 max: ${dealsStrict.length} deals`);
        
        // Test 4: Remove price filter
        console.log('\nTest 4: Removing price filter');
        await page.fill('#max-price-input', '');
        await page.click('#apply-filters-button');
        await page.waitForTimeout(3000);
        
        const dealsNoPrice = await page.$$('#hot-deals-grid > div');
        console.log(`✓ With 10% only: ${dealsNoPrice.length} deals`);
        
        // Take screenshot
        await page.screenshot({ 
            path: '/Users/douglaslinsmeyer/Projects/auction-tracker/tmp/hot-deals-filters.png',
            fullPage: true 
        });
        console.log('\n✓ Screenshot saved to hot-deals-filters.png');
        
        // Check filter values display
        const discountDisplay = await page.textContent('#discount-percentage-display');
        const discountValue = await page.textContent('#discount-percentage-value');
        console.log(`\nFilter display values:`);
        console.log(`- Discount display: ${discountDisplay}%`);
        console.log(`- Discount value: ${discountValue}`);
        
        console.log('\n✅ Filter test complete!');
        
    } catch (error) {
        console.error('Test error:', error);
        await page.screenshot({ 
            path: '/Users/douglaslinsmeyer/Projects/auction-tracker/tmp/hot-deals-filters-error.png' 
        });
    } finally {
        await browser.close();
    }
}

testHotDealsFilters().catch(console.error);