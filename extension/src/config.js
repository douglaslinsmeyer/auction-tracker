/**
 * Central configuration for Nellis Auction Helper Extension
 */
const CONFIG = {
  // Backend Configuration
  BACKEND: {
    DEFAULT_URL: 'http://localhost:3000',
    DEFAULT_TOKEN: 'dev-token',
    DEFAULT_WS_URL: 'ws://localhost:3000'
  },
  
  // Extension Settings
  EXTENSION: {
    AUTO_REFRESH: true,
    REFRESH_INTERVAL: 5, // seconds
    SYNC_COOKIES: true,
    DEFAULT_STRATEGY: 'auto' // 'auto' or 'sniping'
  },
  
  // WebSocket Configuration
  WEBSOCKET: {
    RECONNECT_DELAY: 5000, // ms
    PING_INTERVAL: 25000, // ms - Keep alive ping
    MAX_RECONNECT_ATTEMPTS: 10
  },
  
  // API Endpoints
  API: {
    STATUS: '/api/status',
    AUTH: '/api/auth',
    AUCTIONS: '/api/auctions',
    AUCTION_CONFIG: '/api/auctions/:id/config',
    AUCTION_BID: '/api/auctions/:id/bid'
  },
  
  // WebSocket Endpoints
  WS: {
    PATH: '/ws'
  }
};

// Helper function to build API URLs
CONFIG.buildApiUrl = (endpoint, params = {}) => {
  let url = endpoint;
  // Replace path parameters
  Object.keys(params).forEach(key => {
    url = url.replace(`:${key}`, params[key]);
  });
  return url;
};

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}