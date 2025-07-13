const { chromium } = require('playwright');

async function testHotDealsThumbnails() {
    const browser = await chromium.launch({ 
        headless: false,
        viewport: { width: 1400, height: 900 }
    });
    const page = await browser.newPage();
    
    try {
        console.log('Testing Hot Deals Thumbnails\n');
        
        // Navigate to Hot Deals
        await page.goto('http://localhost:3001/#hot-deals');
        console.log('✓ Navigated to Hot Deals page');
        
        // Wait and trigger load
        await page.waitForTimeout(2000);
        await page.evaluate(() => {
            if (window.hotDealsManager) {
                window.hotDealsManager.loadHotDeals();
            }
        });
        
        await page.waitForTimeout(5000);
        
        // Check for deal cards with images
        const dealCards = await page.$$('#hot-deals-grid > div');
        console.log(`\n✓ Found ${dealCards.length} deals\n`);
        
        if (dealCards.length > 0) {
            // Check first few cards for images
            console.log('Checking thumbnails:');
            for (let i = 0; i < Math.min(3, dealCards.length); i++) {
                const card = dealCards[i];
                
                // Get image info
                const imgInfo = await card.$eval('img', img => ({
                    src: img.src,
                    alt: img.alt,
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight,
                    complete: img.complete,
                    currentSrc: img.currentSrc
                })).catch(() => null);
                
                if (imgInfo) {
                    console.log(`\n${i + 1}. ${imgInfo.alt.substring(0, 40)}...`);
                    console.log(`   Image URL: ${imgInfo.src.substring(0, 80)}...`);
                    console.log(`   Loaded: ${imgInfo.complete ? 'Yes' : 'No'}`);
                    console.log(`   Dimensions: ${imgInfo.naturalWidth}x${imgInfo.naturalHeight}`);
                }
            }
            
            // Take screenshot
            await page.screenshot({ 
                path: '/Users/douglaslinsmeyer/Projects/auction-tracker/tmp/hot-deals-thumbnails.png',
                fullPage: true 
            });
            console.log('\n✓ Screenshot saved to hot-deals-thumbnails.png');
            
            // Test image loading
            console.log('\nWaiting for all images to load...');
            await page.waitForTimeout(5000);
            
            // Check how many images loaded successfully
            const imageStats = await page.evaluate(() => {
                const images = document.querySelectorAll('#hot-deals-grid img');
                let loaded = 0;
                let failed = 0;
                let placeholder = 0;
                
                images.forEach(img => {
                    if (img.complete && img.naturalWidth > 0) {
                        if (img.src.includes('placeholder')) {
                            placeholder++;
                        } else {
                            loaded++;
                        }
                    } else {
                        failed++;
                    }
                });
                
                return { total: images.length, loaded, failed, placeholder };
            });
            
            console.log('\nImage loading stats:');
            console.log(`Total images: ${imageStats.total}`);
            console.log(`Successfully loaded: ${imageStats.loaded}`);
            console.log(`Placeholders: ${imageStats.placeholder}`);
            console.log(`Failed to load: ${imageStats.failed}`);
        }
        
        console.log('\n✅ Thumbnail test complete!');
        
    } catch (error) {
        console.error('Test error:', error);
        await page.screenshot({ 
            path: '/Users/douglaslinsmeyer/Projects/auction-tracker/tmp/hot-deals-thumbnails-error.png' 
        });
    } finally {
        await browser.close();
    }
}

testHotDealsThumbnails().catch(console.error);