/**
 * SSE Client Class Implementation
 * Class-based implementation of ISSEClient for dependency injection
 */

const { EventSource } = require('eventsource');
const ISSEClient = require('../../interfaces/ISSEClient');

class SSEClientClass extends ISSEClient {
  constructor(storage, eventEmitter, logger, features) {
    super();
    this.storage = storage;
    this.eventEmitter = eventEmitter;
    this.logger = logger;
    this.features = features;
    
    this.connections = new Map(); // productId -> EventSource
    this.reconnectAttempts = new Map(); // productId -> attempt count
    this.sessionIds = new Map(); // productId -> sessionId
    
    // Configuration
    this.config = {
      sseEndpoint: process.env.SSE_ENDPOINT || 'https://sse.nellisauction.com',
      reconnectInterval: parseInt(process.env.SSE_RECONNECT_INTERVAL) || 5000,
      maxReconnectAttempts: parseInt(process.env.SSE_MAX_RECONNECT_ATTEMPTS) || 3,
      enabled: false // Will be set during initialization
    };
    
    this.initialized = false;
  }

  async initialize() {
    // Update config from current feature flag state
    this.config.enabled = this.features.isEnabled('USE_SSE');
    
    if (!this.config.enabled) {
      this.logger.info('SSE Client disabled by feature flag');
      this.initialized = true;
      return;
    }
    
    this.initialized = true;
    this.logger.info('SSE Client initialized', { 
      endpoint: this.config.sseEndpoint,
      enabled: this.config.enabled 
    });
  }

  async connectToAuction(productId, auctionId) {
    if (!this.config.enabled) {
      this.logger.debug('SSE disabled, skipping connection', { productId });
      return false;
    }
    
    if (this.connections.has(productId)) {
      this.logger.debug('SSE already connected for product', { productId });
      return true;
    }
    
    try {
      const url = `${this.config.sseEndpoint}/live-products?productId=${productId}`;
      this.logger.info('Establishing SSE connection', { productId, url });
      
      const eventSource = new EventSource(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        },
        withCredentials: false
      });
      
      this.setupEventHandlers(eventSource, productId, auctionId);
      this.connections.set(productId, eventSource);
      this.reconnectAttempts.set(productId, 0);
      
