const axios = require('axios');
const storage = require('./storage');

class NellisApi {
  constructor() {
    this.baseUrl = 'https://www.nellisauction.com';
    this.apiUrl = 'https://cargo.prd.nellis.run/api';
    this.cookies = '';
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
    this.initialized = false;
  }
  
  async initialize() {
    try {
      // Try to recover cookies from storage
      const savedCookies = await storage.getCookies();
      if (savedCookies) {
        this.cookies = savedCookies;
        console.log('Recovered authentication cookies from storage');
      }
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing NellisApi:', error);
    }
  }

  async getAuctionData(auctionId) {
    try {
      // Use the _data parameter to get JSON response
      const url = `${this.baseUrl}/p/product/${auctionId}?_data=routes/p.$title.$productId._index`;
      
      const response = await axios.get(url, {
        headers: {
          ...this.headers,
          'Cookie': this.cookies
        }
      });

      if (response.data && response.data.product) {
        const product = response.data.product;
        const timeRemaining = this.calculateTimeRemaining(product.closeTime?.value);
        const isClosed = product.isClosed || product.marketStatus === 'sold' || timeRemaining <= 0;
        
        return {
          id: product.id,
          title: product.title,
          currentBid: product.currentPrice || 0,
          nextBid: product.userState?.nextBid || product.currentPrice + 1,
          bidCount: product.bidCount || 0,
          bidderCount: product.bidderCount || 0,
          isWinning: product.userState?.isWinning || false,
          isWatching: product.userState?.isWatching || false,
          isClosed: isClosed,
          marketStatus: product.marketStatus,
          closeTime: product.closeTime?.value,
          extensionInterval: product.extensionInterval || 30,
          retailPrice: product.retailPrice,
          timeRemaining: timeRemaining,
          location: product.location,
          inventoryNumber: product.inventoryNumber
        };
      }

      throw new Error('Invalid response structure');
    } catch (error) {
      console.error(`Error fetching auction data for ${auctionId}:`, error.message);
      throw error;
    }
  }

  calculateTimeRemaining(closeTimeString) {
    if (!closeTimeString) return 0;
    
    const closeTime = new Date(closeTimeString);
    const now = new Date();
    const diff = closeTime - now;
    
    return Math.max(0, Math.floor(diff / 1000)); // Return seconds
  }

  async authenticate(credentials) {
    try {
      // This would implement the login flow
      // For now, we'll assume cookies are provided through configuration
      console.info('Authentication not yet implemented - using provided cookies');
      this.cookies = credentials.cookies || '';
      
      // Save cookies to storage
      if (this.cookies) {
        await storage.saveCookies(this.cookies);
        console.log('Saved authentication cookies to storage');
      }
      
      return true;
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  }

  async placeBid(auctionId, amount) {
    try {
      console.info(`Placing bid on auction ${auctionId} for $${amount}`);
      
      // Ensure amount is a whole number
      const bidAmount = Math.floor(amount);
      
      const response = await axios.post(`${this.baseUrl}/api/bids`, {
        productId: parseInt(auctionId),
        bid: bidAmount
      }, {
        headers: {
          ...this.headers,
          'Cookie': this.cookies,
          'Content-Type': 'text/plain;charset=UTF-8',
          'Accept': '*/*',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Referer': `${this.baseUrl}/p/product/${auctionId}`,
          'Origin': this.baseUrl
        }
      });
      
      // Check if response indicates success
      if (response.status === 200 || response.status === 201) {
        console.info(`Successfully placed bid of $${bidAmount} on auction ${auctionId}`);
        return {
          success: true,
          data: response.data,
          amount: bidAmount
        };
      } else {
        console.error(`Bid placement failed with status ${response.status}`);
        return {
          success: false,
          error: `Bid failed with status ${response.status}`,
          data: response.data
        };
      }
    } catch (error) {
      console.error(`Error placing bid on auction ${auctionId}:`, error);
      
      // Extract meaningful error message
      let errorMessage = error.message;
      if (error.response) {
        errorMessage = error.response.data?.error || error.response.data?.message || `Server error: ${error.response.status}`;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async getMultipleAuctions(auctionIds) {
    try {
      const promises = auctionIds.map(id => this.getAuctionData(id));
      const results = await Promise.allSettled(promises);
      
      return results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          console.error(`Failed to fetch auction ${auctionIds[index]}:`, result.reason);
          return null;
        }
      }).filter(Boolean);
    } catch (error) {
      console.error('Error fetching multiple auctions:', error);
      throw error;
    }
  }

  async searchAuctions(query, filters = {}) {
    try {
      // This would implement auction search
      // Using the Algolia search endpoint discovered in the analysis
      console.info(`Searching auctions with query: ${query}`);
      
      // Placeholder
      return [];
    } catch (error) {
      console.error('Error searching auctions:', error);
      throw error;
    }
  }
}

module.exports = new NellisApi();