/**
 * Prometheus Metrics Integration
 * Enhanced metrics collection with Prometheus client for production monitoring
 */

const prometheus = require('prom-client');
const logger = require('./logger');

// Create a Registry
const register = new prometheus.Registry();

// Add default metrics (process CPU, memory, etc.)
prometheus.collectDefaultMetrics({ register });

/**
 * Business Metrics
 */
const businessMetrics = {
  // Auction monitoring metrics
  activeAuctions: new prometheus.Gauge({
    name: 'auction_active_count',
    help: 'Number of currently active auctions being monitored',
    registers: [register]
  }),
  
  totalAuctions: new prometheus.Counter({
    name: 'auction_monitored_total',
    help: 'Total number of auctions monitored since startup',
    registers: [register]
  }),
  
  auctionsCompleted: new prometheus.Counter({
    name: 'auction_completed_total',
    help: 'Total auctions completed',
    labelNames: ['result'], // 'won', 'lost'
    registers: [register]
  }),
  
  // Bidding metrics
  bidsPlaced: new prometheus.Counter({
    name: 'bids_placed_total',
    help: 'Total bids placed',
    labelNames: ['strategy', 'result'], // strategy: manual/aggressive/sniping, result: success/failed
    registers: [register]
  }),
  
  bidAmount: new prometheus.Histogram({
    name: 'bid_amount_dollars',
    help: 'Distribution of bid amounts in dollars',
    buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [register]
  }),
  
  bidResponseTime: new prometheus.Histogram({
    name: 'bid_response_time_seconds',
    help: 'Time to place a bid and receive response',
    buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [register]
  }),
  
  // Strategy effectiveness
  strategySuccess: new prometheus.Counter({
    name: 'strategy_success_total',
    help: 'Successful auction wins by strategy',
    labelNames: ['strategy'],
    registers: [register]
  }),
  
  maxBidReached: new prometheus.Counter({
    name: 'max_bid_reached_total',
    help: 'Times max bid limit was reached',
    labelNames: ['strategy'],
    registers: [register]
  })
};

/**
 * SSE Metrics (Real-time updates)
 */
const sseMetrics = {
  activeConnections: new prometheus.Gauge({
    name: 'sse_connections_active',
    help: 'Current active SSE connections',
    registers: [register]
  }),
  
  totalConnections: new prometheus.Counter({
    name: 'sse_connections_total',
    help: 'Total SSE connection attempts',
    labelNames: ['result'], // 'success', 'failed'
    registers: [register]
  }),
  
  eventsReceived: new prometheus.Counter({
    name: 'sse_events_received_total',
    help: 'Total SSE events received',
    labelNames: ['event_type'], // 'bid_update', 'auction_closed', 'ping'
    registers: [register]
  }),
  
  eventLatency: new prometheus.Histogram({
    name: 'sse_event_latency_seconds',
    help: 'SSE event delivery latency',
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    registers: [register]
  }),
  
  connectionErrors: new prometheus.Counter({
    name: 'sse_connection_errors_total',
    help: 'SSE connection failures',
    labelNames: ['error_type'], // 'timeout', 'network', 'auth'
    registers: [register]
  }),
  
  reconnectionAttempts: new prometheus.Counter({
    name: 'sse_reconnection_attempts_total',
    help: 'SSE reconnection attempts',
    registers: [register]
  })
};

/**
 * Polling Metrics (Fallback mechanism)
 */
const pollingMetrics = {
  activePolls: new prometheus.Gauge({
    name: 'polling_active_count',
    help: 'Number of auctions using polling',
    registers: [register]
  }),
  
  totalPolls: new prometheus.Counter({
    name: 'polling_requests_total',
    help: 'Total polling requests made',
    labelNames: ['result'], // 'success', 'failed'
    registers: [register]
  }),
  
  pollDuration: new prometheus.Histogram({
    name: 'polling_duration_seconds',
    help: 'Time to complete a polling request',
    buckets: [0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [register]
  }),
  
  fallbackActivations: new prometheus.Counter({
    name: 'polling_fallback_activations_total',
    help: 'Times polling was used due to SSE failure',
    registers: [register]
  }),
  
  updateSource: new prometheus.Counter({
    name: 'auction_updates_by_source',
    help: 'Auction updates received by source',
    labelNames: ['source'], // 'sse', 'polling'
    registers: [register]
  })
};

/**
 * System Health Metrics
 */
const systemMetrics = {
  systemHealth: new prometheus.Gauge({
    name: 'system_health_status',
    help: 'Overall system health (1=healthy, 0=unhealthy)',
    registers: [register]
  }),
  
  websocketConnections: new prometheus.Gauge({
    name: 'websocket_connections_active',
    help: 'Active WebSocket connections from clients',
    registers: [register]
  }),
  
  redisConnected: new prometheus.Gauge({
    name: 'redis_connection_status',
    help: 'Redis connection status (1=connected, 0=disconnected)',
    registers: [register]
  }),
  
  apiRequestDuration: new prometheus.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request latencies',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2.5, 5],
    registers: [register]
  }),
  
  apiRequestTotal: new prometheus.Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register]
  }),
  
  errorRate: new prometheus.Counter({
    name: 'application_errors_total',
    help: 'Application errors',
    labelNames: ['type', 'severity'], // type: api/websocket/sse/polling, severity: warning/error/critical
    registers: [register]
  })
};

