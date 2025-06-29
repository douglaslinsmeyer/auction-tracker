const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

class MockNellisServer {
  constructor(port = 8080) {
    this.port = port;
    this.app = express();
    this.server = null;
    this.wss = null;
    this.auctions = new Map();
    this.bids = new Map();
    this.setupRoutes();
  }

  setupRoutes() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'static')));

    // Auction page
    this.app.get('/auction/:auctionId', (req, res) => {
      const { auctionId } = req.params;
      const auction = this.auctions.get(auctionId) || this.createDefaultAuction(auctionId);
      
      res.send(this.generateAuctionHTML(auction));
    });

    // API endpoints
    this.app.get('/api/auction/:auctionId', (req, res) => {
      const { auctionId } = req.params;
      const auction = this.auctions.get(auctionId);
      
      if (!auction) {
        return res.status(404).json({ error: 'Auction not found' });
      }
      
      res.json(auction);
    });

    this.app.post('/api/bid', (req, res) => {
      const { auctionId, amount, userId } = req.body;
      const auction = this.auctions.get(auctionId);
      
      if (!auction) {
        return res.status(404).json({ error: 'Auction not found' });
      }
      
      if (amount <= auction.currentBid) {
        return res.status(400).json({ error: 'Bid too low' });
      }
      
      // Update auction
      auction.currentBid = amount;
      auction.bidCount++;
      auction.lastBidder = userId;
      auction.lastBidTime = new Date().toISOString();
      
      // Reset timer if bid in last 30 seconds
      if (auction.timeLeft <= 30) {
        auction.timeLeft = 30;
      }
      
      // Store bid
      if (!this.bids.has(auctionId)) {
        this.bids.set(auctionId, []);
      }
      this.bids.get(auctionId).push({
        amount,
        userId,
        timestamp: new Date().toISOString()
      });
      
      // Broadcast update
      this.broadcastAuctionUpdate(auction);
      
      res.json({ success: true, auction });
    });

    // SSE endpoint
    this.app.get('/sse/:channelId', (req, res) => {
      const { channelId } = req.params;
      
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      
      // Send initial connection event
      res.write(`data: {"type":"connected","channel":"${channelId}"}\n\n`);
      
      // Store connection
      const client = { res, channelId };
      if (!this.sseClients) this.sseClients = [];
      this.sseClients.push(client);
      
      // Handle client disconnect
      req.on('close', () => {
        this.sseClients = this.sseClients.filter(c => c !== client);
      });
    });
  }

  createDefaultAuction(auctionId) {
    const auction = {
      id: auctionId,
      title: `Test Auction ${auctionId}`,
      description: 'This is a test auction for E2E testing',
      currentBid: 50.00,
      startingBid: 10.00,
      bidIncrement: 5.00,
      timeLeft: 300, // 5 minutes
      endTime: new Date(Date.now() + 300000).toISOString(),
      bidCount: 5,
      watching: 12,
      images: [`/images/auction-${auctionId}.jpg`],
      lastBidder: 'user123',
      lastBidTime: new Date().toISOString()
    };
    
    this.auctions.set(auctionId, auction);
    return auction;
  }

  generateAuctionHTML(auction) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${auction.title} - Nellis Auction</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .auction-details { margin: 20px 0; }
          .bid-section { background: #f0f0f0; padding: 15px; border-radius: 5px; }
          .current-bid { font-size: 24px; font-weight: bold; color: #2ecc71; }
          .time-left { font-size: 18px; color: #e74c3c; }
          .bid-button { background: #3498db; color: white; padding: 10px 20px; border: none; cursor: pointer; }
          .bid-button:hover { background: #2980b9; }
        </style>
      </head>
      <body>
        <h1 id="auction-title">${auction.title}</h1>
        <div class="auction-details">
          <p>${auction.description}</p>
          <div class="bid-section">
            <div class="current-bid">Current Bid: $<span id="current-bid">${auction.currentBid.toFixed(2)}</span></div>
            <div class="bid-count">Bids: <span id="bid-count">${auction.bidCount}</span></div>
            <div class="time-left">Time Left: <span id="time-left">${this.formatTime(auction.timeLeft)}</span></div>
            <div class="bid-form">
              <input type="number" id="bid-amount" step="0.01" min="${auction.currentBid + auction.bidIncrement}" value="${auction.currentBid + auction.bidIncrement}">
              <button class="bid-button" onclick="placeBid()">Place Bid</button>
            </div>
          </div>
        </div>
        <script>
          const auctionId = '${auction.id}';
          let timeLeft = ${auction.timeLeft};
          
          // Update timer
          setInterval(() => {
            if (timeLeft > 0) {
              timeLeft--;
              document.getElementById('time-left').textContent = formatTime(timeLeft);
            }
          }, 1000);
          
          function formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return mins + ':' + (secs < 10 ? '0' : '') + secs;
          }
          
          function placeBid() {
            const amount = parseFloat(document.getElementById('bid-amount').value);
            fetch('/api/bid', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ auctionId, amount, userId: 'testUser' })
            })
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                document.getElementById('current-bid').textContent = data.auction.currentBid.toFixed(2);
                document.getElementById('bid-count').textContent = data.auction.bidCount;
              }
            });
          }
          
          // WebSocket for real-time updates
          const ws = new WebSocket('ws://localhost:${this.port}/ws');
          ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'auctionUpdate' && data.auction.id === auctionId) {
              document.getElementById('current-bid').textContent = data.auction.currentBid.toFixed(2);
              document.getElementById('bid-count').textContent = data.auction.bidCount;
              timeLeft = data.auction.timeLeft;
            }
          };
        </script>
      </body>
      </html>
    `;
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  broadcastAuctionUpdate(auction) {
    const message = JSON.stringify({
      type: 'auctionUpdate',
      auction
    });
    
    // WebSocket broadcast
    if (this.wss) {
      this.wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
    
    // SSE broadcast
    if (this.sseClients) {
      const sseMessage = `data: ${JSON.stringify({
        type: 'ch_product_bids:' + auction.id,
        data: auction
      })}\n\n`;
      
      this.sseClients.forEach(client => {
        client.res.write(sseMessage);
      });
    }
  }

  async start() {
    return new Promise((resolve) => {
      this.server = http.createServer(this.app);
      
      // Setup WebSocket
      this.wss = new WebSocket.Server({ server: this.server });
      
      this.wss.on('connection', (ws) => {
        ws.on('message', (message) => {
          // Handle WebSocket messages if needed
        });
      });
      
      this.server.listen(this.port, () => {
        console.log(`Mock Nellis server running on http://localhost:${this.port}`);
        resolve();
      });
    });
  }

  async stop() {
    if (this.wss) {
      this.wss.close();
    }
    
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(resolve);
      });
    }
  }

  // Test control methods
  updateAuction(auctionId, updates) {
    const auction = this.auctions.get(auctionId);
    if (auction) {
      Object.assign(auction, updates);
      this.broadcastAuctionUpdate(auction);
    }
  }

  simulateBid(auctionId, amount, userId = 'otherUser') {
    const auction = this.auctions.get(auctionId);
    if (auction && amount > auction.currentBid) {
      auction.currentBid = amount;
      auction.bidCount++;
      auction.lastBidder = userId;
      auction.lastBidTime = new Date().toISOString();
      
      if (auction.timeLeft <= 30) {
        auction.timeLeft = 30;
      }
      
      this.broadcastAuctionUpdate(auction);
    }
  }

  closeAuction(auctionId) {
    const auction = this.auctions.get(auctionId);
    if (auction) {
      auction.timeLeft = 0;
      auction.status = 'closed';
      this.broadcastAuctionUpdate(auction);
      
      // Send SSE close event
      if (this.sseClients) {
        const closeMessage = `data: ${JSON.stringify({
          type: 'ch_product_closed:' + auction.id,
          data: auction
        })}\n\n`;
        
        this.sseClients.forEach(client => {
          client.res.write(closeMessage);
        });
      }
    }
  }
}

module.exports = MockNellisServer;