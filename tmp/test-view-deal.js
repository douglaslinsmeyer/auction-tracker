const { chromium } = require('playwright');

async function testViewDealButton() {
    const browser = await chromium.launch({ 
        headless: false,
        devtools: true 
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
        console.log('Testing View Deal Button\n');
        
        // Navigate to Hot Deals
        await page.goto('http://localhost:3001/#hot-deals');
        console.log('✓ Navigated to Hot Deals page');
        
        // Wait for page to load
        await page.waitForTimeout(3000);
        
        // Trigger load if needed
        await page.evaluate(() => {
            if (window.hotDealsManager) {
                window.hotDealsManager.loadHotDeals();
            }
        });
        
        await page.waitForTimeout(5000);
        
        // Check if deals are loaded
        const dealCards = await page.$$('#hot-deals-grid > div');
        console.log(`Found ${dealCards.length} deals\n`);
        
        if (dealCards.length > 0) {
            // Get the first View Deal button
            const firstButton = await dealCards[0].$('a[target="_blank"]');
            
            if (firstButton) {
                // Get the href attribute
                const href = await firstButton.getAttribute('href');
                console.log('View Deal button href:', href);
                
                // Check if href is valid
                if (!href || href === 'undefined' || href === 'null') {
                    console.log('❌ Invalid href value!');
                } else {
                    console.log('✓ Valid href found');
                    
                    // Listen for new page/tab
                    const [newPage] = await Promise.all([
                        context.waitForEvent('page'),
                        firstButton.click()
                    ]);
                    
                    console.log('✓ Clicked View Deal button');
                    console.log('New page URL:', newPage.url());
                    
                    // Wait a bit for the new page to load
                    await newPage.waitForTimeout(3000);
                    
                    // Check if we're on Nellis auction site
                    const isNellisSite = newPage.url().includes('nellisauction.com');
                    console.log(`${isNellisSite ? '✓' : '❌'} Navigated to Nellis auction site`);
                    
                    await newPage.close();
                }
            } else {
                console.log('❌ Could not find View Deal button');
            }
        } else {
            console.log('❌ No deals loaded');
        }
        
        console.log('\nTest complete. Browser will stay open for inspection.');
        await page.waitForTimeout(30000);
        
    } catch (error) {
        console.error('Test error:', error);
    } finally {
        await browser.close();
    }
}

testViewDealButton().catch(console.error);