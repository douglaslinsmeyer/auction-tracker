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
      logger.error('Error initializing NellisApi', { error: error.message, stack: error.stack });
    }
  }

  async getAuctionData(auctionId) {
    // Use the _data parameter to get JSON response
    const url = `${this.baseUrl}/p/product/${auctionId}?_data=routes/p.$title.$productId._index`;

    try {
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
        logger.error(`400 Bad Request for auction ${auctionId}`, { responseData: error.response.data });
        logger.debug('Request details', { url });
        logger.debug('Request headers', { headers: this.headers });
      } else {
        logger.error(`Error fetching auction data for ${auctionId}`, { error: error.message });
      }
      throw error;
    }
  }

  calculateTimeRemaining(closeTimeString) {
    if (!closeTimeString) { return 0; }

    const closeTime = new Date(closeTimeString);
    const now = new Date();
    const diff = closeTime - now;

    return Math.max(0, Math.floor(diff / 1000)); // Return seconds
  }

  // Removed duplicate authenticate method - see line 289 for actual implementation
  // The authenticate method below (line 289) handles cookie validation properly

  // Alias for authenticate - sets cookies directly
  async setCookies(cookieString) {
    this.cookies = cookieString || '';
    if (this.cookies) {
      await storage.saveCookies(this.cookies);
    }
    return true;
  }

  // Check authentication status
  checkAuth() {
    const hasCookies = Boolean(this.cookies) && this.cookies.length > 0;
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
        productId: parseInt(auctionId, 10),
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
        logger.error(`Bid placement failed with status ${response.status}`);
        return {
          success: false,
          error: `Bid failed with status ${response.status}`,
          data: response.data
        };
      }
    } catch (error) {
      logger.error(`Error placing bid on auction ${auctionId}`, { error: error.message, stack: error.stack });

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
          logger.info(`Retrying bid (attempt ${retryCount + 2} of ${maxRetries})...`);
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
          logger.error(`Failed to fetch auction ${auctionIds[index]}`, { error: result.reason });
          return null;
        }
      }).filter(Boolean);
    } catch (error) {
      logger.error('Error fetching multiple auctions', { error: error.message });
      throw error;
    }
  }

  async getListingsDetails(productIds) {
    try {
      if (!productIds || productIds.length === 0) {
        return [];
      }

      logger.info(`Fetching details for ${productIds.length} products`);

      // Use the /api/listings endpoint
      const response = await axios.post(
        `${this.baseUrl}/api/listings`,
        {
          productIds: productIds,
          action: 'get-open-listings'
        },
        {
          headers: {
            ...this.headers,
            'Cookie': this.cookies,
            'Content-Type': 'text/plain;charset=UTF-8',
            'Accept': '*/*',
            'Origin': this.baseUrl,
            'Referer': `${this.baseUrl}/search`
          }
        }
      );

      if (response.data && Array.isArray(response.data)) {
        // Transform the listings data to our format
        return response.data.map(listing => ({
          id: listing.id || listing.productId,
          title: listing.title,
          currentBid: listing.currentPrice || 0,
          retailPrice: listing.retailPrice || 0,
          location: typeof listing.location === 'object' ? listing.location.name : listing.location,
          closeTime: listing.closeTime,
          imageUrl: listing.imageUrl || listing.image || (listing.photos && listing.photos.length > 0 ? (typeof listing.photos[0] === 'string' ? listing.photos[0] : listing.photos[0].url) : null),
          photos: listing.photos || [],
          condition: listing.condition,
          categories: listing.categories,
          bidCount: listing.bidCount || 0,
          inventoryNumber: listing.inventoryNumber,
          timeRemaining: this.calculateTimeRemaining(listing.closeTime),
          discountPercentage: listing.retailPrice > 0
            ? Math.round((1 - (listing.currentPrice / listing.retailPrice)) * 100)
            : 0,
          auctionUrl: `${this.baseUrl}/p/product/${listing.id || listing.productId}`
        }));
      }

      return [];
    } catch (error) {
      logger.error('Error fetching listings details', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  async searchAuctions(query, filters = {}) {
    try {
      logger.info(`Searching auctions with query: ${query}`, { filters });

      // Fetch the search page
      const searchUrl = `${this.baseUrl}/search?query=${encodeURIComponent(query)}`;
      const response = await axios.get(searchUrl, {
        headers: {
          ...this.headers,
          'Cookie': this.cookies,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });

      if (response.status !== 200) {
        throw new Error(`Search request failed with status ${response.status}`);
      }

      // Extract product data from the Remix context
      const html = response.data;
      const jsonDataMatch = html.match(/window\.__remixContext\s*=\s*({.*?});/s);

      if (!jsonDataMatch) {
        logger.warn('Could not find Remix context data in search results');
        return [];
      }

      try {
        const remixData = JSON.parse(jsonDataMatch[1]);

        // Find product data in the loader data
        if (remixData.state && remixData.state.loaderData) {
          const routeData = Object.values(remixData.state.loaderData);

          for (const data of routeData) {
            if (data && data.products && Array.isArray(data.products)) {
              let products = data.products;

              // Apply location filter if specified
              if (filters.location) {
                products = products.filter(p => {
                  const productLocation = typeof p.location === 'object' ? p.location.name : p.location;
                  return productLocation && productLocation.toLowerCase().includes(filters.location.toLowerCase());
                });
              }

              // Transform to our format
              return products.map(product => {
                // Try to find image URL from various possible fields
                let imageUrl = product.imageUrl || product.image || product.primaryImage;

                // If no image URL, try to extract from photos array (most common)
                if (!imageUrl && product.photos && Array.isArray(product.photos) && product.photos.length > 0) {
                  const firstPhoto = product.photos[0];
                  imageUrl = typeof firstPhoto === 'string' ? firstPhoto : (firstPhoto.url || firstPhoto);
                }

                // If no image URL, try to extract from images array
                if (!imageUrl && product.images && Array.isArray(product.images) && product.images.length > 0) {
                  imageUrl = product.images[0];
                }

                // If still no image, we'll construct a URL to fetch later
                if (!imageUrl) {
                  // We'll use a placeholder that indicates we need to fetch the image
                  imageUrl = null;
                }

                return {
                  id: product.id,
                  title: product.title,
                  currentBid: product.currentPrice || 0,
                  retailPrice: product.retailPrice || 0,
                  location: typeof product.location === 'object' ? product.location.name : product.location,
                  closeTime: product.closeTime,
                  imageUrl: imageUrl,
                  photos: product.photos || [],
                  condition: product.condition,
                  categories: product.categories,
                  bidCount: product.bidCount || 0,
                  inventoryNumber: product.inventoryNumber,
                  discountPercentage: product.retailPrice > 0
                    ? Math.round((1 - (product.currentPrice / product.retailPrice)) * 100)
                    : 0,
                  auctionUrl: `https://www.nellisauction.com/p/product/${product.id}`
                };
              });
            }
          }
        }
      } catch (parseError) {
        logger.error('Error parsing search results', { error: parseError.message });
      }

      return [];
    } catch (error) {
      logger.error('Error searching auctions', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  async validateCookies() {
    try {
      if (!this.cookies) {
        return false;
      }

      // Try to make a simple authenticated request to validate cookies
      const testUrl = `${this.baseUrl}/account`;
      const response = await axios.get(testUrl, {
        headers: {
          ...this.headers,
          'Cookie': this.cookies
        },
        maxRedirects: 0,
        validateStatus: status => status < 400
      });

      // If we get a 200, cookies are valid
      // If we get a 302 redirect to login, cookies are invalid
      return response.status === 200;
    } catch (error) {
      logger.debug('Cookie validation failed', { error: error.message });
      return false;
    }
  }

  async authenticate(credentials) {
    try {
      if (!credentials || !credentials.cookies) {
        throw new Error('Cookies are required for authentication');
      }

      // Set the cookies
      await this.setCookies(credentials.cookies);

      // Save cookies to storage
      await storage.saveCookies(credentials.cookies);

      // Validate the cookies by making a test request
      const isValid = await this.validateCookies();

      if (isValid) {
        logger.logAuthActivity('authenticate', true);
        return true;
      } else {
        logger.logAuthActivity('authenticate', false, 'Invalid cookies');
        return false;
      }
    } catch (error) {
      logger.error('Error authenticating', { error: error.message, stack: error.stack });
      logger.logAuthActivity('authenticate', false, error.message);
      throw error;
    }
  }
}

module.exports = new NellisApi();