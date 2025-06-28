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
  }

  async initialize(wss) {
    this.wss = wss;
    
    // Initialize storage
    await storage.initialize();
    this.storageInitialized = true;
    
    // Recover persisted auctions
    await this.recoverPersistedState();
    
    console.log('Auction monitor initialized with persistence');
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

    const auction = {
      id: auctionId,
      title: metadata.title || 'Unknown',
      url: metadata.url || '',
      imageUrl: metadata.imageUrl || null,
      config: {
        maxBid: config.maxBid || 0,
        bidIncrement: config.bidIncrement || 1,
        strategy: config.strategy || 'manual',
        autoBid: config.autoBid || false,
        notifyOnOutbid: config.notifyOnOutbid || true,
        notifyOnEnd: config.notifyOnEnd || true
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

    // Execute auto-bid based on strategy
    if (auction.config.strategy !== 'manual' && !newData.isWinning && !auction.maxBidReached) {
      this.executeAutoBid(auctionId, newData);
    }
  }

  async executeAutoBid(auctionId, auctionData) {
    const auction = this.monitoredAuctions.get(auctionId);
    if (!auction) return;

    // Check strategy
    if (auction.config.strategy === 'manual') {
      return; // No auto-bidding for manual strategy
    }

    // For sniping strategy, only bid in the last 30 seconds
    if (auction.config.strategy === 'sniping' && auctionData.timeRemaining > 30) {
      return;
    }

    const nextBid = auctionData.nextBid || auctionData.currentBid + auction.config.bidIncrement;

    if (nextBid <= auction.config.maxBid) {
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
      }
    } else {
      console.warn(`Auto-bid skipped for auction ${auctionId}: Next bid $${nextBid} exceeds max bid $${auction.config.maxBid}`);
      auction.maxBidReached = true;
    }
  }

  handleOutbid(auctionId, data) {
    console.log(`User outbid on auction ${auctionId}`);
    this.emit('outbid', { auctionId, currentBid: data.currentBid });
    
    // Send notification through WebSocket
    this.broadcastNotification({
      type: 'outbid',
      auctionId,
      title: data.title,
      currentBid: data.currentBid,
      nextBid: data.nextBid
    });
  }

  handleAuctionEnd(auctionId, data) {
    console.log(`Auction ${auctionId} has ended`);
    this.stopPolling(auctionId);
    
    this.emit('auctionEnded', { 
      auctionId, 
      finalPrice: data.currentBid,
      won: data.isWinning 
    });

    // Send notification
    this.broadcastNotification({
      type: 'ended',
      auctionId,
      title: data.title,
      finalPrice: data.currentBid,
      won: data.isWinning
    });

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
    if (!this.wss) return;
    
    const auction = this.monitoredAuctions.get(auctionId);
    if (!auction) return;
    
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

  broadcastNotification(notification) {
    if (!this.wss) return;
    
    const message = JSON.stringify({
      type: 'notification',
      ...notification
    });

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

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