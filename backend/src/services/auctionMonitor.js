const cron = require('node-cron');
const nellisApi = require('./nellisApi');
const EventEmitter = require('events');
const WebSocket = require('ws');
const storage = require('./storage');
const SafeMath = require('../utils/safeMath');
const logger = require('../utils/logger');
const features = require('../config/features');
const prometheusMetrics = require('../utils/prometheusMetrics');

class AuctionMonitor extends EventEmitter {
  constructor() {
    super();
    // Increase max listeners to handle SSE event listeners in tests
    this.setMaxListeners(20);
    this.monitoredAuctions = new Map();
    this.pollingIntervals = new Map();
    this.wss = null;
    this.storageInitialized = false;
    this.broadcastHandler = null;
    this.cleanupInterval = null;
    this.sseClient = null; // Will be initialized later
  }

  async initialize(wss, broadcastHandler = null) {
    this.wss = wss;
    this.broadcastHandler = broadcastHandler;
    
    // Initialize storage
    await storage.initialize();
    this.storageInitialized = true;
    
    // Initialize SSE client if available
    await this.initializeSSEClient();
    
    // Recover persisted auctions
    await this.recoverPersistedState();
    
    // Start periodic cleanup of ended auctions
    this.startCleanupTimer();
    
    console.log('Auction monitor initialized with persistence');
  }
  
  async initializeSSEClient() {
    try {
      // Import SSE client lazily to avoid circular dependencies
      const sseClient = require('./sseClient');
      this.sseClient = sseClient;
      
      // Set the event emitter to this auction monitor
      this.sseClient.eventEmitter = this;
      
      await this.sseClient.initialize();
      
      // Set up event listeners for SSE events
      this.setupSSEEventListeners();
      
      logger.info('SSE client initialized and connected to auction monitor');
    } catch (error) {
      logger.error('Failed to initialize SSE client:', error);
      this.sseClient = null;
    }
  }
  
  setupSSEEventListeners() {
    if (!this.sseClient) return;
    
    // The SSE client will emit events on this auction monitor
    // Listen for SSE auction updates
    this.on('auction:update', (updateData) => {
      this.handleSSEAuctionUpdate(updateData);
    });
    
    // Listen for SSE auction closed events
    this.on('auction:closed', (closeData) => {
      this.handleSSEAuctionClosed(closeData);
    });
    
    // Listen for SSE fallback events
    this.on('sse:fallback', (fallbackData) => {
      this.handleSSEFallback(fallbackData);
    });
  }
  
  setBroadcastHandler(handler) {
    this.broadcastHandler = handler;
  }
  
  async recoverPersistedState() {
    try {
      console.log('Recovering persisted auction state...');
      const auctions = await storage.getAllAuctions();
      
      if (auctions.length > 0) {
        console.log(`Found ${auctions.length} persisted auctions`);
        
        for (const auction of auctions) {
          // Don't start polling for ended auctions
          if (auction.status !== 'ended') {
            this.monitoredAuctions.set(auction.id, auction);
            await this.startMonitoring(auction.id, auction);
            console.log(`Recovered auction ${auction.id}: ${auction.title}`);
          }
        }
      }
    } catch (error) {
      console.error('Error recovering persisted state:', error);
    }
  }

  async addAuction(auctionId, config = {}, metadata = {}) {
    if (this.monitoredAuctions.has(auctionId)) {
      console.warn(`Auction ${auctionId} is already being monitored`);
      return false;
    }

    // Get global settings
    const globalSettings = await storage.getSettings() || {};
    const generalSettings = globalSettings.general || {};

    const auction = {
      id: auctionId,
      title: metadata.title || 'Unknown',
      url: metadata.url || '',
      imageUrl: metadata.imageUrl || null,
      config: {
        maxBid: config.maxBid || generalSettings.defaultMaxBid || 100,
        incrementAmount: config.incrementAmount || 1,
        strategy: config.strategy || generalSettings.defaultStrategy || 'auto',
        autoBid: config.autoBid !== undefined ? config.autoBid : generalSettings.autoBidDefault !== undefined ? generalSettings.autoBidDefault : true,
        // Notification settings removed
      },
      lastUpdate: Date.now(),
      status: 'monitoring',
      data: null
    };

    this.monitoredAuctions.set(auctionId, auction);
    
    // Persist to storage
    await storage.saveAuction(auctionId, auction);
    
    // Start monitoring (SSE or polling)
    await this.startMonitoring(auctionId, auction);
    
    // Update Prometheus metrics
    prometheusMetrics.metrics.business.totalAuctions.inc();
    prometheusMetrics.metrics.business.activeAuctions.set(this.monitoredAuctions.size);
    
    console.log(`Started monitoring auction ${auctionId}`);
    return true;
  }

