const { chromium } = require('playwright');

async function debugHotDeals() {
    const browser = await chromium.launch({ 
        headless: false,
        devtools: true 
    });
    const page = await browser.newPage();
    
    // Enable all console logging
    page.on('console', msg => {
        console.log(`[${msg.type()}]`, msg.text());
    });
    
    page.on('pageerror', error => {
        console.error('Page error:', error.message);
    });
    
    try {
        console.log('Debug Hot Deals Test\n');
        
        // First navigate to main page
        await page.goto('http://localhost:3001');
        console.log('✓ Loaded main page');
        
        // Check what scripts are loaded
        const scripts = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('script')).map(s => s.src || 'inline');
        });
        console.log('\nLoaded scripts:', scripts);
        
        // Wait a bit
        await page.waitForTimeout(2000);
        
        // Now navigate to hot deals
        await page.goto('http://localhost:3001/#hot-deals');
        console.log('\n✓ Navigated to Hot Deals');
        
        await page.waitForTimeout(2000);
        
        // Check if hotDealsManager exists
        const managerExists = await page.evaluate(() => {
            return {
                hotDealsManager: typeof window.hotDealsManager !== 'undefined',
                Logger: typeof window.Logger !== 'undefined',
                app: typeof window.app !== 'undefined'
            };
        });
        console.log('\nGlobal objects:', managerExists);
        
        // Try to run showPage manually
        await page.evaluate(() => {
            if (typeof showPage === 'function') {
                showPage('hot-deals');
                console.log('Called showPage("hot-deals")');
            }
        });
        
        await page.waitForTimeout(2000);
        
        // Final check
        const finalCheck = await page.evaluate(() => {
            const pageVisible = document.getElementById('hot-deals-page').classList.contains('hidden');
            return {
                pageHidden: pageVisible,
                hotDealsManager: typeof window.hotDealsManager !== 'undefined'
            };
        });
        console.log('\nFinal check:', finalCheck);
        
        console.log('\nTest complete. Browser will remain open for inspection.');
        console.log('Press Ctrl+C to close.');
        
        // Keep browser open
        await new Promise(() => {});
        
    } catch (error) {
        console.error('Test error:', error.message);
    }
}

debugHotDeals().catch(console.error);