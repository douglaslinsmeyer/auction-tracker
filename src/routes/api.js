const express = require('express');
const router = express.Router();
const auctionMonitor = require('../services/auctionMonitor');
const nellisApi = require('../services/nellisApi');
const storage = require('../services/storage');

// Get all monitored auctions
router.get('/auctions', (req, res) => {
  try {
    const auctions = auctionMonitor.getMonitoredAuctions();
    res.json({ success: true, auctions });
  } catch (error) {
    console.error('Error getting monitored auctions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get specific auction details
router.get('/auctions/:id', async (req, res) => {
  try {
    const auctionId = req.params.id;
    const data = await nellisApi.getAuctionData(auctionId);
    res.json({ success: true, data });
  } catch (error) {
    console.error(`Error getting auction ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

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
router.post('/auctions/:id/monitor', (req, res) => {
  try {
    const auctionId = req.params.id;
    const config = req.body.config || {};
    
    // Validate configuration
    const validationErrors = validateAuctionConfig(config);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Configuration validation failed',
        details: validationErrors
      });
    }
    
    const success = auctionMonitor.addAuction(auctionId, config);
    
    if (success) {
      res.json({ success: true, message: `Started monitoring auction ${auctionId}`, config });
    } else {
      res.status(400).json({ success: false, error: 'Auction already being monitored' });
    }
  } catch (error) {
    console.error(`Error starting monitoring for auction ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stop monitoring an auction
router.delete('/auctions/:id/monitor', (req, res) => {
  try {
    const auctionId = req.params.id;
    const success = auctionMonitor.removeAuction(auctionId);
    
    if (success) {
      res.json({ success: true, message: `Stopped monitoring auction ${auctionId}` });
    } else {
      res.status(404).json({ success: false, error: 'Auction not being monitored' });
    }
  } catch (error) {
    console.error(`Error stopping monitoring for auction ${req.params.id}:`, error);
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
    console.error(`Error stopping monitoring for auction ${req.params.id}:`, error);
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
    console.error('Error clearing all auctions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update auction configuration
router.put('/auctions/:id/config', (req, res) => {
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
    console.error(`Error updating config for auction ${req.params.id}:`, error);
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
    console.error(`Error getting bid history for auction ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Place a bid
router.post('/auctions/:id/bid', async (req, res) => {
  try {
    const auctionId = req.params.id;
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid bid amount' });
    }
    
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
    console.error(`Error placing bid on auction ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Set authentication credentials
router.post('/auth', async (req, res) => {
  try {
    console.log('Auth request received:', {
      body: req.body,
      headers: req.headers,
      contentType: req.get('content-type')
    });
    
    const { cookies } = req.body;
    
    if (!cookies) {
      console.log('Auth failed: No cookies in request body');
      return res.status(400).json({ success: false, error: 'Cookies required' });
    }
    
    const success = await nellisApi.authenticate({ cookies });
    res.json({ success });
  } catch (error) {
    console.error('Error setting authentication:', error);
    res.status(500).json({ success: false, error: error.message });
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
      console.log('Successfully fetched auction data:', {
        id: auctionData.id,
        title: auctionData.title,
        currentBid: auctionData.currentBid,
        isWinning: auctionData.isWinning
      });
    } catch (error) {
      console.error('Failed to fetch auction data:', error.message);
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
      console.log('Testing bid placement (dry run)...');
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
    console.error('Error validating authentication:', error);
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

module.exports = router;