  async removeAuction(auctionId) {
    if (!this.monitoredAuctions.has(auctionId)) {
      return false;
    }

    this.stopPolling(auctionId);
    this.monitoredAuctions.delete(auctionId);
    
    // Remove from storage
    await storage.removeAuction(auctionId);
    
    console.log(`Stopped monitoring auction ${auctionId}`);
    return true;
  }

  async updateAuction(auctionId) {
    console.log(`Updating auction ${auctionId}`);
    const auction = this.monitoredAuctions.get(auctionId);
    if (!auction) return;

    try {
      const data = await nellisApi.getAuctionData(auctionId);
      const previousData = auction.data;
      auction.data = data;
      auction.lastUpdated = Date.now();

      // Check if auction has ended
      if (data.isClosed || data.timeRemaining <= 0) {
        auction.status = 'ended';
        this.handleAuctionEnd(auctionId, data);
        return;
      }

      // Check for bid changes
      if (previousData && previousData.currentBid !== data.currentBid) {
        this.handleBidUpdate(auctionId, data, previousData);
      }

      // Check for 30-second rule
      if (data.timeRemaining <= 30 && data.timeRemaining > 0) {
        this.adjustPollingRate(auctionId, 2000); // Poll every 2 seconds
      }

      // Persist updated auction state
      await storage.saveAuction(auctionId, auction);
      
      // Broadcast full auction state to WebSocket clients
      this.broadcastAuctionState(auctionId);

      // Execute auto-bid based on strategy and autoBid flag
      if (auction.config.strategy !== 'manual' && 
          auction.config.autoBid === true) {
        this.executeAutoBid(auctionId, data);
      }

    } catch (error) {
      console.error(`Error updating auction ${auctionId}:`, error);
      auction.status = 'error';
      await storage.saveAuction(auctionId, auction);
    }
  }

  handleBidUpdate(auctionId, newData, oldData) {
    const auction = this.monitoredAuctions.get(auctionId);
    if (!auction) return;

    console.log(`Bid update for auction ${auctionId}: $${oldData.currentBid} -> $${newData.currentBid}`);

    // Check if we've been outbid
    if (newData.isWinning === false && oldData.isWinning === true) {
      this.handleOutbid(auctionId, newData);
    }
  }

