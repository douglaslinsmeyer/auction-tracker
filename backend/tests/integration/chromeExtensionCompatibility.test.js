/**
 * Chrome Extension Compatibility Integration Test
 * Simulates how the Chrome extension uses the backend services
 */

const axios = require('axios');
const WebSocket = require('ws');

describe('Chrome Extension Compatibility', () => {
  let server;
  let serverUrl;
  let wsUrl;

  beforeAll(async () => {
    // Initialize services first
    const storage = require('../../src/services/storage');
    const nellisApi = require('../../src/services/nellisApi');
    const auctionMonitor = require('../../src/services/auctionMonitor');

    await storage.initialize();
    await nellisApi.initialize();

    // Start server on random port
    const { app } = require('../../src/index');
    const { Server: WebSocketServer } = require('ws');
    const wsHandler = require('../../src/services/websocket');

    return new Promise((resolve) => {
      server = app.listen(0, async () => {
        const port = server.address().port;
        serverUrl = `http://localhost:${port}`;
        wsUrl = `ws://localhost:${port}/ws`;

        // Set up WebSocket server
        const wss = new WebSocketServer({ server, path: '/ws' });
        wss.on('connection', (ws, _req) => {
          wsHandler.handleConnection(ws, wss);
        });

        // Initialize auction monitor
        await auctionMonitor.initialize(wss, (auctionId) => {
          wsHandler.broadcastAuctionState(auctionId);
        });

        resolve();
      });
    });
  });

  afterAll((done) => {
    const auctionMonitor = require('../../src/services/auctionMonitor');
    auctionMonitor.shutdown();

    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  describe('Direct Service Imports', () => {
    it('should support Chrome extension singleton import pattern', () => {
      // This is how the Chrome extension imports services
      const auctionMonitor = require('../../src/services/auctionMonitor');
      const nellisApi = require('../../src/services/nellisApi');

      expect(auctionMonitor).toBeDefined();
      expect(nellisApi).toBeDefined();

      // Should have all expected methods
      expect(typeof auctionMonitor.addAuction).toBe('function');
      expect(typeof auctionMonitor.removeAuction).toBe('function');
      expect(typeof auctionMonitor.getMonitoredAuctions).toBe('function');
      expect(typeof nellisApi.getAuctionData).toBe('function');
      expect(typeof nellisApi.placeBid).toBe('function');
    });
  });

  describe('API Endpoints', () => {
    it('should accept requests in Chrome extension format', async () => {
      const response = await axios.get(`${serverUrl}/health`, {
        validateStatus: () => true
      });

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('healthy');
    });

    it('should handle monitoring requests with config wrapper', async () => {
      const response = await axios.post(
        `${serverUrl}/api/auctions/12345/monitor`,
        {
          config: {
            maxBid: 100,
            strategy: 'auto',
            autoBid: false
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.AUTH_TOKEN || 'test-auth-token'}`
          },
          validateStatus: () => true
        }
      );

      // Debug logging
      if (response.status === 400) {
        console.error('400 error response:', response.data);
      }

      expect([200, 409]).toContain(response.status); // 200 for new, 409 for already monitoring
    });
  });

  describe('WebSocket Communication', () => {
    it('should handle Chrome extension WebSocket pattern', (done) => {
      const ws = new WebSocket(wsUrl);

      ws.on('open', () => {
        // Chrome extension sends auth immediately
        ws.send(JSON.stringify({
          type: 'authenticate',
          token: process.env.AUTH_TOKEN || 'test-auth-token'
        }));
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data);

        if (message.type === 'connected') {
          // Connection established
          expect(message.clientId).toBeDefined();
        } else if (message.type === 'authenticated') {
          // Auth succeeded
          expect(message.success).toBe(true);
          ws.close();
          done();
        }
      });

      ws.on('error', (error) => {
        done(error);
      });
    });
  });

  describe('Service State Management', () => {
    it('should maintain state across imports', async () => {
      const auctionMonitor = require('../../src/services/auctionMonitor');

      // Add an auction with valid numeric ID
      const added = await auctionMonitor.addAuction('99999', {
        maxBid: 50,
        strategy: 'auto'
      });

      expect(added).toBe(true);

      // Re-import and check state
      const auctionMonitor2 = require('../../src/services/auctionMonitor');
      const auctions = auctionMonitor2.getMonitoredAuctions();

      const testAuction = auctions.find(a => a.id === '99999');
      expect(testAuction).toBeDefined();
      expect(testAuction.config.maxBid).toBe(50);

      // Cleanup
      await auctionMonitor.removeAuction('99999');
    });
  });
});