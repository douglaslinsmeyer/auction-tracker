const { chromium } = require('playwright');

async function analyzeSSE() {
  console.log('=== Nellis SSE Real-time Analysis ===\n');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const sseData = {
    endpoint: null,
    events: [],
    customEvents: [],
    messages: []
  };
  
  // Enhanced console monitoring
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('SSE') || text.includes('EventSource')) {
      // Extract SSE endpoint
      const endpointMatch = text.match(/https:\/\/sse\.nellisauction\.com[^\s]*/);
      if (endpointMatch && !sseData.endpoint) {
        sseData.endpoint = endpointMatch[0];
      }
      
      // Track custom events
      const customEventMatch = text.match(/Custom event registered: ([\w:]+)/);
      if (customEventMatch) {
        sseData.customEvents.push(customEventMatch[1]);
      }
      
      // Track messages
      if (text.includes('Message:')) {
        const messageMatch = text.match(/Message: (.+)/);
        if (messageMatch) {
          sseData.messages.push(messageMatch[1]);
        }
      }
    }
  });
  
  // Navigate to auction page
  console.log('Loading auction page...\n');
  await page.goto('https://www.nellisauction.com/p/PARTIAL-ITEM-THIS-IS-ONLY-BOX-1-OUT-OF-A-SET-OF-5-BOXES-SUNJOY/58040119', {
    waitUntil: 'domcontentloaded'
  });
  
  // Wait for SSE to establish
  await page.waitForTimeout(5000);
  
  // Close browser
  await browser.close();
  
  // Analyze findings
  console.log('=== SSE CONFIGURATION ===\n');
  console.log(`Endpoint: ${sseData.endpoint || 'Not detected'}`);
  
  if (sseData.endpoint) {
    const url = new URL(sseData.endpoint);
    console.log(`Base URL: ${url.origin}${url.pathname}`);
    console.log(`Parameters: ${url.search}`);
  }
  
  console.log('\n=== CUSTOM SSE EVENTS ===');
  if (sseData.customEvents.length > 0) {
    sseData.customEvents.forEach(event => console.log(`- ${event}`));
  } else {
    console.log('No custom events detected');
  }
  
  console.log('\n=== MESSAGE PATTERNS ===');
  const messageTypes = new Set();
  sseData.messages.forEach(msg => {
    if (msg === 'ping') messageTypes.add('ping (keepalive)');
    else if (msg.includes('connected')) messageTypes.add('connection confirmation');
    else if (msg.includes('bid')) messageTypes.add('bid updates');
    else if (msg.includes('closed')) messageTypes.add('auction closed');
    else messageTypes.add('other');
  });
  
  messageTypes.forEach(type => console.log(`- ${type}`));
  
  console.log('\n=== ANALYSIS SUMMARY ===\n');
  console.log('1. SSE Endpoint Pattern:');
  console.log('   https://sse.nellisauction.com/live-products?productId={productId}');
  
  console.log('\n2. Event Types:');
  console.log('   - Default "message" events for pings');
  console.log('   - Custom event: ch_product_bids:{productId} (for bid updates)');
  console.log('   - Custom event: ch_product_closed:{productId} (for auction closure)');
  
  console.log('\n3. Communication Pattern:');
  console.log('   - Connection established with product-specific endpoint');
  console.log('   - Server sends "ping" messages as keepalive');
  console.log('   - Bid updates likely sent via ch_product_bids event');
  console.log('   - Auction closure notified via ch_product_closed event');
  
  console.log('\n4. Implementation Notes:');
  console.log('   - SSE only active on individual product pages');
  console.log('   - Each product has its own SSE connection');
  console.log('   - Uses custom event types for different update types');
}

analyzeSSE().catch(console.error);