/**
 * Metrics Collection System
 * Provides counters, gauges, and histograms for monitoring application performance
 */

const logger = require('./logger');

/**
 * Simple metrics collection without external dependencies
 * Can be easily upgraded to Prometheus, StatsD, or other systems later
 */
class MetricsCollector {
  constructor() {
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
    this.startTime = Date.now();
    
    // Initialize metrics
    this.initializeSSEMetrics();
    this.initializePollingMetrics();
    this.initializeGeneralMetrics();
  }

  initializeSSEMetrics() {
    // SSE-specific metrics
    this.counters.set('sse_connections_total', { value: 0, help: 'Total SSE connections attempted' });
    this.counters.set('sse_connections_successful', { value: 0, help: 'Successful SSE connections' });
    this.counters.set('sse_connections_failed', { value: 0, help: 'Failed SSE connections' });
    this.counters.set('sse_events_received_total', { value: 0, help: 'Total SSE events received', labels: {} });
    this.counters.set('sse_reconnection_attempts', { value: 0, help: 'SSE reconnection attempts' });
    this.counters.set('sse_fallback_activations', { value: 0, help: 'Times SSE fell back to polling' });
    
    this.gauges.set('sse_active_connections', { value: 0, help: 'Currently active SSE connections' });
    this.gauges.set('sse_connection_errors', { value: 0, help: 'Current connection error count' });
    
    this.histograms.set('sse_event_processing_duration', { 
      buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
      values: [],
      help: 'Time to process SSE events in milliseconds'
    });
  }

  initializePollingMetrics() {
    // Polling fallback metrics
    this.counters.set('polling_requests_total', { value: 0, help: 'Total polling requests made' });
    this.counters.set('polling_requests_successful', { value: 0, help: 'Successful polling requests' });
    this.counters.set('polling_requests_failed', { value: 0, help: 'Failed polling requests' });
    this.counters.set('update_source_total', { value: 0, help: 'Auction updates by source', labels: {} });
    
    this.gauges.set('polling_active_auctions', { value: 0, help: 'Currently polling auctions' });
    
    this.histograms.set('polling_response_duration', {
      buckets: [100, 250, 500, 1000, 2000, 5000, 10000],
      values: [],
      help: 'Polling request response time in milliseconds'
    });
  }

  initializeGeneralMetrics() {
    // General application metrics
    this.counters.set('auction_monitors_total', { value: 0, help: 'Total auction monitors created' });
    this.counters.set('bids_placed_total', { value: 0, help: 'Total bids placed' });
    this.counters.set('auctions_completed_total', { value: 0, help: 'Total auctions completed' });
    
    this.gauges.set('active_auction_monitors', { value: 0, help: 'Currently active auction monitors' });
    this.gauges.set('websocket_connections', { value: 0, help: 'Active WebSocket connections' });
  }

  /**
   * Increment a counter
   * @param {string} name - Counter name
   * @param {Object} labels - Optional labels
   * @param {number} value - Value to add (default: 1)
   */
  incrementCounter(name, labels = {}, value = 1) {
    const counter = this.counters.get(name);
    if (counter) {
      if (Object.keys(labels).length > 0) {
        const labelKey = this.serializeLabels(labels);
        counter.labels[labelKey] = (counter.labels[labelKey] || 0) + value;
      } else {
        counter.value += value;
      }
    } else {
      logger.warn(`Unknown counter: ${name}`);
    }
  }

  /**
   * Set a gauge value
   * @param {string} name - Gauge name
   * @param {number} value - Value to set
   * @param {Object} labels - Optional labels
   */
  setGauge(name, value, labels = {}) {
    const gauge = this.gauges.get(name);
    if (gauge) {
      if (Object.keys(labels).length > 0) {
        const labelKey = this.serializeLabels(labels);
        gauge.labels = gauge.labels || {};
        gauge.labels[labelKey] = value;
      } else {
        gauge.value = value;
      }
    } else {
      logger.warn(`Unknown gauge: ${name}`);
    }
  }

  /**
   * Increment a gauge
   * @param {string} name - Gauge name
   * @param {number} value - Value to add (default: 1)
   */
  incrementGauge(name, value = 1) {
    const gauge = this.gauges.get(name);
    if (gauge) {
      gauge.value += value;
    } else {
      logger.warn(`Unknown gauge: ${name}`);
    }
  }

  /**
   * Decrement a gauge
   * @param {string} name - Gauge name
   * @param {number} value - Value to subtract (default: 1)
   */
  decrementGauge(name, value = 1) {
    const gauge = this.gauges.get(name);
    if (gauge) {
      gauge.value = Math.max(0, gauge.value - value);
    } else {
      logger.warn(`Unknown gauge: ${name}`);
    }
  }

  /**
   * Record a histogram value
   * @param {string} name - Histogram name
   * @param {number} value - Value to record
   */
  recordHistogram(name, value) {
    const histogram = this.histograms.get(name);
    if (histogram) {
      histogram.values.push({
        value,
        timestamp: Date.now()
      });
      
      // Keep only last 1000 values for memory management
      if (histogram.values.length > 1000) {
        histogram.values = histogram.values.slice(-1000);
      }
    } else {
      logger.warn(`Unknown histogram: ${name}`);
    }
  }

