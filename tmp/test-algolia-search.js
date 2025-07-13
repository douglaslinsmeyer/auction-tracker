const axios = require('../backend/node_modules/axios').default || require('../backend/node_modules/axios');

async function testAlgoliaSearch() {
  console.log('Testing Nellis Auction Algolia Search API...\n');
  
  // Algolia configuration from the website
  const algoliaAppId = '0WRLJS1RJQ';
  const algoliaApiKey = 'f2e90c2ab829cf53c67ca5b5f91bc63f';
  const algoliaIndex = 'nellisauction-prd';
  
  // Search for "tools" in Phoenix location
  const searchBody = {
    requests: [{
      indexName: algoliaIndex,
      params: {
        query: 'tools',
        hitsPerPage: 20,
        page: 0,
        facets: ['location', 'categories.lvl0', 'categories.lvl1'],
        filters: 'location:"Phoenix"',
        attributesToRetrieve: ['*'],
        attributesToHighlight: []
      }
    }]
  };
  
  try {
    const response = await axios.post(
      `https://${algoliaAppId}-dsn.algolia.net/1/indexes/*/queries`,
      searchBody,
      {
        headers: {
          'X-Algolia-Application-Id': algoliaAppId,
          'X-Algolia-API-Key': algoliaApiKey,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data && response.data.results && response.data.results[0]) {
      const results = response.data.results[0];
      console.log(`Found ${results.nbHits} total items\n`);
      
      // Filter for hot deals (current price <= 15% of retail)
      const hotDeals = results.hits.filter(item => {
        if (item.retailPrice && item.currentPrice) {
          const discountRatio = item.currentPrice / item.retailPrice;
          return discountRatio <= 0.15;
        }
        return false;
      });
      
      console.log(`Hot Deals (≤15% of retail): ${hotDeals.length} items\n`);
      
      // Display hot deals
      hotDeals.forEach((item, index) => {
        const discountPercent = Math.round((1 - (item.currentPrice / item.retailPrice)) * 100);
        console.log(`${index + 1}. ${item.title}`);
        console.log(`   ID: ${item.objectID || item.id}`);
        console.log(`   Current Price: $${item.currentPrice}`);
        console.log(`   Retail Price: $${item.retailPrice}`);
        console.log(`   Discount: ${discountPercent}%`);
        console.log(`   Location: ${item.location}`);
        console.log(`   Close Time: ${item.closeTime}`);
        console.log(`   Bids: ${item.bidCount || 0}`);
        console.log('');
      });
      
      // Show sample of all results
      console.log('\nAll Search Results (first 5):');
      results.hits.slice(0, 5).forEach((item, index) => {
        console.log(`${index + 1}. ${item.title} - $${item.currentPrice} (Retail: $${item.retailPrice || 'N/A'})`);
      });
      
      // Show available facets
      console.log('\nAvailable Locations:');
      if (results.facets && results.facets.location) {
        Object.entries(results.facets.location).forEach(([location, count]) => {
          console.log(`  - ${location}: ${count} items`);
        });
      }
    }
  } catch (error) {
    console.error('Error searching:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
testAlgoliaSearch();