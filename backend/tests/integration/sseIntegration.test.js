const { auctionMonitor, sseClient } = require('../../src/services');

// Mock storage to avoid Redis dependency
jest.mock('../../src/services/storage', () => ({
  initialize: jest.fn().mockResolvedValue(true),
  getAllAuctions: jest.fn().mockResolvedValue([]),
  saveAuction: jest.fn().mockResolvedValue(true),
  getSettings: jest.fn().mockResolvedValue({
    general: {
      defaultMaxBid: 100,
      defaultStrategy: 'increment',
      autoBidDefault: false
    }
  })
}));

// Mock eventsource
jest.mock('eventsource');

describe('SSE Integration', () => {
  beforeEach(async () => {
    // Initialize auction monitor (which initializes SSE)
    await auctionMonitor.initialize(null);
  });

  afterEach(() => {
    // Clean up
    if (sseClient) {
      sseClient.disconnectAll();
    }
  });

  describe('SSE Client Integration', () => {
    it('should be available as a service', () => {
      expect(sseClient).toBeDefined();
      expect(typeof sseClient.initialize).toBe('function');
      expect(typeof sseClient.connectToAuction).toBe('function');
      expect(typeof sseClient.getConnectionStatus).toBe('function');
    });

    it('should be initialized by auction monitor', () => {
      expect(auctionMonitor.sseClient).toBe(sseClient);
      expect(sseClient.eventEmitter).toBe(auctionMonitor);
    });

    it('should extract product ID from URLs correctly', () => {
      const testCases = [
        {
          url: 'https://www.nellisauction.com/p/test-product/12345',
          expected: '12345'
        },
        {
          url: 'https://www.nellisauction.com/p/another-item/67890?_data=routes',
          expected: '67890'
        },
        {
          url: 'https://www.nellisauction.com/p/test/999',
          expected: '999'
        },
        {
          url: 'https://www.nellisauction.com/browse',
          expected: null
        },
        {
          url: '',
          expected: null
        }
      ];

      testCases.forEach(testCase => {
        const result = auctionMonitor.extractProductId(testCase.url);
        expect(result).toBe(testCase.expected);
      });
    });
  });

  describe('Auction Monitor SSE Integration', () => {
    it('should have SSE-related methods', () => {
      expect(typeof auctionMonitor.startMonitoring).toBe('function');
      expect(typeof auctionMonitor.handleSSEAuctionUpdate).toBe('function');
      expect(typeof auctionMonitor.handleSSEAuctionClosed).toBe('function');
      expect(typeof auctionMonitor.handleSSEFallback).toBe('function');
    });

    it('should use polling when SSE is disabled', async () => {
      // Mock SSE as disabled
      sseClient.config.enabled = false;

      const startPollingSpy = jest.spyOn(auctionMonitor, 'startPolling');

      const auction = {
        id: '88888',
        url: 'https://www.nellisauction.com/p/test/12345',
        title: 'Test Auction'
      };

      await auctionMonitor.startMonitoring('88888', auction);

      expect(startPollingSpy).toHaveBeenCalledWith('88888');
      expect(auction.useSSE).toBe(false);
      expect(auction.fallbackPolling).toBe(false);
    });

    it('should handle SSE auction updates', async () => {
      const updateData = {
        auctionId: '88888',
        productId: '12345',
        data: {
          currentBid: 150,
          bidCount: 5,
          lastBidder: 'user123',
          updateSource: 'sse'
        },
        source: 'sse'
      };

      // Add auction to monitor first
      auctionMonitor.monitoredAuctions.set('88888', {
        id: '88888',
        data: { currentBid: 100 }
      });

      const broadcastSpy = jest.spyOn(auctionMonitor, 'broadcastAuctionState');

      await auctionMonitor.handleSSEAuctionUpdate(updateData);

      const auction = auctionMonitor.monitoredAuctions.get('88888');
      expect(auction.data.currentBid).toBe(150);
      expect(auction.data.updateSource).toBe('sse');
      expect(broadcastSpy).toHaveBeenCalledWith('88888');
    });

    it('should handle SSE auction closed events', async () => {
      const closeData = {
        auctionId: '88888',
        productId: '12345',
        data: {
          status: 'closed',
          finalBid: 200,
          winner: 'winner123'
        }
      };

      // Add auction to monitor first
      auctionMonitor.monitoredAuctions.set('88888', {
        id: '88888',
        status: 'monitoring'
      });

      const stopPollingSpy = jest.spyOn(auctionMonitor, 'stopPolling');
      const broadcastSpy = jest.spyOn(auctionMonitor, 'broadcastAuctionState');

      await auctionMonitor.handleSSEAuctionClosed(closeData);

      const auction = auctionMonitor.monitoredAuctions.get('88888');
      expect(auction.status).toBe('ended');
      expect(auction.data.finalBid).toBe(200);
      expect(stopPollingSpy).toHaveBeenCalledWith('88888');
      expect(broadcastSpy).toHaveBeenCalledWith('88888');
    });

    it('should handle SSE fallback events', async () => {
      const fallbackData = {
        productId: '12345',
        auctionId: '88888'
      };

      // Add auction to monitor first
      auctionMonitor.monitoredAuctions.set('88888', {
        id: '88888',
        useSSE: true
      });

      const stopPollingSpy = jest.spyOn(auctionMonitor, 'stopPolling');
      const startPollingSpy = jest.spyOn(auctionMonitor, 'startPolling');

      await auctionMonitor.handleSSEFallback(fallbackData);

      expect(stopPollingSpy).toHaveBeenCalledWith('88888');
      expect(startPollingSpy).toHaveBeenCalledWith('88888');

      const auction = auctionMonitor.monitoredAuctions.get('88888');
      expect(auction.useSSE).toBe(false);
      expect(auction.fallbackPolling).toBe(true);
    });
  });

  describe('Hybrid Monitoring', () => {
    it('should support both SSE and polling simultaneously', async () => {
      // Enable SSE
      sseClient.config.enabled = true;

      const connectToAuctionSpy = jest.spyOn(sseClient, 'connectToAuction').mockResolvedValue(true);
      const startPollingSpy = jest.spyOn(auctionMonitor, 'startPolling');

      const auction = {
        id: '88888',
        url: 'https://www.nellisauction.com/p/test/12345',
        title: 'Test Auction'
      };

      await auctionMonitor.startMonitoring('88888', auction);

      // Should connect to SSE
      expect(connectToAuctionSpy).toHaveBeenCalledWith('12345', '88888');

      // Should also start fallback polling with longer interval
      expect(startPollingSpy).toHaveBeenCalledWith('88888', 30000);

      // Should mark as using SSE
      expect(auction.useSSE).toBe(true);
      expect(auction.fallbackPolling).toBe(true);
    });
  });
});