  async executeAutoBid(auctionId, auctionData) {
    console.log(`Executing auto-bid for auction ${auctionId}`);
    const auction = this.monitoredAuctions.get(auctionId);
    if (!auction) return;

    if (auction.isWinning) {
      return; // Already winning, no need to bid
    }

    // Check strategy
    // Auto strategy always allows auto-bidding when enabled
    // Sniping strategy only auto-bids in the last seconds
    if (!auction.config.autoBid) {
      return; // No auto-bidding for manual strategy
    }

    // Get global settings for bidding logic
    const globalSettings = await storage.getSettings() || {};
    const biddingSettings = globalSettings.bidding || {};

    // For sniping strategy, use configured snipe timing
    if (auction.config.strategy === 'sniping' && auctionData.timeRemaining > (biddingSettings.snipeTiming || 30)) {
      return;
    }

    // Calculate next bid with buffer using safe math
    const currentBid = SafeMath.validateBidAmount(auctionData.currentBid || 0);
    const increment = auction.config.incrementAmount || biddingSettings.defaultIncrement || 5;
    const buffer = biddingSettings.bidBuffer || 0;
    
    const minimumBid = auctionData.nextBid 
      ? SafeMath.validateBidAmount(auctionData.nextBid)
      : SafeMath.calculateNextBid(currentBid, increment, 0);
    
    // If we have a specific nextBid from auction data, use it directly with buffer
    // Otherwise calculate with increment
    const nextBid = auctionData.nextBid 
      ? SafeMath.addMoney(minimumBid, buffer)
      : SafeMath.calculateNextBid(minimumBid, 0, buffer);

    if (SafeMath.isWithinBudget(nextBid, auction.config.maxBid)) {
      auction.maxBidReached = false;
      try {
        logger.logBidActivity('auto_bid_executing', auctionId, nextBid, { strategy: auction.config.strategy });
        const result = await nellisApi.placeBid(auctionId, nextBid);
        
        if (result.success) {
          auction.lastBidAmount = nextBid;
          auction.lastBidTime = Date.now();
          
          // Save bid history
          await storage.saveBidHistory(auctionId, {
            amount: nextBid,
            strategy: auction.config.strategy,
            success: true,
            result: result.data
          });
          
          // Update Prometheus metrics
          prometheusMetrics.recordBid(auction.config.strategy, nextBid, true);
          
          // Check if bid was accepted but we're still not winning
          if (result.data && result.data.message && 
              result.data.message.includes('another user has a higher maximum bid')) {
            console.log(`Bid accepted but outbid on auction ${auctionId}. Current: $${result.data.data.currentAmount}, Next min: $${result.data.data.minimumNextBid}`);
            
            // Update auction data with the new values
            if (result.data.data) {
              auctionData.currentBid = result.data.data.currentAmount;
              auctionData.nextBid = result.data.data.minimumNextBid;
              auctionData.minimumBid = result.data.data.minimumNextBid; // Keep both for consistency
              auctionData.bidCount = result.data.data.bidCount;
              auctionData.bidderCount = result.data.data.bidderCount;
            }
            
            // For incremental strategy, immediately try to bid again if we're still under max
            if (auction.config.strategy === 'auto' && 
                result.data.data.minimumNextBid <= auction.config.maxBid) {
              setTimeout(() => {
                this.executeAutoBid(auctionId, auctionData);
              }, 2000); // Wait 2 seconds before next bid
            }
          }
          
          this.emit('bidPlaced', { auctionId, amount: nextBid, result: result.data });
        } else {
          console.error(`Auto-bid failed for auction ${auctionId}:`, result.error);
          
          // Save failed bid to history
          await storage.saveBidHistory(auctionId, {
            amount: nextBid,
            strategy: auction.config.strategy,
            success: false,
            error: result.error
          });
          
          // Update Prometheus metrics
          prometheusMetrics.recordBid(auction.config.strategy, nextBid, false);
          
          // Error notification removed
        }
      } catch (error) {
        console.error(`Error placing auto-bid for auction ${auctionId}:`, error);
        
        // Save error to bid history
        await storage.saveBidHistory(auctionId, {
          amount: nextBid,
          strategy: auction.config.strategy,
          success: false,
          error: error.message
        });
        
        // Error notification removed
      }
    } else {
      console.warn(`Auto-bid skipped for auction ${auctionId}: Next bid $${nextBid} exceeds max bid $${auction.config.maxBid}`);
      auction.maxBidReached = true;
      
      // Track max bid reached in Prometheus
      prometheusMetrics.metrics.business.maxBidReached.inc({ strategy: auction.config.strategy });
    }
  }

  handleOutbid(auctionId, data) {
    console.log(`User outbid on auction ${auctionId}`);
    this.emit('outbid', { auctionId, currentBid: data.currentBid });
    
    const auction = this.monitoredAuctions.get(auctionId);
    if (!auction) return;
    
    // Outbid notification removed
  }

  handleAuctionEnd(auctionId, data) {
    console.log(`Auction ${auctionId} has ended`);
    this.stopPolling(auctionId);
    
    const auction = this.monitoredAuctions.get(auctionId);
    if (!auction) return;
    
    // Mark the auction as ended with timestamp
    auction.status = 'ended';
    auction.endedAt = Date.now();
    auction.finalPrice = data.currentBid;
    auction.won = data.isWinning;
    
    // Save the updated state
    storage.saveAuction(auctionId, auction).catch(err => {
      console.error('Failed to save ended auction state:', err);
    });
    
    // Update Prometheus metrics
    prometheusMetrics.metrics.business.auctionsCompleted.inc({ 
      result: data.isWinning ? 'won' : 'lost' 
    });
    
    // Track strategy success
    if (data.isWinning && auction.config && auction.config.strategy) {
      prometheusMetrics.metrics.business.strategySuccess.inc({ 
        strategy: auction.config.strategy 
      });
    }
    
    this.emit('auctionEnded', { 
      auctionId, 
      finalPrice: data.currentBid,
      won: data.isWinning 
    });

    // End notification removed

    // The cleanup timer will handle removal based on the endedAt timestamp
    console.log(`Auction ${auctionId} marked as ended. Will be cleaned up after retention period.`);
  }

  startPolling(auctionId, interval = 6000) {
    this.stopPolling(auctionId); // Clear any existing interval
    
    // Initial update
    this.updateAuction(auctionId);
    
    // Set up polling interval
    const intervalId = setInterval(() => {
      this.updateAuction(auctionId);
    }, interval);
    
    this.pollingIntervals.set(auctionId, intervalId);
  }