/**
 * Performance Metrics
 */
const performanceMetrics = {
  circuitBreakerState: new prometheus.Gauge({
    name: 'circuit_breaker_state',
    help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
    registers: [register]
  }),
  
  circuitBreakerTrips: new prometheus.Counter({
    name: 'circuit_breaker_trips_total',
    help: 'Circuit breaker trip events',
    registers: [register]
  }),
  
  queueSize: new prometheus.Gauge({
    name: 'polling_queue_size',
    help: 'Current polling queue size',
    registers: [register]
  }),
  
  queueProcessingTime: new prometheus.Histogram({
    name: 'polling_queue_processing_seconds',
    help: 'Time to process polling queue items',
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2],
    registers: [register]
  }),
  
  memoryUsage: new prometheus.Gauge({
    name: 'nodejs_memory_usage_bytes',
    help: 'Node.js memory usage',
    labelNames: ['type'], // 'heap_used', 'heap_total', 'rss'
    registers: [register]
  })
};

/**
 * Helper function to update memory metrics
 */
function updateMemoryMetrics() {
  const memUsage = process.memoryUsage();
  performanceMetrics.memoryUsage.set({ type: 'heap_used' }, memUsage.heapUsed);
  performanceMetrics.memoryUsage.set({ type: 'heap_total' }, memUsage.heapTotal);
  performanceMetrics.memoryUsage.set({ type: 'rss' }, memUsage.rss);
}

// Update memory metrics every 10 seconds
setInterval(updateMemoryMetrics, 10000);

/**
 * Express middleware for tracking HTTP metrics
 */
function httpMetricsMiddleware(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path || 'unknown';
    const labels = {
      method: req.method,
      route: route,
      status_code: res.statusCode
    };
    
    systemMetrics.apiRequestDuration.observe(labels, duration);
    systemMetrics.apiRequestTotal.inc(labels);
  });
  
  next();
}

/**
 * Calculate and update system health
 */
function updateSystemHealth() {
  try {
    // Simple health calculation based on key metrics
    let healthScore = 1;
    
    // Check Redis connection
    if (!systemMetrics.redisConnected._getValue()) {
      healthScore -= 0.3; // Redis down is significant but not critical
    }
    
    // Check error rate (if more than 5% of requests are errors)
    const totalRequests = systemMetrics.apiRequestTotal._getValue() || 1;
    const totalErrors = systemMetrics.errorRate._getValue() || 0;
    const errorRate = totalErrors / totalRequests;
    if (errorRate > 0.05) {
      healthScore -= 0.5;
    }
    
    // Check SSE failure rate
    const sseTotal = sseMetrics.totalConnections._getValue() || 1;
    const sseFailed = sseMetrics.connectionErrors._getValue() || 0;
    const sseFailureRate = sseFailed / sseTotal;
    if (sseFailureRate > 0.1) {
      healthScore -= 0.2;
    }
    
    systemMetrics.systemHealth.set(Math.max(0, healthScore));
  } catch (error) {
    logger.error('Error updating system health metric', { error: error.message });
  }
}

// Update system health every 30 seconds
setInterval(updateSystemHealth, 30000);

/**
 * Export all metrics and utilities
 */
module.exports = {
  register,
  metrics: {
    business: businessMetrics,
    sse: sseMetrics,
    polling: pollingMetrics,
    system: systemMetrics,
    performance: performanceMetrics
  },
  middleware: {
    http: httpMetricsMiddleware
  },
  
  // Convenience methods for common operations
  recordBid(strategy, amount, success) {
    businessMetrics.bidsPlaced.inc({ 
      strategy, 
      result: success ? 'success' : 'failed' 
    });
    if (success && amount) {
      businessMetrics.bidAmount.observe(amount);
    }
  },
  
  recordSSEEvent(eventType, latency) {
    sseMetrics.eventsReceived.inc({ event_type: eventType });
    if (latency) {
      sseMetrics.eventLatency.observe(latency);
    }
  },
  
  recordAuctionUpdate(source) {
    pollingMetrics.updateSource.inc({ source });
  },
  
  setCircuitBreakerState(state) {
    const stateValue = state === 'CLOSED' ? 0 : state === 'OPEN' ? 1 : 2;
    performanceMetrics.circuitBreakerState.set(stateValue);
  },
  
  // Get metrics in Prometheus format
  async getMetrics() {
    return register.metrics();
  },
  
  // Get content type for Prometheus
  getContentType() {
    return register.contentType;
  }
};