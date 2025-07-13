const axios = require('../backend/node_modules/axios').default || require('../backend/node_modules/axios');

async function researchNellisSearch() {
    console.log('Researching Nellis Search API...\n');
    
    try {
        // First, let's try to search for "tools" using their search page
        // The search page URL pattern is: https://www.nellisauction.com/search?query=tools
        
        console.log('1. Fetching search page for "tools"...');
        const searchResponse = await axios.get('https://www.nellisauction.com/search?query=tools', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        
        console.log('Search page status:', searchResponse.status);
        
        // Look for data in the HTML response
        const html = searchResponse.data;
        
        // Check if there's JSON data embedded in the page
        const jsonDataMatch = html.match(/window\.__remixContext\s*=\s*({.*?});/s);
        if (jsonDataMatch) {
            console.log('\n2. Found Remix context data');
            try {
                const remixData = JSON.parse(jsonDataMatch[1]);
                // Look for product data in the remix context
                if (remixData.state && remixData.state.loaderData) {
                    console.log('Found loader data');
                    const routeData = Object.values(remixData.state.loaderData);
                    for (const data of routeData) {
                        if (data && data.products) {
                            console.log(`Found ${data.products.length} products in route data`);
                            console.log('\nFirst 3 products:');
                            data.products.slice(0, 3).forEach((product, i) => {
                                console.log(`${i + 1}. ${product.title} - ID: ${product.id}`);
                                console.log(`   Current: $${product.currentPrice}, Retail: $${product.retailPrice}`);
                                console.log(`   Location: ${product.location}`);
                            });
                            
                            // Extract product IDs
                            const productIds = data.products.map(p => p.id);
                            console.log(`\nProduct IDs: [${productIds.slice(0, 10).join(', ')}...]`);
                            console.log(`Total products: ${productIds.length}`);
                            
                            return { products: data.products, productIds };
                        }
                    }
                }
            } catch (e) {
                console.log('Error parsing Remix data:', e.message);
            }
        }
        
        // Alternative: Look for Next.js data
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">({.*?})<\/script>/s);
        if (nextDataMatch) {
            console.log('\n2. Found Next.js data');
            try {
                const nextData = JSON.parse(nextDataMatch[1]);
                console.log('Next.js build ID:', nextData.buildId);
                // Explore the data structure
                if (nextData.props && nextData.props.pageProps) {
                    console.log('Page props keys:', Object.keys(nextData.props.pageProps));
                }
            } catch (e) {
                console.log('Error parsing Next.js data:', e.message);
            }
        }
        
        // Look for API endpoints in the HTML
        const apiMatches = html.match(/["'](\/api\/[^"']+)["']/g);
        if (apiMatches) {
            console.log('\n3. Found API endpoints:');
            const uniqueEndpoints = [...new Set(apiMatches.map(m => m.slice(1, -1)))];
            uniqueEndpoints.forEach(endpoint => {
                console.log(`   ${endpoint}`);
            });
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response headers:', error.response.headers);
        }
    }
}

researchNellisSearch().catch(console.error);