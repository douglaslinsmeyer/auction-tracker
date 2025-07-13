const { chromium } = require('playwright');

async function testMaxBidPercentage() {
    const browser = await chromium.launch({ 
        headless: false,
        viewport: { width: 1400, height: 900 }
    });
    const page = await browser.newPage();
    
    try {
        console.log('Testing Default Max Bid Percentage Setting\n');
        
        // Navigate to Hot Deals
        await page.goto('http://localhost:3001/#hot-deals');
        console.log('✓ Navigated to Hot Deals page');
        
        // Apply filter to get results
        await page.waitForTimeout(2000);
        await page.fill('#discount-percentage-slider', '50');
        await page.click('#apply-filters-button');
        await page.waitForTimeout(3000);
        
        // Check the new max bid percentage slider
        const maxBidSlider = await page.$('#max-bid-percentage-slider');
        console.log('✓ Max bid percentage slider found');
        
        // Get initial value
        const initialValue = await page.inputValue('#max-bid-percentage-slider');
        console.log(`\nInitial max bid percentage: ${initialValue}%`);
        
        // Test with default 20%
        const monitorButtons = await page.$$('.monitor-auction-btn');
        if (monitorButtons.length > 0) {
            await monitorButtons[0].click();
            await page.waitForSelector('#monitor-auction-modal:not(.hidden)');
            
            const retailPrice = await page.textContent('#monitor-retail-price');
            const suggestedBid = await page.inputValue('#monitor-max-bid');
            console.log(`\nWith 20% default:`);
            console.log(`- Retail price: $${retailPrice}`);
            console.log(`- Suggested bid: $${suggestedBid}`);
            console.log(`- Expected: $${Math.ceil(parseFloat(retailPrice) * 0.20)}`);
            
            // Close modal
            await page.click('#monitor-cancel-btn');
            await page.waitForTimeout(500);
            
            // Change to 35%
            console.log('\nChanging max bid percentage to 35%...');
            await page.fill('#max-bid-percentage-slider', '35');
            await page.waitForTimeout(500);
            
            const displayValue = await page.textContent('#max-bid-percentage-value');
            console.log(`✓ Display shows: ${displayValue}`);
            
            // Open modal again
            await monitorButtons[0].click();
            await page.waitForSelector('#monitor-auction-modal:not(.hidden)');
            
            const newSuggestedBid = await page.inputValue('#monitor-max-bid');
            console.log(`\nWith 35% setting:`);
            console.log(`- Suggested bid: $${newSuggestedBid}`);
            console.log(`- Expected: $${Math.ceil(parseFloat(retailPrice) * 0.35)}`);
            
            // Test maximum value (50%)
            await page.click('#monitor-cancel-btn');
            await page.waitForTimeout(500);
            
            console.log('\nTesting maximum value (50%)...');
            await page.fill('#max-bid-percentage-slider', '50');
            await page.waitForTimeout(500);
            
            await monitorButtons[0].click();
            await page.waitForSelector('#monitor-auction-modal:not(.hidden)');
            
            const maxSuggestedBid = await page.inputValue('#monitor-max-bid');
            console.log(`With 50% setting:`);
            console.log(`- Suggested bid: $${maxSuggestedBid}`);
            console.log(`- Expected: $${Math.ceil(parseFloat(retailPrice) * 0.50)}`);
        }
        
        // Take screenshot
        await page.screenshot({ 
            path: '/Users/douglaslinsmeyer/Projects/auction-tracker/tmp/max-bid-percentage-test.png',
            fullPage: true 
        });
        console.log('\n✓ Screenshot saved');
        
        console.log('\n✅ Max bid percentage test complete!');
        
    } catch (error) {
        console.error('Test error:', error);
        await page.screenshot({ 
            path: '/Users/douglaslinsmeyer/Projects/auction-tracker/tmp/max-bid-percentage-error.png' 
        });
    } finally {
        await browser.close();
    }
}

testMaxBidPercentage().catch(console.error);