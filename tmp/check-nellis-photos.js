const axios = require('../backend/node_modules/axios').default || require('../backend/node_modules/axios');

async function checkNellisPhotos() {
    console.log('Checking Nellis search response for photos field...\n');
    
    try {
        const searchUrl = 'https://www.nellisauction.com/search?query=tools';
        console.log('Fetching:', searchUrl);
        
        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
            }
        });
        
        const html = response.data;
        const jsonDataMatch = html.match(/window\.__remixContext\s*=\s*({.*?});/s);
        
        if (jsonDataMatch) {
            const remixData = JSON.parse(jsonDataMatch[1]);
            
            if (remixData.state && remixData.state.loaderData) {
                const routeData = Object.values(remixData.state.loaderData);
                
                for (const data of routeData) {
                    if (data && data.products && Array.isArray(data.products)) {
                        console.log(`Found ${data.products.length} products\n`);
                        
                        // Check first 3 products for photos field
                        data.products.slice(0, 3).forEach((product, i) => {
                            console.log(`${i + 1}. ${product.title.substring(0, 50)}...`);
                            console.log(`   ID: ${product.id}`);
                            
                            // Check for photos field
                            if (product.photos && Array.isArray(product.photos)) {
                                console.log(`   Photos: ${product.photos.length} found`);
                                product.photos.slice(0, 2).forEach((photo, j) => {
                                    if (typeof photo === 'string') {
                                        console.log(`     ${j + 1}. ${photo}`);
                                    } else if (typeof photo === 'object' && photo.url) {
                                        console.log(`     ${j + 1}. ${photo.url}`);
                                    } else {
                                        console.log(`     ${j + 1}. ${JSON.stringify(photo).substring(0, 100)}...`);
                                    }
                                });
                            } else {
                                console.log(`   Photos: Not found`);
                            }
                            
                            // Check other possible image fields
                            const imageFields = ['image', 'imageUrl', 'primaryImage', 'images'];
                            imageFields.forEach(field => {
                                if (product[field]) {
                                    console.log(`   ${field}: ${product[field]}`);
                                }
                            });
                            
                            console.log('');
                        });
                        
                        break;
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkNellisPhotos();