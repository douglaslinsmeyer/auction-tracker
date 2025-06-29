const https = require('https');
const EventSource = require('eventsource');

async function analyzeNellisAPI() {
  console.log('=== Nellis Auction API Analysis ===\n');
  
  // Test SSE endpoint
  console.log('1. Testing Server-Sent Events (SSE) endpoint...');
  console.log('   URL: https://sse.nellisauction.com\n');
  
  try {
    const eventSource = new EventSource('https://sse.nellisauction.com');
    
    eventSource.onopen = () => {
      console.log('   [SSE] Connection opened successfully');
    };
    
    eventSource.onmessage = (event) => {
      console.log('   [SSE] Message received:', event.data);
      try {
        const data = JSON.parse(event.data);
        console.log('   [SSE] Parsed data:', JSON.stringify(data, null, 2));
      } catch (e) {
        console.log('   [SSE] Raw message:', event.data);
      }
    };
    
    eventSource.onerror = (error) => {
      console.log('   [SSE] Connection error:', error);
      eventSource.close();
    };
    
    // Listen for 10 seconds
    setTimeout(() => {
      eventSource.close();
      console.log('   [SSE] Connection closed after 10 seconds\n');
      testMainAPI();
    }, 10000);
    
  } catch (error) {
    console.log('   [SSE] Failed to connect:', error.message);
    testMainAPI();
  }
}

function testMainAPI() {
  console.log('2. Testing main API endpoint...');
  console.log('   URL: https://cargo.prd.nellis.run/api\n');
  
  const options = {
    hostname: 'cargo.prd.nellis.run',
    path: '/api',
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  };
  
  const req = https.request(options, (res) => {
    console.log('   [API] Status:', res.statusCode);
    console.log('   [API] Headers:', res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('   [API] Response:', data.substring(0, 200) + '...\n');
      testAuctionEndpoints();
    });
  });
  
  req.on('error', (error) => {
    console.log('   [API] Request error:', error.message);
    testAuctionEndpoints();
  });
  
  req.end();
}

function testAuctionEndpoints() {
  console.log('3. Testing potential auction endpoints...\n');
  
  const endpoints = [
    '/api/auctions',
    '/api/auctions/active',
    '/api/bids',
    '/api/items',
    '/api/categories'
  ];
  
  endpoints.forEach((endpoint, index) => {
    setTimeout(() => {
      const options = {
        hostname: 'cargo.prd.nellis.run',
        path: endpoint,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      };
      
      const req = https.request(options, (res) => {
        console.log(`   [${endpoint}] Status: ${res.statusCode}`);
      });
      
      req.on('error', (error) => {
        console.log(`   [${endpoint}] Error: ${error.message}`);
      });
      
      req.end();
    }, index * 1000);
  });
}

// Check if eventsource is installed
try {
  require.resolve('eventsource');
  analyzeNellisAPI();
} catch(e) {
  console.log('Installing eventsource package...');
  const { exec } = require('child_process');
  exec('npm install eventsource', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return;
    }
    console.log('Package installed. Please run the script again.');
  });
}