  /**
   * Get all metrics in a structured format
   * @returns {Object} All metrics with calculated statistics
   */
  getAllMetrics() {
    const metrics = {
      counters: {},
      gauges: {},
      histograms: {},
      uptime: Date.now() - this.startTime,
      timestamp: new Date().toISOString()
    };

    // Process counters
    for (const [name, counter] of this.counters) {
      metrics.counters[name] = {
        value: counter.value,
        labels: counter.labels || {},
        help: counter.help
      };
    }

    // Process gauges
    for (const [name, gauge] of this.gauges) {
      metrics.gauges[name] = {
        value: gauge.value,
        labels: gauge.labels || {},
        help: gauge.help
      };
    }

    // Process histograms with statistics
    for (const [name, histogram] of this.histograms) {
      const stats = this.calculateHistogramStats(histogram);
      metrics.histograms[name] = {
        ...stats,
        help: histogram.help,
        sample_count: histogram.values.length
      };
    }

    return metrics;
  }

  /**
   * Get SSE-specific metrics summary
   * @returns {Object} SSE metrics
   */
  getSSEMetrics() {
    const all = this.getAllMetrics();
    return {
      connections: {
        total: all.counters.sse_connections_total?.value || 0,
        successful: all.counters.sse_connections_successful?.value || 0,
        failed: all.counters.sse_connections_failed?.value || 0,
        active: all.gauges.sse_active_connections?.value || 0,
        success_rate: this.calculateSuccessRate('sse_connections_successful', 'sse_connections_total')
      },
      events: {
        total: all.counters.sse_events_received_total?.value || 0,
        by_type: all.counters.sse_events_received_total?.labels || {},
        processing_time: all.histograms.sse_event_processing_duration || {}
      },
      reliability: {
        reconnection_attempts: all.counters.sse_reconnection_attempts?.value || 0,
        fallback_activations: all.counters.sse_fallback_activations?.value || 0,
        error_count: all.gauges.sse_connection_errors?.value || 0
      }
    };
  }

  /**
   * Calculate success rate percentage
   * @param {string} successCounter - Name of success counter
   * @param {string} totalCounter - Name of total counter
   * @returns {number} Success rate as percentage
   */
  calculateSuccessRate(successCounter, totalCounter) {
    const success = this.counters.get(successCounter)?.value || 0;
    const total = this.counters.get(totalCounter)?.value || 0;
    
    if (total === 0) return 0;
    return Math.round((success / total) * 100 * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate histogram statistics
   * @param {Object} histogram - Histogram object
   * @returns {Object} Statistics
   */
  calculateHistogramStats(histogram) {
    if (histogram.values.length === 0) {
      return {
        count: 0,
        sum: 0,
        avg: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0
      };
    }

    const values = histogram.values.map(v => v.value).sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((acc, val) => acc + val, 0);
    const avg = sum / count;

    return {
      count,
      sum,
      avg: Math.round(avg * 100) / 100,
      min: values[0],
      max: values[count - 1],
      p50: this.percentile(values, 0.5),
      p95: this.percentile(values, 0.95),
      p99: this.percentile(values, 0.99)
    };
  }

  /**
   * Calculate percentile
   * @param {number[]} sortedValues - Sorted array of values
   * @param {number} p - Percentile (0.0 to 1.0)
   * @returns {number} Percentile value
   */
  percentile(sortedValues, p) {
    if (sortedValues.length === 0) return 0;
    
    const index = p * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * Serialize labels for use as map keys
   * @param {Object} labels - Label object
   * @returns {string} Serialized labels
   */
  serializeLabels(labels) {
    return Object.keys(labels)
      .sort()
      .map(key => `${key}=${labels[key]}`)
      .join(',');
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset() {
    for (const counter of this.counters.values()) {
      counter.value = 0;
      counter.labels = {};
    }
    
    for (const gauge of this.gauges.values()) {
      gauge.value = 0;
      gauge.labels = {};
    }
    
    for (const histogram of this.histograms.values()) {
      histogram.values = [];
    }
    
    this.startTime = Date.now();
  }

  /**
   * Log metrics summary
   */
  logMetricsSummary() {
    const sse = this.getSSEMetrics();
    
    logger.info('SSE Metrics Summary', {
      connections: {
        active: sse.connections.active,
        total: sse.connections.total,
        success_rate: `${sse.connections.success_rate}%`
      },
      events: {
        total: sse.events.total,
        avg_processing_time: `${sse.events.processing_time.avg || 0}ms`
      },
      reliability: {
        reconnections: sse.reliability.reconnection_attempts,
        fallbacks: sse.reliability.fallback_activations
      }
    });
  }
}

// Create singleton instance
const metrics = new MetricsCollector();

// Export both instance and class
module.exports = metrics;
module.exports.MetricsCollector = MetricsCollector;