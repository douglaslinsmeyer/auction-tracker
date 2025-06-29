const axios = require('axios');
require('dotenv').config();

const API_BASE = 'http://localhost:3000/api';
const AUTH_TOKEN = process.env.AUTH_TOKEN;

if (!AUTH_TOKEN) {
  console.error('AUTH_TOKEN environment variable is required');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json'
};

async function checkHealth() {
  try {
    const response = await axios.get('http://localhost:3000/health');
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error.message);
    return null;
  }
}

async function simulateEndedAuction() {
  // This is a test script to verify memory cleanup
  console.log('Memory Cleanup Test Script');
  console.log('=========================\n');
  
  console.log('Initial health check:');
  let health = await checkHealth();
  if (health) {
    console.log(`- Total auctions: ${health.monitoredAuctions}`);
    console.log(`- Active: ${health.memoryStats?.active || 0}`);
    console.log(`- Ended: ${health.memoryStats?.ended || 0}`);
    console.log(`- Memory: ${health.memoryUsage?.heapUsed || 'N/A'}`);
  }
  
  console.log('\nTo test memory cleanup:');
  console.log('1. Start monitoring some auctions via the API or UI');
  console.log('2. Wait for them to end naturally (or simulate by setting timeRemaining to 0)');
  console.log('3. Check health endpoint to see ended auction count');
  console.log('4. Wait for cleanup interval (default 5 minutes) or set AUCTION_CLEANUP_INTERVAL_MS=30000 for 30-second cleanup');
  console.log('5. Check health endpoint again to verify ended auctions were cleaned up');
  
  // Monitor health every 30 seconds
  console.log('\nMonitoring health every 30 seconds (Ctrl+C to stop)...\n');
  
  setInterval(async () => {
    const health = await checkHealth();
    if (health) {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] Auctions - Total: ${health.monitoredAuctions}, Active: ${health.memoryStats?.active || 0}, Ended: ${health.memoryStats?.ended || 0}, Memory: ${health.memoryUsage?.heapUsed || 'N/A'}`);
    }
  }, 30000);
}

simulateEndedAuction().catch(console.error);