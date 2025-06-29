// API client for fetching auction data from Nellis JSON endpoints

async function fetchAuctionData(auctionId) {
  try {
    // Extract product ID from various formats
    const productId = auctionId.toString().replace(/[^0-9]/g, '');
    
    // Construct the JSON endpoint URL
    // The specific route data parameter for product pages
    const dataParam = encodeURIComponent('routes/p.$title.$productId._index');
    const url = `https://www.nellisauction.com/p/product/${productId}?_data=${dataParam}`;
    
    console.log('NAH: Fetching auction data from:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('NAH: Received auction data:', data);
    
    // Parse the data structure
    if (data && data.product) {
      const product = data.product;
      
      return {
        auctionId: product.id,
        title: product.title,
        currentBid: product.currentPrice || 0,
        nextBid: product.userState?.nextBid || product.currentPrice + 1,
        bidCount: product.bidCount || 0,
        bidderCount: product.bidderCount || 0,
        isWinning: product.userState?.isWinning || false,
        isWatching: product.userState?.isWatching || false,
        isClosed: product.isClosed || false,
        marketStatus: product.marketStatus,
        closeTime: product.closeTime?.value,
        extensionInterval: product.extensionInterval || 30,
        retailPrice: product.retailPrice,
        inventoryNumber: product.inventoryNumber,
        location: product.location,
        photos: product.photos,
        watchlistCount: product.watchlistCount || 0,
        // Calculate time remaining
        timeRemaining: calculateTimeRemaining(product.closeTime?.value)
      };
    }
    
    throw new Error('Invalid data structure received');
    
  } catch (error) {
    console.error('NAH: Error fetching auction data:', error);
    throw error;
  }
}

function calculateTimeRemaining(closeTimeString) {
  if (!closeTimeString) return 0;
  
  const closeTime = new Date(closeTimeString);
  const now = new Date();
  const diff = closeTime - now;
  
  return Math.max(0, Math.floor(diff / 1000)); // Return seconds
}

// For content script usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { fetchAuctionData };
}