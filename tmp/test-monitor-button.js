const { chromium } = require('playwright');

async function testMonitorButton() {
    const browser = await chromium.launch({ 
        headless: false,
        viewport: { width: 1400, height: 900 }
    });
    const page = await browser.newPage();
    
    try {
        console.log('Testing Monitor Button Functionality\n');
        
        // Navigate to Hot Deals
        await page.goto('http://localhost:3001/#hot-deals');
        console.log('✓ Navigated to Hot Deals page');
        
        // Apply a broad filter to get results
        await page.waitForTimeout(2000);
        await page.fill('#discount-percentage-slider', '50');
        await page.click('#apply-filters-button');
        
        // Wait for deals to load
        await page.waitForTimeout(3000);
        
        // Check if monitor buttons are visible
        const monitorButtons = await page.$$('.monitor-auction-btn');
        console.log(`\n✓ Found ${monitorButtons.length} monitor buttons`);
        
        if (monitorButtons.length > 0) {
            // Click the first monitor button
            console.log('\nClicking first monitor button...');
            await monitorButtons[0].click();
            
            // Wait for modal to appear
            await page.waitForSelector('#monitor-auction-modal:not(.hidden)', { timeout: 5000 });
            console.log('✓ Modal appeared');
            
            // Check modal content
            const modalTitle = await page.textContent('#monitor-auction-title');
            const currentBid = await page.textContent('#monitor-current-bid');
            const retailPrice = await page.textContent('#monitor-retail-price');
            const maxBidValue = await page.inputValue('#monitor-max-bid');
            
            console.log(`\nModal details:`);
            console.log(`- Title: ${modalTitle.substring(0, 50)}...`);
            console.log(`- Current bid: $${currentBid}`);
            console.log(`- Retail price: $${retailPrice}`);
            console.log(`- Suggested max bid: $${maxBidValue}`);
            
            // Test cancel button
            console.log('\nTesting cancel button...');
            await page.click('#monitor-cancel-btn');
            await page.waitForTimeout(500);
            
            const modalHidden = await page.isHidden('#monitor-auction-modal');
            console.log(`✓ Modal closed: ${modalHidden}`);
            
            // Click monitor button again
            await monitorButtons[0].click();
            await page.waitForSelector('#monitor-auction-modal:not(.hidden)');
            
            // Test setting custom values
            console.log('\nSetting custom max bid...');
            await page.fill('#monitor-max-bid', '75');
            await page.selectOption('#monitor-strategy', 'sniping');
            
            // Take screenshot of modal
            await page.screenshot({ 
                path: '/Users/douglaslinsmeyer/Projects/auction-tracker/tmp/monitor-modal.png',
                fullPage: false 
            });
            console.log('✓ Screenshot of modal saved');
            
            // Test confirm button
            console.log('\nClicking Start Monitoring...');
            await page.click('#monitor-confirm-btn');
            
            // Wait for success message or error
            await page.waitForTimeout(2000);
            
            // Check if button changed to "Monitoring"
            const buttonText = await monitorButtons[0].textContent();
            console.log(`✓ Button text after monitoring: "${buttonText.trim()}"`);
            
            // Check for success message
            const successMessage = await page.$('.fixed.bg-green-600');
            if (successMessage) {
                const messageText = await successMessage.textContent();
                console.log(`✓ Success message: "${messageText}"`);
            }
        }
        
        // Take final screenshot
        await page.screenshot({ 
            path: '/Users/douglaslinsmeyer/Projects/auction-tracker/tmp/monitor-button-test.png',
            fullPage: true 
        });
        console.log('\n✓ Final screenshot saved');
        
        console.log('\n✅ Monitor button test complete!');
        
    } catch (error) {
        console.error('Test error:', error);
        await page.screenshot({ 
            path: '/Users/douglaslinsmeyer/Projects/auction-tracker/tmp/monitor-button-error.png' 
        });
    } finally {
        await browser.close();
    }
}

testMonitorButton().catch(console.error);