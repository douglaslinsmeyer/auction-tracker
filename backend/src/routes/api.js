const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const auctionMonitor = require('../services/auctionMonitor');
const nellisApi = require('../services/nellisApi');
const storage = require('../services/storage');
const { validateBody, validateAuctionId } = require('../middleware/validation');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Create a specific rate limiter for bid operations
const bidLimiter = rateLimit({
  windowMs: parseInt(process.env.BID_RATE_LIMIT_WINDOW_MS) || 60 * 1000, // 1 minute window
  max: parseInt(process.env.BID_RATE_LIMIT_MAX) || 10, // limit each IP to 10 bid requests per minute
  message: 'Too many bid attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by IP + auction ID to prevent bid spamming on specific auctions
    return `${req.ip}:${req.params.id}`;
  },
  handler: (req, res) => {
    logger.warn(`Bid rate limit exceeded for IP ${req.ip} on auction ${req.params.id}`);
    res.status(429).json({
      success: false,
      error: 'Too many bid attempts on this auction. Please wait before trying again.',
      code: 'BID_RATE_LIMIT_EXCEEDED'
    });
  }
});

// Get all monitored auctions
router.get('/auctions', asyncHandler(async (req, res) => {
  const auctions = auctionMonitor.getMonitoredAuctions();
  res.json({ success: true, auctions });
}));

// Get specific auction details
router.get('/auctions/:id', validateAuctionId, asyncHandler(async (req, res) => {
  const auctionId = req.params.id;
  const data = await nellisApi.getAuctionData(auctionId);
  res.json({ success: true, data });
}));

// Validate auction configuration
function validateAuctionConfig(config) {
  const errors = [];
  
  // Validate strategy
  const validStrategies = ['manual', 'increment', 'sniping'];
  if (config.strategy && !validStrategies.includes(config.strategy)) {
    errors.push(`Invalid strategy: ${config.strategy}. Must be one of: ${validStrategies.join(', ')}`);
  }
  
  // Validate maxBid for non-manual strategies
  if (config.strategy && config.strategy !== 'manual') {
    if (!config.maxBid) {
      errors.push(`maxBid is required for ${config.strategy} strategy`);
    } else if (typeof config.maxBid !== 'number' || isNaN(config.maxBid)) {
      errors.push('maxBid must be a valid number');
    } else if (config.maxBid <= 0) {
      errors.push('maxBid must be greater than 0');
    } else if (config.maxBid > 10000) {
      errors.push('maxBid cannot exceed $10,000 for safety');
    }
  }
  
  // Validate spending limits
  if (config.dailyLimit !== undefined) {
    if (typeof config.dailyLimit !== 'number' || isNaN(config.dailyLimit)) {
      errors.push('dailyLimit must be a valid number');
    } else if (config.dailyLimit <= 0) {
      errors.push('dailyLimit must be greater than 0');
    } else if (config.dailyLimit > 50000) {
      errors.push('dailyLimit cannot exceed $50,000');
    }
  }
  
  if (config.totalLimit !== undefined) {
    if (typeof config.totalLimit !== 'number' || isNaN(config.totalLimit)) {
      errors.push('totalLimit must be a valid number');
    } else if (config.totalLimit <= 0) {
      errors.push('totalLimit must be greater than 0');
    } else if (config.totalLimit > 100000) {
      errors.push('totalLimit cannot exceed $100,000');
    }
  }
  
  // Validate increment
  if (config.increment !== undefined) {
    if (typeof config.increment !== 'number' || isNaN(config.increment)) {
      errors.push('increment must be a valid number');
    } else if (config.increment <= 0) {
      errors.push('increment must be greater than 0');
    } else if (config.increment > 1000) {
      errors.push('increment cannot exceed $1,000');
    }
  }
  
  // Validate enabled flag
  if (config.enabled !== undefined && typeof config.enabled !== 'boolean') {
    errors.push('enabled must be a boolean value');
  }
  
  return errors;
}