      return true;
    } catch (error) {
      this.logger.error('Failed to establish SSE connection', { productId, error: error.message });
      this.eventEmitter.emit('sse:error', { productId, error });
      return false;
    }
  }

  setupEventHandlers(eventSource, productId, auctionId) {
    // Connection opened
    eventSource.onopen = () => {
      this.logger.info('SSE connection established', { productId });
      this.reconnectAttempts.set(productId, 0);
      this.eventEmitter.emit('sse:connected', { productId, auctionId });
      
      // Update metrics
      if (global.metrics?.sseMetrics) {
        global.metrics.sseMetrics.activeConnections.inc();
      }
    };
    
    // Standard message handler
    eventSource.onmessage = (event) => {
      this.logger.debug('SSE message received', { productId, data: event.data });
      
      // Handle ping messages
      if (event.data === 'ping') {
        this.logger.debug('SSE ping received', { productId });
        return;
      }
      
      // Handle connection messages
      if (event.data.startsWith('connected')) {
        const parts = event.data.split(' ');
        if (parts.length > 1) {
          const sessionId = parts[1];
          this.sessionIds.set(productId, sessionId);
          this.logger.info('SSE session established', { productId, sessionId });
        }
      }
    };
    
    // Bid update event handler
    eventSource.addEventListener(`ch_product_bids:${productId}`, async (event) => {
      try {
        const bidData = JSON.parse(event.data);
        this.logger.info('SSE bid update received', { productId, bidData: '[REDACTED]' });
        
        await this.handleBidUpdate(productId, auctionId, bidData);
        
        // Update metrics
        if (global.metrics?.sseMetrics) {
          global.metrics.sseMetrics.eventsReceived.inc({ event_type: 'bid_update' });
        }
      } catch (error) {
        this.logger.error('Error handling bid update', { productId, error: error.message, data: event.data });
      }
    });
    
    // Auction closed event handler
    eventSource.addEventListener(`ch_product_closed:${productId}`, async (event) => {
      try {
        const closeData = JSON.parse(event.data);
        this.logger.info('SSE auction closed event received', { productId, closeData });
        
        await this.handleAuctionClosed(productId, auctionId, closeData);
        
        // Update metrics
        if (global.metrics?.sseMetrics) {
          global.metrics.sseMetrics.eventsReceived.inc({ event_type: 'auction_closed' });
        }
      } catch (error) {
        this.logger.error('Error handling auction closed event', { productId, error: error.message, data: event.data });
      }
    });
    
    // Error handler with reconnection logic
    eventSource.onerror = (error) => {
      this.logger.error('SSE connection error', { productId, error: error.message || 'Connection lost' });
      
      // Update metrics
      if (global.metrics?.sseMetrics) {
        global.metrics.sseMetrics.connectionErrors.inc();
      }
      
      this.eventEmitter.emit('sse:error', { productId, auctionId, error });
      
      // Handle reconnection
      if (eventSource.readyState === EventSource.CLOSED) {
        this.handleReconnection(productId, auctionId);
      }
    };
  }

  async handleBidUpdate(productId, auctionId, bidData) {
    const updateData = {
      currentBid: bidData.currentBid || bidData.current_bid,
      bidCount: bidData.bidCount || bidData.bid_count,
      lastBidder: bidData.lastBidder || bidData.last_bidder || bidData.username,
      lastUpdate: new Date().toISOString(),
      updateSource: 'sse'
    };
    
    // Emit event for WebSocket relay and auction monitor
    this.eventEmitter.emit('auction:update', {
      auctionId,
      productId,
      type: 'bid',
      data: updateData,
      source: 'sse',
      timestamp: new Date().toISOString()
    });
    
    // Update metrics
    if (global.metrics?.pollingMetrics) {
      global.metrics.pollingMetrics.updateSource.inc({ source: 'sse' });
    }
  }

  async handleAuctionClosed(productId, auctionId, closeData) {
    const updateData = {
      status: 'closed',
      isClosed: true,
      finalBid: closeData.finalBid || closeData.final_bid || closeData.currentBid,
      winner: closeData.winner || closeData.username,
      closedAt: closeData.closedAt || new Date().toISOString(),
      updateSource: 'sse'
    };
    
    // Cleanup SSE connection
    this.disconnect(productId);
    
    // Emit event
    this.eventEmitter.emit('auction:closed', {
      auctionId,
      productId,
      data: updateData,
      source: 'sse',
      timestamp: new Date().toISOString()
    });
  }

  async handleReconnection(productId, auctionId) {
    const attempts = this.reconnectAttempts.get(productId) || 0;
    
    if (attempts >= this.config.maxReconnectAttempts) {
      this.logger.warn('Max reconnection attempts reached, falling back to polling', { productId, attempts });
      this.eventEmitter.emit('sse:fallback', { productId, auctionId });
      
      // Update metrics
      if (global.metrics?.pollingMetrics) {
        global.metrics.pollingMetrics.fallbackActivations.inc();
      }
      
      return;
    }
    
    const delay = Math.min(this.config.reconnectInterval * Math.pow(2, attempts), 30000);
    this.logger.info('Scheduling SSE reconnection', { productId, attempts: attempts + 1, delay });
    
    setTimeout(() => {
      this.reconnectAttempts.set(productId, attempts + 1);
      this.connectToAuction(productId, auctionId);
    }, delay);
  }

  disconnect(productId) {
    const eventSource = this.connections.get(productId);
    if (eventSource) {
      this.logger.info('Disconnecting SSE', { productId });
      
      eventSource.close();
      this.connections.delete(productId);
      this.reconnectAttempts.delete(productId);
      this.sessionIds.delete(productId);
      
      // Update metrics
      if (global.metrics?.sseMetrics) {
        global.metrics.sseMetrics.activeConnections.dec();
      }
    }
  }

  disconnectAll() {
    this.logger.info('Disconnecting all SSE connections', { count: this.connections.size });
    
    for (const [productId, eventSource] of this.connections) {
      eventSource.close();
    }
    
    this.connections.clear();
    this.reconnectAttempts.clear();
    this.sessionIds.clear();
    
    // Reset metrics
    if (global.metrics?.sseMetrics) {
      global.metrics.sseMetrics.activeConnections.set(0);
    }
  }

  getConnectionStatus() {
    const status = {
      enabled: this.config.enabled,
      totalConnections: this.connections.size,
      connections: []
    };
    
    for (const [productId, eventSource] of this.connections) {
      status.connections.push({
        productId,
        readyState: eventSource.readyState,
        sessionId: this.sessionIds.get(productId),
        reconnectAttempts: this.reconnectAttempts.get(productId) || 0
      });
    }
    
    return status;
  }

  static extractProductId(url) {
    if (!url) return null;
    
    // Match patterns like:
    // https://www.nellisauction.com/p/product-name/12345
    // https://www.nellisauction.com/p/product-name/12345?_data=...
    const match = url.match(/\/p\/[^\/]+\/(\d+)(?:\?|$)/);
    return match ? match[1] : null;
  }
}

module.exports = SSEClientClass;