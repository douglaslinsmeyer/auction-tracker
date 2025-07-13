const axios = require('../backend/node_modules/axios').default || require('../backend/node_modules/axios');

async function testHotDealsAPI() {
    console.log('Testing Hot Deals API response...\n');
    
    try {
        const response = await axios.get('http://localhost:3000/api/hot-deals', {
            params: {
                location: 'Phoenix',
                q: 'tools',
                mock: 'false'
            },
            headers: {
                'Authorization': 'dev-token'
            }
        });
        
        console.log(`Success: ${response.data.success}`);
        console.log(`Data source: ${response.data.dataSource}`);
        console.log(`Total deals: ${response.data.count}\n`);
        
        if (response.data.deals && response.data.deals.length > 0) {
            console.log('First 3 deals with image info:');
            response.data.deals.slice(0, 3).forEach((deal, i) => {
                console.log(`\n${i + 1}. ${deal.title.substring(0, 50)}...`);
                console.log(`   ID: ${deal.id}`);
                console.log(`   Price: $${deal.currentPrice || deal.currentBid} (${deal.discountPercentage}% off)`);
                console.log(`   Has imageUrl: ${!!deal.imageUrl}`);
                console.log(`   Image URL: ${deal.imageUrl ? (typeof deal.imageUrl === 'string' ? deal.imageUrl.substring(0, 80) + '...' : JSON.stringify(deal.imageUrl).substring(0, 80) + '...') : 'None'}`);
                console.log(`   Has photos array: ${!!deal.photos}`);
                console.log(`   Photos count: ${deal.photos ? deal.photos.length : 0}`);
                if (deal.photos && deal.photos.length > 0) {
                    const firstPhoto = deal.photos[0];
                    console.log(`   First photo: ${typeof firstPhoto === 'string' ? firstPhoto.substring(0, 80) + '...' : JSON.stringify(firstPhoto).substring(0, 80) + '...'}`);
                }
            });
        }
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

testHotDealsAPI();