const { chromium } = require('playwright');

async function findActiveAuction() {
  console.log('=== Finding Active Nellis Auctions ===\n');
  
  const browser = await chromium.launch({ 
    headless: true
  });
  
  const page = await browser.newPage();
  
  // Go to browse page
  console.log('Loading browse page...');
  await page.goto('https://www.nellisauction.com/browse', {
    waitUntil: 'domcontentloaded'
  });
  
  await page.waitForTimeout(3000);
  
  // Find auctions that are ending soon or have recent activity
  const auctionData = await page.evaluate(() => {
    const auctions = [];
    const cards = document.querySelectorAll('a[href*="/p/"], a[href*="/products/"]');
    
    cards.forEach(card => {
      const href = card.href;
      const titleEl = card.querySelector('h3, h4, [class*="title"]');
      const priceEl = card.querySelector('[class*="price"], [class*="bid"]');
      const timeEl = card.querySelector('[class*="time"], [class*="countdown"]');
      
      if (href && titleEl) {
        auctions.push({
          url: href,
          title: titleEl.textContent.trim().substring(0, 50),
          price: priceEl ? priceEl.textContent.trim() : 'N/A',
          time: timeEl ? timeEl.textContent.trim() : 'N/A'
        });
      }
    });
    
    return auctions.slice(0, 10); // Get first 10
  });
  
  console.log('\nFound auctions:');
  auctionData.forEach((auction, idx) => {
    console.log(`\n${idx + 1}. ${auction.title}`);
    console.log(`   Price: ${auction.price}`);
    console.log(`   Time: ${auction.time}`);
    console.log(`   URL: ${auction.url}`);
  });
  
  // Now monitor the first auction for SSE activity
  if (auctionData.length > 0) {
    console.log('\n\n=== Monitoring First Auction for SSE Activity ===\n');
    
    // Inject SSE monitoring
    await page.addInitScript(() => {
      window.SSE_LOG = [];
      
      const OriginalEventSource = window.EventSource;
      window.EventSource = function(url, options) {
        console.log(`[SSE] Creating: ${url}`);
        const es = new OriginalEventSource(url, options);
        
        // Log all custom event listeners
        const originalAddEventListener = es.addEventListener;
        es.addEventListener = function(type, listener, options) {
          window.SSE_LOG.push({ action: 'listener', type, time: Date.now() });
          
          // Wrap to capture events
          const wrapped = function(event) {
            window.SSE_LOG.push({ 
              action: 'event',
              type,
              data: event.data,
              time: Date.now()
            });
            console.log(`[SSE Event: ${type}] ${event.data}`);
            return listener.call(this, event);
          };
          
          return originalAddEventListener.call(this, type, wrapped, options);
        };
        
        return es;
      };
    });
    
    await page.goto(auctionData[0].url, {
      waitUntil: 'domcontentloaded'
    });
    
    console.log(`Monitoring: ${auctionData[0].title}`);
    console.log('Waiting 30 seconds for SSE events...\n');
    
    // Monitor for 30 seconds
    await page.waitForTimeout(30000);
    
    // Get SSE log
    const sseLog = await page.evaluate(() => window.SSE_LOG || []);
    
    console.log('\nSSE Activity Summary:');
    const listeners = sseLog.filter(e => e.action === 'listener');
    const events = sseLog.filter(e => e.action === 'event');
    
    console.log(`Event Listeners: ${listeners.map(l => l.type).join(', ')}`);
    console.log(`Events Received: ${events.length}`);
    
    if (events.length > 0) {
      console.log('\nSample Events:');
      events.slice(0, 5).forEach(event => {
        console.log(`\nType: ${event.type}`);
        console.log(`Data: ${event.data}`);
        try {
          if (event.data && event.data.startsWith('{')) {
            const parsed = JSON.parse(event.data);
            console.log('Parsed:');
            console.log(JSON.stringify(parsed, null, 2));
          }
        } catch (e) {}
      });
    }
  }
  
  await browser.close();
}

findActiveAuction().catch(console.error);