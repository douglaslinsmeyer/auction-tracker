const axios = require('../backend/node_modules/axios').default || require('../backend/node_modules/axios');

async function checkNellisImages() {
    console.log('Checking Nellis product images...\n');
    
    try {
        // Test with a specific product page
        const productId = '58388742';
        const url = `https://www.nellisauction.com/p/product/${productId}`;
        
        console.log(`Fetching product page: ${url}`);
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });
        
        const html = response.data;
        
        // Look for image URLs in various formats
        const patterns = [
            /https:\/\/images[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi,
            /https:\/\/[^"'\s]*nellis[^"'\s]*\.(?:jpg|jpeg|png|webp)/gi,
            /https:\/\/[^"'\s]*amazon[^"'\s]*\.(?:jpg|jpeg|png|webp)/gi,
            /"imageUrl":\s*"([^"]+)"/g,
            /"image":\s*"([^"]+)"/g,
            /<img[^>]+src=["']([^"']+)["']/gi
        ];
        
        const foundImages = new Set();
        
        patterns.forEach(pattern => {
            const matches = html.matchAll(pattern);
            for (const match of matches) {
                const url = match[1] || match[0];
                if (url && (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.webp'))) {
                    foundImages.add(url);
                }
            }
        });
        
        console.log(`\nFound ${foundImages.size} unique image URLs:`);
        Array.from(foundImages).slice(0, 5).forEach((img, i) => {
            console.log(`${i + 1}. ${img}`);
        });
        
        // Check for structured data
        const jsonLdMatch = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
        if (jsonLdMatch) {
            try {
                const jsonLd = JSON.parse(jsonLdMatch[1]);
                console.log('\nFound JSON-LD data:');
                if (jsonLd.image) {
                    console.log('Image from JSON-LD:', jsonLd.image);
                }
            } catch (e) {
                console.log('Could not parse JSON-LD');
            }
        }
        
        // Check OpenGraph tags
        const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
        if (ogImageMatch) {
            console.log('\nOpenGraph image:', ogImageMatch[1]);
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkNellisImages();