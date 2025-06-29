const { EventSource } = require('eventsource');
const logger = require('../utils/logger');
const features = require('../config/features');
const prometheusMetrics = require('../utils/prometheusMetrics');

/**
 * SSE Client for real-time auction updates from Nellis
 * Manages Server-Sent Events connections for monitored auctions
 */
class SSEClient {
  constructor(storage, eventEmitter) {
    this.storage = storage;
    this.eventEmitter = eventEmitter;
    this.connections = new Map(); // productId -> EventSource
    this.reconnectAttempts = new Map(); // productId -> attempt count
    this.sessionIds = new Map(); // productId -> sessionId
    
    // Configuration
    this.config = {
      sseEndpoint: process.env.SSE_ENDPOINT || 'https://sse.nellisauction.com',
      reconnectInterval: parseInt(process.env.SSE_RECONNECT_INTERVAL) || 5000,
      maxReconnectAttempts: parseInt(process.env.SSE_MAX_RECONNECT_ATTEMPTS) || 3,
      enabled: features.isEnabled('USE_SSE')
    };
    
    this.initialized = false;
  }
  
  async initialize() {
    // Update config from current feature flag state
    this.config.enabled = features.isEnabled('USE_SSE');
    
    if (!this.config.enabled) {
      logger.info('SSE Client disabled by feature flag');
      this.initialized = true;
      return;
    }
    
    this.initialized = true;
    logger.info('SSE Client initialized', { 
      endpoint: this.config.sseEndpoint,
      enabled: this.config.enabled 
    });
  }
  
  /**
   * Connect to SSE endpoint for a specific auction
   * @param {string} productId - The product ID to monitor
   * @param {string} auctionId - The auction ID (for reference)
   */
  async connectToAuction(productId, auctionId) {
    if (!this.config.enabled) {
      logger.debug('SSE disabled, skipping connection', { productId });
      return false;
    }
    
    if (this.connections.has(productId)) {
      logger.debug('SSE already connected for product', { productId });
      return true;
    }
    
    try {
      const url = `${this.config.sseEndpoint}/live-products?productId=${productId}`;
      logger.info('Establishing SSE connection', { productId, url });
      
      // Track connection attempt
      if (global.metrics) {
        global.metrics.incrementCounter('sse_connections_total');
      }
      
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
      
      // Store SSE connection info (will be handled by auction monitor)
      
      return true;
    } catch (error) {
      logger.error('Failed to establish SSE connection', { productId, error: error.message });
      this.eventEmitter.emit('sse:error', { productId, error });
      return false;
    }
  }
  
  /**
   * Setup event handlers for an EventSource connection
   */
  setupEventHandlers(eventSource, productId, auctionId) {
    // Connection opened
    eventSource.onopen = () => {
      logger.info('SSE connection established', { productId });
      this.reconnectAttempts.set(productId, 0);
      this.eventEmitter.emit('sse:connected', { productId, auctionId });
      
      // Update metrics
      if (global.metrics) {
        global.metrics.incrementCounter('sse_connections_successful');
        global.metrics.incrementGauge('sse_active_connections');
      }
      
      // Update Prometheus metrics
      prometheusMetrics.metrics.sse.totalConnections.inc({ result: 'success' });
      prometheusMetrics.metrics.sse.activeConnections.inc();
    };
    
    // Standard message handler
    eventSource.onmessage = (event) => {
      logger.debug('SSE message received', { productId, data: event.data });
      
      // Handle ping messages
      if (event.data === 'ping') {
        logger.debug('SSE ping received', { productId });
        return;
      }
      
      // Handle connection messages
      if (event.data.startsWith('connected')) {
        const parts = event.data.split(' ');
        if (parts.length > 1) {
          const sessionId = parts[1];
          this.sessionIds.set(productId, sessionId);
          logger.info('SSE session established', { productId, sessionId });
          // Note: Session tracking handled by auction monitor
        }
      }
    };
    
    // Bid update event handler
    eventSource.addEventListener(`ch_product_bids:${productId}`, async (event) => {
      try {
        const bidData = JSON.parse(event.data);
        logger.info('SSE bid update received', { productId, bidData });
        
        await this.handleBidUpdate(productId, auctionId, bidData);
        
        // Update metrics
        if (global.metrics) {
          global.metrics.incrementCounter('sse_events_received_total', { event_type: 'bid_update' });
          const startTime = Date.now();
          // Record processing time (simplified for this example)
          global.metrics.recordHistogram('sse_event_processing_duration', Date.now() - startTime);
        }
        
        // Update Prometheus metrics
        prometheusMetrics.recordSSEEvent('bid_update', 0.001); // Processing was instant
        prometheusMetrics.recordAuctionUpdate('sse');
      } catch (error) {
        logger.error('Error handling bid update', { productId, error: error.message, data: event.data });
      }
    });
    
    // Auction closed event handler
    eventSource.addEventListener(`ch_product_closed:${productId}`, async (event) => {
      try {
        const closeData = JSON.parse(event.data);
        logger.info('SSE auction closed event received', { productId, closeData });
        
        await this.handleAuctionClosed(productId, auctionId, closeData);
        
        // Update metrics
        if (global.metrics) {
          global.metrics.incrementCounter('sse_events_received_total', { event_type: 'auction_closed' });
        }
      } catch (error) {
        logger.error('Error handling auction closed event', { productId, error: error.message, data: event.data });
      }
    });
    
    // Error handler with reconnection logic
    eventSource.onerror = (error) => {
      logger.error('SSE connection error', { productId, error: error.message || 'Connection lost' });
      
      // Update metrics
      if (global.metrics) {
        global.metrics.incrementCounter('sse_connections_failed');
        global.metrics.incrementGauge('sse_connection_errors');
      }
      
      // Update Prometheus metrics
      prometheusMetrics.metrics.sse.totalConnections.inc({ result: 'failed' });
      prometheusMetrics.metrics.sse.connectionErrors.inc({ error_type: 'connection' });
      
      this.eventEmitter.emit('sse:error', { productId, auctionId, error });
      
      // Handle reconnection
      if (eventSource.readyState === EventSource.CLOSED) {
        this.handleReconnection(productId, auctionId);
      }
    };
  }
  
