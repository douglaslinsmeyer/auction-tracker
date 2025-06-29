#!/usr/bin/env node

/**
 * Metrics Monitoring Script
 * Periodically logs SSE metrics to console
 */

const axios = require('axios');

const METRICS_URL = 'http://localhost:3000/metrics/sse';
const INTERVAL = 10000; // 10 seconds

async function fetchAndLogMetrics() {
  try {
    const response = await axios.get(METRICS_URL);
    const metrics = response.data;
    
    console.log('\n=== SSE Metrics Report ===');
    console.log(new Date().toISOString());
    console.log('');
    
    console.log('Connections:');
    console.log(`  Total: ${metrics.connections.total}`);
    console.log(`  Successful: ${metrics.connections.successful}`);
    console.log(`  Failed: ${metrics.connections.failed}`);
    console.log(`  Active: ${metrics.connections.active}`);
    console.log(`  Success Rate: ${metrics.connections.success_rate}%`);
    
    console.log('\nEvents:');
    console.log(`  Total Received: ${metrics.events.total}`);
    if (Object.keys(metrics.events.by_type).length > 0) {
      console.log('  By Type:');
      Object.entries(metrics.events.by_type).forEach(([type, count]) => {
        console.log(`    ${type}: ${count}`);
      });
    }
    
    if (metrics.events.processing_time.count > 0) {
      console.log('  Processing Time:');
      console.log(`    Average: ${metrics.events.processing_time.avg}ms`);
      console.log(`    P95: ${metrics.events.processing_time.p95}ms`);
      console.log(`    P99: ${metrics.events.processing_time.p99}ms`);
    }
    
    console.log('\nReliability:');
    console.log(`  Reconnection Attempts: ${metrics.reliability.reconnection_attempts}`);
    console.log(`  Fallback Activations: ${metrics.reliability.fallback_activations}`);
    console.log(`  Current Errors: ${metrics.reliability.error_count}`);
    
  } catch (error) {
    console.error('Failed to fetch metrics:', error.message);
  }
}

// Initial fetch
fetchAndLogMetrics();

// Set up periodic monitoring
setInterval(fetchAndLogMetrics, INTERVAL);

console.log(`Monitoring SSE metrics every ${INTERVAL/1000} seconds...`);
console.log('Press Ctrl+C to stop.');