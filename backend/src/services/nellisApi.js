const axios = require('axios');
const storage = require('./storage');
const logger = require('../utils/logger');

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
        logger.logAuthActivity('cookies_recovered', true);
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
          minimumBid: product.userState?.nextBid || product.currentPrice + 1, // Alias for nextBid
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
      if (error.response && error.response.status === 400) {
        console.error(`400 Bad Request for auction ${auctionId}:`, error.response.data);
        console.error('Request URL:', url);
        console.error('Request headers:', this.headers);
      } else {
        console.error(`Error fetching auction data for ${auctionId}:`, error.message);
      }
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
        logger.logAuthActivity('cookies_saved', true);
      }
      
      return true;
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  }

  // Alias for authenticate - sets cookies directly
  async setCookies(cookieString) {
    this.cookies = cookieString || '';
    if (this.cookies) {
      await storage.saveCookies(this.cookies);
    }
    return true;
  }

  // Check authentication status
  async checkAuth() {
    const hasCookies = !!this.cookies && this.cookies.length > 0;
    const cookieCount = hasCookies ? this.cookies.split(';').length : 0;
    
    return {
      authenticated: hasCookies,
      cookieCount: cookieCount
    };
  }

  async placeBid(auctionId, amount, retryCount = 0) {
    try {
      logger.logBidActivity('placing_bid', auctionId, amount);
      
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
        },
        timeout: 10000 // 10 second timeout
      });
      
      // Check if response indicates success
      if (response.status === 200 || response.status === 201) {
        logger.logBidActivity('bid_placed', auctionId, bidAmount, { success: true });
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
      let errorType = 'UNKNOWN_ERROR';
      
      if (error.response) {
        const responseError = error.response.data?.error || error.response.data?.message;
        if (responseError) {
          errorMessage = responseError;
          
          // Categorize specific error types
          if (responseError.includes('already placed a bid with the same price')) {
            errorType = 'DUPLICATE_BID_AMOUNT';
          } else if (responseError.includes('bid is too low') || responseError.includes('minimum bid')) {
            errorType = 'BID_TOO_LOW';
          } else if (responseError.includes('auction has ended') || responseError.includes('closed')) {
            errorType = 'AUCTION_ENDED';
          } else if (responseError.includes('authentication') || responseError.includes('login')) {
            errorType = 'AUTHENTICATION_ERROR';
          } else if (responseError.includes('outbid') || responseError.includes('higher bid')) {
            errorType = 'OUTBID';
          }
        } else {
          errorMessage = `Server error: ${error.response.status}`;
          errorType = 'SERVER_ERROR';
        }
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        errorType = 'CONNECTION_ERROR';
      }
      
      const result = {
        success: false,
        error: errorMessage,
        errorType: errorType,
        retryable: ['CONNECTION_ERROR', 'SERVER_ERROR'].includes(errorType)
      };
      
      // Retry logic based on settings
      if (result.retryable && retryCount === 0) {
        const globalSettings = await storage.getSettings();
        const maxRetries = globalSettings.bidding.retryAttempts || 3;
        
        if (retryCount < maxRetries - 1) {
          console.log(`Retrying bid (attempt ${retryCount + 2} of ${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
          return this.placeBid(auctionId, amount, retryCount + 1);
        }
      }
      
      return result;
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