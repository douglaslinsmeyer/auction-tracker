const { chromium } = require('playwright');

async function testHotDealsSimple() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
        console.log('Browser console:', msg.type(), msg.text());
    });
    
    try {
        console.log('Simple Hot Deals Test\n');
        
        // Navigate directly to Hot Deals page
        await page.goto('http://localhost:3001/#hot-deals');
        console.log('✓ Navigated to Hot Deals page');
        
        // Wait for page to load
        await page.waitForTimeout(3000);
        
        // Check if Hot Deals page is visible
        const hotDealsPageVisible = await page.isVisible('#hot-deals-page');
        console.log(`Hot Deals page visible: ${hotDealsPageVisible}`);
        
        // Check various elements
        const elements = {
            'Loading': '#hot-deals-loading',
            'Grid': '#hot-deals-grid',
            'Empty state': '#hot-deals-empty',
            'Auto-refresh toggle': '#hot-deals-auto-refresh',
            'Refresh button': '#refresh-hot-deals'
        };
        
        for (const [name, selector] of Object.entries(elements)) {
            const isVisible = await page.isVisible(selector);
            const hasHiddenClass = await page.$eval(selector, el => el.classList.contains('hidden')).catch(() => null);
            console.log(`${name}: visible=${isVisible}, hidden class=${hasHiddenClass}`);
        }
        
        // Check if hot-deals.js loaded
        const hotDealsManagerExists = await page.evaluate(() => {
            return typeof window.hotDealsManager !== 'undefined';
        });
        console.log(`\nHot Deals Manager exists: ${hotDealsManagerExists}`);
        
        // Try to manually trigger loading
        if (hotDealsManagerExists) {
            await page.evaluate(() => {
                if (window.hotDealsManager && window.hotDealsManager.loadHotDeals) {
                    window.hotDealsManager.loadHotDeals();
                }
            });
            console.log('✓ Manually triggered loadHotDeals');
            
            await page.waitForTimeout(3000);
            
            // Check again
            const gridVisibleAfter = await page.isVisible('#hot-deals-grid:not(.hidden)');
            const emptyVisibleAfter = await page.isVisible('#hot-deals-empty:not(.hidden)');
            console.log(`\nAfter manual trigger:`);
            console.log(`Grid visible: ${gridVisibleAfter}`);
            console.log(`Empty visible: ${emptyVisibleAfter}`);
        }
        
        // Take screenshot
        await page.screenshot({ 
            path: '/Users/douglaslinsmeyer/Projects/auction-tracker/tmp/hot-deals-simple.png',
            fullPage: true 
        });
        console.log('\n✓ Screenshot saved');
        
    } catch (error) {
        console.error('Test error:', error.message);
    } finally {
        await browser.close();
    }
}

testHotDealsSimple().catch(console.error);