// Start monitoring an auction
router.post('/auctions/:id/monitor', validateAuctionId, validateBody('StartMonitoring'), async (req, res) => {
  try {
    const auctionId = req.params.id;
    const { config, metadata } = req.body;
    
    const success = await auctionMonitor.addAuction(auctionId, config, metadata);
    
    if (success) {
      res.json({ success: true, message: `Started monitoring auction ${auctionId}`, config });
    } else {
      res.status(409).json({ success: false, error: 'Auction already being monitored' });
    }
  } catch (error) {
    logger.error(`Error starting monitoring for auction ${req.params.id}:`, error.message);
    next(error);
  }
});

// Stop monitoring an auction
router.delete('/auctions/:id/monitor', validateAuctionId, (req, res) => {
  try {
    const auctionId = req.params.id;
    const success = auctionMonitor.removeAuction(auctionId);
    
    if (success) {
      res.json({ success: true, message: `Stopped monitoring auction ${auctionId}` });
    } else {
      res.status(404).json({ success: false, error: 'Auction not being monitored' });
    }
  } catch (error) {
    logger.error(`Error stopping monitoring for auction ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stop monitoring an auction (POST endpoint for UI compatibility)
router.post('/auctions/:id/stop', (req, res) => {
  try {
    const auctionId = req.params.id;
    const success = auctionMonitor.removeAuction(auctionId);
    
    if (success) {
      res.json({ success: true, message: `Stopped monitoring auction ${auctionId}` });
    } else {
      res.status(404).json({ success: false, error: 'Auction not being monitored' });
    }
  } catch (error) {
    logger.error(`Error stopping monitoring for auction ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear all monitored auctions
router.post('/auctions/clear', (req, res) => {
  try {
    const auctions = auctionMonitor.getMonitoredAuctions();
    let cleared = 0;
    
    auctions.forEach(auction => {
      if (auctionMonitor.removeAuction(auction.id)) {
        cleared++;
      }
    });
    
    res.json({ 
      success: true, 
      message: `Cleared ${cleared} auctions`,
      cleared 
    });
  } catch (error) {
    logger.error('Error clearing all auctions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update auction configuration
router.put('/auctions/:id/config', validateAuctionId, validateBody('AuctionConfigUpdate'), async (req, res) => {
  try {
    const auctionId = req.params.id;
    const config = req.body.config;
    
    const auction = auctionMonitor.monitoredAuctions.get(auctionId);
    if (!auction) {
      return res.status(404).json({ success: false, error: 'Auction not being monitored' });
    }
    
    // Merge new config with existing and validate
    const mergedConfig = { ...auction.config, ...config };
    const validationErrors = validateAuctionConfig(mergedConfig);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Configuration validation failed',
        details: validationErrors
      });
    }
    
    // Update configuration
    auction.config = mergedConfig;
    
    // Save updated auction to storage
    auctionMonitor.updateAuctionConfig(auctionId, mergedConfig);
    
    res.json({ success: true, config: auction.config });
  } catch (error) {
    logger.error(`Error updating config for auction ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get bid history for an auction
router.get('/auctions/:id/bids', async (req, res) => {
  try {
    const auctionId = req.params.id;
    const limit = parseInt(req.query.limit) || 50;
    
    if (limit > 100) {
      return res.status(400).json({ success: false, error: 'Limit cannot exceed 100' });
    }
    
    const bidHistory = await storage.getBidHistory(auctionId, limit);
    res.json({
      success: true,
      auctionId,
      bidHistory,
      count: bidHistory.length
    });
  } catch (error) {
    logger.error(`Error getting bid history for auction ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Place a bid (with rate limiting)
router.post('/auctions/:id/bid', validateAuctionId, bidLimiter, validateBody('Bid'), async (req, res) => {
  try {
    const auctionId = req.params.id;
    const { amount } = req.body;
    
    const result = await nellisApi.placeBid(auctionId, amount);
    
    // Handle different error types with appropriate HTTP status codes
    if (!result.success && result.errorType) {
      const statusMap = {
        'DUPLICATE_BID_AMOUNT': 409, // Conflict
        'BID_TOO_LOW': 400,          // Bad Request
        'AUCTION_ENDED': 410,        // Gone
        'AUTHENTICATION_ERROR': 401, // Unauthorized
        'OUTBID': 409,              // Conflict
        'CONNECTION_ERROR': 503,     // Service Unavailable
        'SERVER_ERROR': 502,         // Bad Gateway
        'UNKNOWN_ERROR': 500         // Internal Server Error
      };
      
      const statusCode = statusMap[result.errorType] || 500;
      return res.status(statusCode).json(result);
    }
    
    res.json(result);
  } catch (error) {
    logger.error(`Error placing bid on auction ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Set authentication credentials
router.post('/auth', validateBody('Auth'), async (req, res) => {
  try {
    logger.info('Auth request received:', {
      body: req.body,
      headers: req.headers,
      contentType: req.get('content-type')
    });
    
    const { cookies } = req.body;
    
    if (!cookies) {
      logger.warn('Auth failed: No cookies in request body');
      return res.status(400).json({ 
        success: false, 
        error: 'Cookies required',
        code: 'MISSING_COOKIES'
      });
    }
    
    const success = await nellisApi.authenticate({ cookies });
    res.json({ success });
  } catch (error) {
    logger.error('Error setting authentication:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Validate authentication and test bid placement
router.post('/auth/validate', async (req, res) => {
  try {
    const { auctionId, testBidAmount } = req.body;
    
    // Check if we have cookies
    if (!nellisApi.cookies) {
      return res.json({ 
        success: false, 
        authenticated: false,
        error: 'No authentication cookies set'
      });
    }
    
    // Test 1: Try to fetch auction data (validates cookies work)
    let auctionData = null;
    try {
      auctionData = await nellisApi.getAuctionData(auctionId || '57938394');
      logger.info('Successfully fetched auction data:', {
        id: auctionData.id,
        title: auctionData.title,
        currentBid: auctionData.currentBid,
        isWinning: auctionData.isWinning
      });
    } catch (error) {
      logger.error('Failed to fetch auction data:', error.message);
      return res.json({
        success: false,
        authenticated: false,
        error: 'Failed to fetch auction data - cookies may be invalid',
        details: error.message
      });
    }
    
    // Test 2: Check user state in auction
    const userAuthenticated = auctionData.isWatching !== undefined || auctionData.isWinning !== undefined;
    
    // Test 3: Optionally test bid placement (dry run)
    let bidTestResult = null;
    if (testBidAmount && auctionData && !auctionData.isClosed) {
      logger.info('Testing bid placement (dry run)...');
      // For safety, we'll only test with a bid that's below current bid
      const safeBidAmount = Math.min(testBidAmount, auctionData.currentBid - 1);
      
      try {
        // Note: This will likely fail but we can check the error response
        bidTestResult = await nellisApi.placeBid(auctionData.id, safeBidAmount);
      } catch (error) {
        bidTestResult = {
          tested: true,
          error: error.message,
          // A specific error about bid being too low is actually good - means auth works
          likelyAuthenticated: error.message.includes('bid') || error.message.includes('amount')
        };
      }
    }
    
    res.json({
      success: true,
      authenticated: userAuthenticated,
      cookiesSet: !!nellisApi.cookies,
      auctionDataFetched: !!auctionData,
      userState: {
        isWatching: auctionData?.isWatching,
        isWinning: auctionData?.isWinning
      },
      bidTestResult,
      testAuction: auctionData ? {
        id: auctionData.id,
        title: auctionData.title,
        currentBid: auctionData.currentBid,
        nextBid: auctionData.nextBid,
        timeRemaining: auctionData.timeRemaining
      } : null
    });
  } catch (error) {
    logger.error('Error validating authentication:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    });
  }
});

// Get authentication status
router.get('/auth/status', async (req, res) => {
  try {
    const authStatus = await nellisApi.checkAuth();
    
    res.json({
      authenticated: authStatus.authenticated,
      cookieCount: authStatus.cookieCount,
      cookiesSet: authStatus.authenticated,
      cookies: nellisApi.cookies || null,
      message: authStatus.authenticated ? 'Cookies are set' : 'No cookies set - please sync from extension'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get system status
router.get('/status', async (req, res) => {
  const redisHealthy = await storage.isHealthy();
  
  res.json({
    success: true,
    status: 'running',
    monitoredAuctions: auctionMonitor.getMonitoredCount(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    hotReload: true,
    timestamp: new Date().toISOString(),
    storage: {
      type: storage.connected ? 'redis' : 'memory',
      connected: storage.connected,
      healthy: redisHealthy
    }
  });
});

// Get global settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await storage.getSettings();
    res.json({ success: true, settings });
  } catch (error) {
    logger.error('Error getting settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get feature flag status
router.get('/features', (req, res) => {
  const featureFlags = require('../config/features');
  const status = featureFlags.getStatus();
  res.json({ 
    success: true, 
    features: status,
    phase: 3,
    description: 'Performance & Architecture improvements'
  });
});

// Get circuit breaker status
router.get('/circuit-breaker', (req, res) => {
  try {
    // Check if circuit breaker is in use
    if (nellisApi.getCircuitBreakerStatus) {
      const status = nellisApi.getCircuitBreakerStatus();
      res.json({
        success: true,
        circuitBreaker: status
      });
    } else {
      res.json({
        success: true,
        circuitBreaker: {
          enabled: false,
          message: 'Circuit breaker feature not enabled or not wrapped'
        }
      });
    }
  } catch (error) {
    logger.error('Error getting circuit breaker status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update global settings
router.post('/settings', validateBody('Settings'), async (req, res) => {
  try {
    const settings = req.body; // validateBody already handles the validation
    
    // Validate settings structure
    const validationErrors = [];
    
    // Validate general settings
    if (settings.general) {
      if (settings.general.defaultMaxBid !== undefined) {
        const maxBid = settings.general.defaultMaxBid;
        if (typeof maxBid !== 'number' || maxBid < 1 || maxBid > 10000) {
          validationErrors.push('defaultMaxBid must be between 1 and 10000');
        }
      }
      
      if (settings.general.defaultStrategy !== undefined) {
        const validStrategies = ['increment', 'sniping'];
        if (!validStrategies.includes(settings.general.defaultStrategy)) {
          validationErrors.push(`defaultStrategy must be one of: ${validStrategies.join(', ')}`);
        }
      }
      
      if (settings.general.autoBidDefault !== undefined && typeof settings.general.autoBidDefault !== 'boolean') {
        validationErrors.push('autoBidDefault must be a boolean');
      }
    }
    
    // Validate bidding settings
    if (settings.bidding) {
      if (settings.bidding.snipeTiming !== undefined) {
        const timing = settings.bidding.snipeTiming;
        if (typeof timing !== 'number' || timing < 1 || timing > 30) {
          validationErrors.push('snipeTiming must be between 1 and 30 seconds');
        }
      }
      
      if (settings.bidding.bidBuffer !== undefined) {
        const buffer = settings.bidding.bidBuffer;
        if (typeof buffer !== 'number' || buffer < 0 || buffer > 100) {
          validationErrors.push('bidBuffer must be between 0 and 100');
        }
      }
      
      if (settings.bidding.retryAttempts !== undefined) {
        const attempts = settings.bidding.retryAttempts;
        if (typeof attempts !== 'number' || attempts < 1 || attempts > 10) {
          validationErrors.push('retryAttempts must be between 1 and 10');
        }
      }
    }
    
    // Notification settings validation removed
    
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Settings validation failed',
        details: validationErrors
      });
    }
    
    // Save settings
    await storage.saveSettings(settings);
    
    res.json({ success: true, settings });
  } catch (error) {
    logger.error('Error saving settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;