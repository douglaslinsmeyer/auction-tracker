const { mockAuction, mockAuctionData, mockOutbidResponse } = require('../__fixtures__/mockData');

// Mock dependencies before requiring the module
jest.mock('../../src/services/nellisApi');
jest.mock('../../src/services/storage');
jest.mock('ws');

describe('Auction Monitor Integration Tests', () => {
  let auctionMonitor;
  let nellisApi;
  let storage;
  let mockWss;

  beforeAll(() => {
    // Use fake timers to control polling
    jest.useFakeTimers();
    // Import mocked modules
    storage = require('../../src/services/storage');
    nellisApi = require('../../src/services/nellisApi');
    
    // Setup storage mocks BEFORE importing auctionMonitor
    storage.initialize = jest.fn().mockResolvedValue();
    storage.saveAuction = jest.fn().mockResolvedValue(true);
    storage.removeAuction = jest.fn().mockResolvedValue(true);
    storage.getAllAuctions = jest.fn().mockResolvedValue([]);
    storage.saveBidHistory = jest.fn().mockResolvedValue(true);
    storage.isHealthy = jest.fn().mockResolvedValue(true);
    storage.getSettings = jest.fn().mockResolvedValue({
      general: {
        defaultMaxBid: 100,
        defaultStrategy: 'increment',
        autoBidDefault: true
      },
      bidding: {
        snipeTiming: 30,
        bidBuffer: 0,
        retryAttempts: 3
      }
    });
    storage.connected = true;
    
    // Setup nellisApi mocks
    nellisApi.getAuctionData = jest.fn().mockResolvedValue(mockAuctionData);
    nellisApi.placeBid = jest.fn().mockResolvedValue({ success: true });
    
    // Now import auctionMonitor after mocks are set
    auctionMonitor = require('../../src/services/auctionMonitor');
    
    // Create mock WebSocket server
    mockWss = {
      clients: new Set(),
      send: jest.fn()
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
    auctionMonitor.monitoredAuctions.clear();
    auctionMonitor.pollingIntervals.clear();
    // Clear any timers to prevent polling during tests
    jest.clearAllTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with storage', async () => {
      await auctionMonitor.initialize(mockWss);
      
      expect(storage.initialize).toHaveBeenCalled();
      expect(auctionMonitor.wss).toBe(mockWss);
      expect(auctionMonitor.storageInitialized).toBe(true);
    });

    it('should recover persisted auctions on startup', async () => {
      const persistedAuction = {
        ...mockAuction,
        status: 'monitoring',
        data: mockAuctionData
      };
      
      storage.getAllAuctions.mockResolvedValue([persistedAuction]);
      
      await auctionMonitor.initialize(mockWss);
      
      expect(auctionMonitor.monitoredAuctions.has(mockAuction.id)).toBe(true);
      expect(auctionMonitor.pollingIntervals.has(mockAuction.id)).toBe(true);
    });

    it('should not recover ended auctions', async () => {
      const endedAuction = {
        ...mockAuction,
        status: 'ended'
      };
      
      storage.getAllAuctions.mockResolvedValue([endedAuction]);
      
      await auctionMonitor.initialize(mockWss);
      
      expect(auctionMonitor.monitoredAuctions.has(mockAuction.id)).toBe(false);
    });
  });

  describe('Auction Management', () => {
    beforeEach(async () => {
      await auctionMonitor.initialize(mockWss);
    });

    it('should add new auction and start polling', async () => {
      const result = await auctionMonitor.addAuction(
        mockAuction.id,
        mockAuction.config,
        { title: mockAuction.title }
      );
      
      expect(result).toBe(true);
      expect(auctionMonitor.monitoredAuctions.has(mockAuction.id)).toBe(true);
      expect(storage.saveAuction).toHaveBeenCalled();
      
      // Check if polling started
      expect(auctionMonitor.pollingIntervals.has(mockAuction.id)).toBe(true);
    });

    it('should not add duplicate auction', async () => {
      await auctionMonitor.addAuction(mockAuction.id);
      
      // Clear the mock to only count the second call
      storage.saveAuction.mockClear();
      
      const result = await auctionMonitor.addAuction(mockAuction.id);
      
      expect(result).toBe(false);
      expect(storage.saveAuction).not.toHaveBeenCalled();
    });

    it('should remove auction and stop polling', async () => {
      await auctionMonitor.addAuction(mockAuction.id);
      
      const result = await auctionMonitor.removeAuction(mockAuction.id);
      
      expect(result).toBe(true);
      expect(auctionMonitor.monitoredAuctions.has(mockAuction.id)).toBe(false);
      expect(auctionMonitor.pollingIntervals.has(mockAuction.id)).toBe(false);
      expect(storage.removeAuction).toHaveBeenCalledWith(mockAuction.id);
    });

    it('should update auction configuration', async () => {
      await auctionMonitor.addAuction(mockAuction.id, mockAuction.config);
      
      const newConfig = { maxBid: 200 };
      const result = await auctionMonitor.updateAuctionConfig(mockAuction.id, newConfig);
      
      expect(result).toBe(true);
      
      const auction = auctionMonitor.monitoredAuctions.get(mockAuction.id);
      expect(auction.config.maxBid).toBe(200);
      expect(storage.saveAuction).toHaveBeenCalled();
    });
  });

  describe('Auction Updates and Polling', () => {
    beforeEach(async () => {
      await auctionMonitor.initialize(mockWss);
      nellisApi.getAuctionData = jest.fn().mockResolvedValue(mockAuctionData);
    });

    it('should update auction data on poll', async () => {
      await auctionMonitor.addAuction(mockAuction.id);
      
      // Clear initial call
      storage.saveAuction.mockClear();
      
      // Trigger update
      await auctionMonitor.updateAuction(mockAuction.id);
      
      const auction = auctionMonitor.monitoredAuctions.get(mockAuction.id);
      expect(auction.data).toEqual(mockAuctionData);
      expect(storage.saveAuction).toHaveBeenCalledWith(mockAuction.id, auction);
    });

    it('should handle auction ending', async () => {
      await auctionMonitor.addAuction(mockAuction.id);
      
      // Mock ended auction
      const endedData = { ...mockAuctionData, isClosed: true, timeRemaining: 0 };
      nellisApi.getAuctionData.mockResolvedValue(endedData);
      
      await auctionMonitor.updateAuction(mockAuction.id);
      
      const auction = auctionMonitor.monitoredAuctions.get(mockAuction.id);
      expect(auction.status).toBe('ended');
      expect(auctionMonitor.pollingIntervals.has(mockAuction.id)).toBe(false);
    });

    it('should adjust polling rate for auctions ending soon', async () => {
      await auctionMonitor.addAuction(mockAuction.id);
      
      // Mock auction with 25 seconds left
      const urgentData = { ...mockAuctionData, timeRemaining: 25 };
      nellisApi.getAuctionData.mockResolvedValue(urgentData);
      
      const adjustSpy = jest.spyOn(auctionMonitor, 'adjustPollingRate');
      
      await auctionMonitor.updateAuction(mockAuction.id);
      
      expect(adjustSpy).toHaveBeenCalledWith(mockAuction.id, 2000);
    });
  });

  describe('Auto-Bidding Logic', () => {
    beforeEach(async () => {
      await auctionMonitor.initialize(mockWss);
      nellisApi.placeBid = jest.fn();
    });

    it('should not auto-bid with manual strategy', async () => {
      await auctionMonitor.addAuction(mockAuction.id, {
        ...mockAuction.config,
        strategy: 'manual'
      });
      
      const auctionData = { ...mockAuctionData, isWinning: false };
      await auctionMonitor.executeAutoBid(mockAuction.id, auctionData);
      
      expect(nellisApi.placeBid).not.toHaveBeenCalled();
    });

    it('should auto-bid with increment strategy', async () => {
      await auctionMonitor.addAuction(mockAuction.id, {
        maxBid: 100,
        strategy: 'increment',
        bidIncrement: 5
      });
      
      nellisApi.placeBid.mockResolvedValue({ success: true, data: {} });
      
      const auctionData = { ...mockAuctionData, isWinning: false, nextBid: 35 };
      await auctionMonitor.executeAutoBid(mockAuction.id, auctionData);
      
      expect(nellisApi.placeBid).toHaveBeenCalledWith(mockAuction.id, 35);
      expect(storage.saveBidHistory).toHaveBeenCalled();
    });

    it('should not bid above max bid', async () => {
      await auctionMonitor.addAuction(mockAuction.id, {
        maxBid: 30,
        strategy: 'increment',
        autoBid: false  // Disable auto-bidding to prevent polling bids
      });
      
      // Clear any polling-triggered calls
      jest.clearAllMocks();
      
      const auctionData = { ...mockAuctionData, isWinning: false, nextBid: 35 };
      await auctionMonitor.executeAutoBid(mockAuction.id, auctionData);
      
      expect(nellisApi.placeBid).not.toHaveBeenCalled();
      
      const auction = auctionMonitor.monitoredAuctions.get(mockAuction.id);
      expect(auction.maxBidReached).toBe(true);
    });

    it('should handle sniping strategy (only bid in last 30s)', async () => {
      await auctionMonitor.addAuction(mockAuction.id, {
        maxBid: 100,
        strategy: 'sniping',
        autoBid: false  // Disable auto-bidding to prevent polling bids
      });
      
      // Clear any polling-triggered calls
      jest.clearAllMocks();
      
      // More than 30 seconds left
      const auctionData = { ...mockAuctionData, timeRemaining: 60, nextBid: 35 };
      await auctionMonitor.executeAutoBid(mockAuction.id, auctionData);
      
      expect(nellisApi.placeBid).not.toHaveBeenCalled();
      
      // Less than 30 seconds left
      const urgentData = { ...mockAuctionData, timeRemaining: 25, nextBid: 35 };
      await auctionMonitor.executeAutoBid(mockAuction.id, urgentData);
      
      expect(nellisApi.placeBid).toHaveBeenCalledWith(mockAuction.id, 35);
    });

    it('should handle outbid response and retry', async () => {
      await auctionMonitor.addAuction(mockAuction.id, {
        maxBid: 100,
        strategy: 'increment'
      });
      
      nellisApi.placeBid.mockResolvedValue(mockOutbidResponse);
      
      const auctionData = { ...mockAuctionData, nextBid: 35 };
      await auctionMonitor.executeAutoBid(mockAuction.id, auctionData);
      
      expect(nellisApi.placeBid).toHaveBeenCalledWith(mockAuction.id, 35);
      
      // Should update auction data with response
      expect(auctionData.currentBid).toBe(35);
      expect(auctionData.nextBid).toBe(40);
    });

    it('should save failed bid attempts', async () => {
      await auctionMonitor.addAuction(mockAuction.id, {
        maxBid: 100,
        strategy: 'increment'
      });
      
      const error = 'Bid rejected';
      nellisApi.placeBid.mockResolvedValue({ success: false, error });
      
      const auctionData = { ...mockAuctionData, nextBid: 35 };
      await auctionMonitor.executeAutoBid(mockAuction.id, auctionData);
      
      expect(storage.saveBidHistory).toHaveBeenCalledWith(
        mockAuction.id,
        expect.objectContaining({
          success: false,
          error
        })
      );
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await auctionMonitor.initialize(mockWss);
    });

    it('should emit outbid event', async () => {
      const outbidHandler = jest.fn();
      auctionMonitor.on('outbid', outbidHandler);
      
      await auctionMonitor.addAuction(mockAuction.id);
      
      // Simulate being outbid
      const oldData = { ...mockAuctionData, isWinning: true };
      const newData = { ...mockAuctionData, isWinning: false, currentBid: 40 };
      
      auctionMonitor.handleBidUpdate(mockAuction.id, newData, oldData);
      
      expect(outbidHandler).toHaveBeenCalledWith({
        auctionId: mockAuction.id,
        currentBid: 40
      });
    });

    it('should emit auctionEnded event', async () => {
      const endHandler = jest.fn();
      auctionMonitor.on('auctionEnded', endHandler);
      
      await auctionMonitor.addAuction(mockAuction.id);
      
      const endedData = { ...mockAuctionData, currentBid: 50, isWinning: true };
      auctionMonitor.handleAuctionEnd(mockAuction.id, endedData);
      
      expect(endHandler).toHaveBeenCalledWith({
        auctionId: mockAuction.id,
        finalPrice: 50,
        won: true
      });
    });

    it('should emit bidPlaced event', async () => {
      const bidHandler = jest.fn();
      auctionMonitor.on('bidPlaced', bidHandler);
      
      await auctionMonitor.addAuction(mockAuction.id, {
        maxBid: 100,
        strategy: 'increment'
      });
      
      nellisApi.placeBid.mockResolvedValue({ 
        success: true, 
        data: { message: 'Bid placed' } 
      });
      
      const auctionData = { ...mockAuctionData, nextBid: 35 };
      await auctionMonitor.executeAutoBid(mockAuction.id, auctionData);
      
      expect(bidHandler).toHaveBeenCalledWith({
        auctionId: mockAuction.id,
        amount: 35,
        result: { message: 'Bid placed' }
      });
    });
  });

  describe('Cleanup', () => {
    it('should clean up on shutdown', async () => {
      await auctionMonitor.initialize(mockWss);
      await auctionMonitor.addAuction('123');
      await auctionMonitor.addAuction('456');
      
      auctionMonitor.shutdown();
      
      expect(auctionMonitor.monitoredAuctions.size).toBe(0);
      expect(auctionMonitor.pollingIntervals.size).toBe(0);
    });
  });
});