  stopPolling(auctionId) {
    const intervalId = this.pollingIntervals.get(auctionId);
    if (intervalId) {
      clearInterval(intervalId);
      this.pollingIntervals.delete(auctionId);
    }
  }

  adjustPollingRate(auctionId, newInterval) {
    const currentInterval = this.pollingIntervals.get(auctionId);
    if (currentInterval) {
      this.startPolling(auctionId, newInterval);
    }
  }

  /**
   * Start monitoring an auction using SSE if available, otherwise fallback to polling
   */
  async startMonitoring(auctionId, auction) {
    const url = auction.url;
    let sseConnected = false;
    
    // Try SSE first if enabled and URL is available
    if (this.sseClient && url) {
      const productId = this.extractProductId(url);
      if (productId) {
        try {
          sseConnected = await this.sseClient.connectToAuction(productId, auctionId);
          if (sseConnected) {
            logger.info('SSE connection established for auction', { auctionId, productId });
            
            // Start minimal fallback polling (30s intervals)
            this.startPolling(auctionId, 30000);
            
            // Update auction metadata
            auction.useSSE = true;
            auction.sseProductId = productId;
            auction.fallbackPolling = true;
            await storage.saveAuction(auctionId, auction);
            
            return;
          }
        } catch (error) {
          logger.warn('SSE connection failed, falling back to polling', { auctionId, error: error.message });
        }
      }
    }
    
    // Fallback to regular polling
    logger.info('Using polling for auction monitoring', { auctionId, reason: sseConnected ? 'sse_failed' : 'sse_unavailable' });
    this.startPolling(auctionId);
    
    // Update auction metadata
    auction.useSSE = false;
    auction.fallbackPolling = false;
    await storage.saveAuction(auctionId, auction);
  }
  
  /**
   * Extract product ID from Nellis auction URL
   */
  extractProductId(url) {
    if (!url) return null;
    
    // Match patterns like:
    // https://www.nellisauction.com/p/product-name/12345
    const match = url.match(/\/p\/[^\/]+\/(\d+)(?:\?|$)/);
    return match ? match[1] : null;
  }
  
  /**
   * Handle SSE auction update events
   */
  async handleSSEAuctionUpdate(updateData) {
    const { auctionId, productId, data, source } = updateData;
    
    logger.debug('Processing SSE auction update', { auctionId, productId, source });
    
    const auction = this.monitoredAuctions.get(auctionId);
    if (!auction) {
      logger.warn('Received SSE update for unknown auction', { auctionId });
      return;
    }
    
    // Update auction data
    auction.data = {
      ...(auction.data || {}),
      ...data,
      lastSSEUpdate: new Date().toISOString()
    };
    auction.lastUpdate = Date.now();
    
    // Check if we need to place a bid
    if (auction.config?.autoBid && auction.data) {
      this.executeAutoBid(auctionId, auction.data);
    }
    
    // Broadcast update to clients
    this.broadcastAuctionState(auctionId);
    
    // Emit event for other listeners
    this.emit('auctionUpdate', { auctionId, auction, source: 'sse' });
  }
  
  /**
   * Handle SSE auction closed events
   */
  async handleSSEAuctionClosed(closeData) {
    const { auctionId, productId, data } = closeData;
    
    logger.info('Processing SSE auction closed event', { auctionId, productId });
    
    const auction = this.monitoredAuctions.get(auctionId);
    if (!auction) {
      logger.warn('Received SSE close event for unknown auction', { auctionId });
      return;
    }
    
    // Update auction status
    auction.status = 'ended';
    auction.data = { ...auction.data, ...data };
    auction.lastUpdate = Date.now();
    
    // Stop all monitoring for this auction
    this.stopPolling(auctionId);
    if (this.sseClient) {
      this.sseClient.disconnect(productId);
    }
    
    // Persist final state
    await storage.saveAuction(auctionId, auction);
    
    // Broadcast final update
    this.broadcastAuctionState(auctionId);
    
    // Emit event
    this.emit('auctionEnded', { auctionId, auction, source: 'sse' });
    
    logger.info('Auction monitoring ended via SSE', { auctionId });
  }
  
  /**
   * Handle SSE fallback events
   */
  async handleSSEFallback(fallbackData) {
    const { productId, auctionId } = fallbackData;
    
    logger.warn('SSE fallback triggered, switching to polling', { productId, auctionId });
    
    // Switch to regular polling
    this.stopPolling(auctionId); // Stop minimal polling
    this.startPolling(auctionId); // Start regular polling
    
    // Update auction metadata
    const auction = this.monitoredAuctions.get(auctionId);
    if (auction) {
      auction.useSSE = false;
      auction.fallbackPolling = true;
      auction.sseFailureTime = new Date().toISOString();
      await storage.saveAuction(auctionId, auction);
    }
    
    // Update metrics if available
    if (global.metrics?.pollingMetrics) {
      global.metrics.pollingMetrics.fallbackActivations.inc();
    }
  }

