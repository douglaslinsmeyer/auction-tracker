const express = require('express');
const router = express.Router();
const auctionMonitor = require('../services/auctionMonitor');
const nellisApi = require('../services/nellisApi');

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

// Start monitoring an auction
router.post('/auctions/:id/monitor', (req, res) => {
  try {
    const auctionId = req.params.id;
    const config = req.body.config || {};
    
    const success = auctionMonitor.addAuction(auctionId, config);
    
    if (success) {
      res.json({ success: true, message: `Started monitoring auction ${auctionId}` });
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
    
    // Update configuration
    auction.config = { ...auction.config, ...config };
    res.json({ success: true, config: auction.config });
  } catch (error) {
    console.error(`Error updating config for auction ${req.params.id}:`, error);
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

// Get system status
router.get('/status', (req, res) => {
  res.json({
    success: true,
    status: 'running',
    monitoredAuctions: auctionMonitor.getMonitoredCount(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

module.exports = router;