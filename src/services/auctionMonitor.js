const cron = require('node-cron');
const nellisApi = require('./nellisApi');
const EventEmitter = require('events');
const WebSocket = require('ws');
const storage = require('./storage');

class AuctionMonitor extends EventEmitter {
  constructor() {
    super();
    this.monitoredAuctions = new Map();
    this.pollingIntervals = new Map();
    this.wss = null;
    this.storageInitialized = false;
    this.broadcastHandler = null;
  }

  async initialize(wss, broadcastHandler = null) {
    this.wss = wss;
    this.broadcastHandler = broadcastHandler;
    
    // Initialize storage
    await storage.initialize();
    this.storageInitialized = true;
    
    // Recover persisted auctions
    await this.recoverPersistedState();
    
    console.log('Auction monitor initialized with persistence');
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
            this.startPolling(auction.id);
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
    const globalSettings = await storage.getSettings();

    const auction = {
      id: auctionId,
      title: metadata.title || 'Unknown',
      url: metadata.url || '',
      imageUrl: metadata.imageUrl || null,
      config: {
        maxBid: config.maxBid || globalSettings.general.defaultMaxBid || 100,
        bidIncrement: config.bidIncrement || 1,
        strategy: config.strategy || globalSettings.general.defaultStrategy || 'increment',
        autoBid: config.autoBid !== undefined ? config.autoBid : globalSettings.general.autoBidDefault,
        // Notification settings removed
      },
      lastUpdate: Date.now(),
      status: 'monitoring',
      data: null
    };

    this.monitoredAuctions.set(auctionId, auction);
    
    // Persist to storage
    await storage.saveAuction(auctionId, auction);
    
    this.startPolling(auctionId);
    
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
      auction.lastUpdate = Date.now();

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
    if (auction.config.strategy === 'manual') {
      return; // No auto-bidding for manual strategy
    }

    // Get global settings for bidding logic
    const globalSettings = await storage.getSettings();

    // For sniping strategy, use configured snipe timing
    if (auction.config.strategy === 'sniping' && auctionData.timeRemaining > globalSettings.bidding.snipeTiming) {
      return;
    }

    // Calculate next bid with buffer
    const minimumBid = auctionData.nextBid || auctionData.currentBid + auction.config.bidIncrement;
    const nextBid = minimumBid + globalSettings.bidding.bidBuffer;

    if (nextBid <= auction.config.maxBid) {
      auction.maxBidReached = false;
      try {
        console.log(`Executing auto-bid on auction ${auctionId}: $${nextBid} (strategy: ${auction.config.strategy})`);
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
            if (auction.config.strategy === 'increment' && 
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
    
    this.emit('auctionEnded', { 
      auctionId, 
      finalPrice: data.currentBid,
      won: data.isWinning 
    });

    // End notification removed

    // Remove from monitoring after a delay
    setTimeout(() => {
      this.removeAuction(auctionId);
    }, 60000); // Keep for 1 minute after ending
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

  shutdown() {
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