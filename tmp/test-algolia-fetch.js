async function testAlgoliaSearch() {
  console.log('Testing Nellis Auction Algolia Search API with fetch...\n');
  
  // Algolia configuration
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
    const response = await fetch(
      `https://${algoliaAppId}-dsn.algolia.net/1/indexes/*/queries`,
      {
        method: 'POST',
        headers: {
          'X-Algolia-Application-Id': algoliaAppId,
          'X-Algolia-API-Key': algoliaApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(searchBody)
      }
    );
    
    const data = await response.json();
    
    if (data && data.results && data.results[0]) {
      const results = data.results[0];
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
    } else {
      console.log('No results found or unexpected response format');
      console.log('Response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('Error searching:', error.message);
  }
}

// Run the test
testAlgoliaSearch();