  /**
   * Handle bid update from SSE
   */
  async handleBidUpdate(productId, auctionId, bidData) {
    const updateData = {
      currentBid: bidData.currentBid || bidData.current_bid,
      bidCount: bidData.bidCount || bidData.bid_count,
      lastBidder: bidData.lastBidder || bidData.last_bidder || bidData.username,
      lastUpdate: new Date().toISOString(),
      updateSource: 'sse'
    };
    
    // Note: Storage updates handled by auction monitor via events
    
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
    if (global.metrics) {
      global.metrics.incrementCounter('update_source_total', { source: 'sse' });
    }
  }
  
  /**
   * Handle auction closed event from SSE
   */
  async handleAuctionClosed(productId, auctionId, closeData) {
    const updateData = {
      status: 'closed',
      isClosed: true,
      finalBid: closeData.finalBid || closeData.final_bid || closeData.currentBid,
      winner: closeData.winner || closeData.username,
      closedAt: closeData.closedAt || new Date().toISOString(),
      updateSource: 'sse'
    };
    
    // Note: Storage updates handled by auction monitor via events
    
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
  
  /**
   * Handle reconnection with exponential backoff
   */
  async handleReconnection(productId, auctionId) {
    const attempts = this.reconnectAttempts.get(productId) || 0;
    
    if (attempts >= this.config.maxReconnectAttempts) {
      logger.warn('Max reconnection attempts reached, falling back to polling', { productId, attempts });
      this.eventEmitter.emit('sse:fallback', { productId, auctionId });
      
      // Update metrics
      if (global.metrics) {
        global.metrics.incrementCounter('sse_fallback_activations');
      }
      
      return;
    }
    
    const delay = Math.min(this.config.reconnectInterval * Math.pow(2, attempts), 30000);
    logger.info('Scheduling SSE reconnection', { productId, attempts: attempts + 1, delay });
    
    setTimeout(() => {
      this.reconnectAttempts.set(productId, attempts + 1);
      
      // Update metrics
      if (global.metrics) {
        global.metrics.incrementCounter('sse_reconnection_attempts');
      }
      
      this.connectToAuction(productId, auctionId);
    }, delay);
  }
  
  /**
   * Disconnect SSE for a specific product
   */
  disconnect(productId) {
    const eventSource = this.connections.get(productId);
    if (eventSource) {
      logger.info('Disconnecting SSE', { productId });
      
      eventSource.close();
      this.connections.delete(productId);
      this.reconnectAttempts.delete(productId);
      this.sessionIds.delete(productId);
      
      // Update metrics
      if (global.metrics) {
        global.metrics.decrementGauge('sse_active_connections');
      }
    }
  }
  
  /**
   * Disconnect all SSE connections
   */
  disconnectAll() {
    logger.info('Disconnecting all SSE connections', { count: this.connections.size });
    
    for (const [productId, eventSource] of this.connections) {
      eventSource.close();
    }
    
    this.connections.clear();
    this.reconnectAttempts.clear();
    this.sessionIds.clear();
    
    // Reset metrics
    if (global.metrics) {
      global.metrics.setGauge('sse_active_connections', 0);
    }
  }
  
  /**
   * Extract product ID from Nellis auction URL
   * @param {string} url - The auction URL
   * @returns {string|null} Product ID or null if not found
   */
  static extractProductId(url) {
    if (!url) return null;
    
    // Match patterns like:
    // https://www.nellisauction.com/p/product-name/12345
    // https://www.nellisauction.com/p/product-name/12345?_data=...
    const match = url.match(/\/p\/[^\/]+\/(\d+)(?:\?|$)/);
    return match ? match[1] : null;
  }
  
  /**
   * Get connection status
   */
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
}

// Export singleton instance
const storage = require('./storage');
// Note: We'll set the eventEmitter when auction monitor initializes us
const sseClient = new SSEClient(storage, null);

module.exports = sseClient;