  broadcastAuctionState(auctionId) {
    const auction = this.monitoredAuctions.get(auctionId);
    if (!auction) return;
    
    // If we have a broadcast handler, use it
    if (this.broadcastHandler) {
      this.broadcastHandler(auctionId);
      return;
    }
    
    // Fallback to direct broadcast if no handler is set
    if (!this.wss) return;
    
    // Get full auction data
    const auctionState = {
      id: auction.id,
      title: auction.title,
      url: auction.url,
      imageUrl: auction.imageUrl,
      status: auction.status,
      config: auction.config,
      data: auction.data,
      lastUpdate: auction.lastUpdate
    };
    
    const message = JSON.stringify({
      type: 'auctionState',
      auction: auctionState
    });

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Notification broadcast method removed

  getMonitoredAuctions() {
    return Array.from(this.monitoredAuctions.values()).map(auction => ({
      id: auction.id,
      title: auction.title,
      url: auction.url,
      imageUrl: auction.imageUrl,
      status: auction.status,
      config: auction.config,
      data: auction.data,
      lastUpdate: auction.lastUpdate
    }));
  }

  getMonitoredCount() {
    return this.monitoredAuctions.size;
  }
  
  getMemoryStats() {
    let endedCount = 0;
    let activeCount = 0;
    
    for (const [, auction] of this.monitoredAuctions) {
      if (auction.status === 'ended' || auction.status === 'closed') {
        endedCount++;
      } else {
        activeCount++;
      }
    }
    
    return {
      total: this.monitoredAuctions.size,
      active: activeCount,
      ended: endedCount,
      pollingIntervals: this.pollingIntervals.size
    };
  }

  async updateAuctionConfig(auctionId, config) {
    const auction = this.monitoredAuctions.get(auctionId);
    if (!auction) {
      return false;
    }
    
    auction.config = { ...auction.config, ...config };
    console.log(`Updated config for auction ${auctionId}:`, config);
    
    // Persist the updated auction
    await storage.saveAuction(auctionId, auction);
    
    // Broadcast the updated state to all connected clients
    this.broadcastAuctionState(auctionId);
    
    return true;
  }

  startCleanupTimer() {
    // Run cleanup every 5 minutes
    const CLEANUP_INTERVAL = parseInt(process.env.AUCTION_CLEANUP_INTERVAL_MS) || 5 * 60 * 1000; // 5 minutes
    const AUCTION_RETENTION_MS = parseInt(process.env.ENDED_AUCTION_RETENTION_MS) || 60 * 1000; // 1 minute
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupEndedAuctions(AUCTION_RETENTION_MS);
    }, CLEANUP_INTERVAL);
    
    // Also run cleanup immediately to clean any existing ended auctions
    this.cleanupEndedAuctions(AUCTION_RETENTION_MS);
    
    console.log(`Auction cleanup timer started (runs every ${CLEANUP_INTERVAL / 1000} seconds)`);
  }
  
  cleanupEndedAuctions(retentionMs) {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [auctionId, auction] of this.monitoredAuctions) {
      // Check if auction has ended and retention period has passed
      if (auction.status === 'ended' || auction.status === 'closed') {
        const endedAt = auction.endedAt || auction.lastUpdated;
        if (endedAt && (now - endedAt) > retentionMs) {
          console.log(`Cleaning up ended auction ${auctionId} (ended ${Math.round((now - endedAt) / 1000)} seconds ago)`);
          this.removeAuction(auctionId);
          cleanedCount++;
        }
      }
      
      // Also check for auctions with zero time remaining that might not have proper status
      if (auction.timeRemaining === 0 && auction.lastUpdated && (now - auction.lastUpdated) > retentionMs) {
        console.log(`Cleaning up stale auction ${auctionId} with zero time remaining`);
        this.removeAuction(auctionId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} ended auctions. Active auctions: ${this.monitoredAuctions.size}`);
    }
  }

  shutdown() {
    // Stop cleanup timer
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Stop all polling
    this.pollingIntervals.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    this.pollingIntervals.clear();
    this.monitoredAuctions.clear();
    console.log('Auction monitor shut down');
  }
}

module.exports = new AuctionMonitor();