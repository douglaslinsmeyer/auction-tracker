const EventEmitter = require('events');

// Mock EventSource
const mockEventSources = [];
const MockEventSource = jest.fn().mockImplementation((url, options) => {
  const eventSource = new EventEmitter();
  eventSource.url = url;
  eventSource.options = options;
  eventSource.readyState = 1; // OPEN
  eventSource.close = jest.fn(() => {
    eventSource.readyState = 2; // CLOSED
  });
  eventSource.addEventListener = jest.fn((event, handler) => {
    eventSource.on(event, handler);
  });
  
  mockEventSources.push(eventSource);
  return eventSource;
});

jest.mock('eventsource', () => ({
  EventSource: MockEventSource
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

// Mock features with proper implementation
const mockFeatures = {
  isEnabled: jest.fn((feature) => feature === 'USE_SSE'),
  initialized: true,
  flags: { USE_SSE: true }
};
jest.mock('../../src/config/features', () => mockFeatures);

// Mock storage
jest.mock('../../src/services/storage', () => ({
  saveAuction: jest.fn().mockResolvedValue(true),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true)
}));

// Mock auctionMonitor  
jest.mock('../../src/services/auctionMonitor', () => {
  const mockEvents = require('events');
  return new mockEvents.EventEmitter();
});

describe('SSEClient', () => {
  let sseClient;
  let mockEventEmitter;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockEventSources.length = 0;
    
    // Reset feature mocks to default (SSE enabled)
    mockFeatures.isEnabled.mockImplementation((feature) => feature === 'USE_SSE');
    mockFeatures.flags.USE_SSE = true;
    
    // Create mock event emitter
    mockEventEmitter = new EventEmitter();
    
    // Clear require cache to get fresh instance
    delete require.cache[require.resolve('../../src/services/sseClient')];
    sseClient = require('../../src/services/sseClient');
    
    // Set event emitter for tests
    sseClient.eventEmitter = mockEventEmitter;
  });
  
  afterEach(() => {
    if (sseClient && typeof sseClient.disconnectAll === 'function') {
      sseClient.disconnectAll();
    }
  });
  
  describe('initialize', () => {
    it('should initialize when SSE is enabled', async () => {
      await sseClient.initialize();
      
      expect(sseClient.initialized).toBe(true);
      expect(sseClient.config.enabled).toBe(true);
    });
    
    it('should handle disabled SSE gracefully', async () => {
      // Mock features to return false for SSE
      mockFeatures.isEnabled.mockReturnValue(false);
      mockFeatures.flags.USE_SSE = false;
      
      // Get fresh instance with disabled SSE
      delete require.cache[require.resolve('../../src/services/sseClient')];
      const disabledClient = require('../../src/services/sseClient');
      disabledClient.eventEmitter = mockEventEmitter;
      
      await disabledClient.initialize();
      
      expect(disabledClient.initialized).toBe(true);
      expect(disabledClient.config.enabled).toBe(false);
    });
  });
  
  describe('connectToAuction', () => {
    beforeEach(async () => {
      await sseClient.initialize();
    });
    
    it('should establish SSE connection for a product', async () => {
      const productId = '12345';
      const auctionId = 'auction_123';
      
      const result = await sseClient.connectToAuction(productId, auctionId);
      
      expect(result).toBe(true);
      expect(sseClient.connections.has(productId)).toBe(true);
      expect(MockEventSource).toHaveBeenCalledWith(
        'https://sse.nellisauction.com/live-products?productId=12345',
        expect.any(Object)
      );
    });
    
    it('should not create duplicate connections', async () => {
      const productId = '12345';
      const auctionId = 'auction_123';
      
      const result1 = await sseClient.connectToAuction(productId, auctionId);
      const result2 = await sseClient.connectToAuction(productId, auctionId);
      
      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(MockEventSource).toHaveBeenCalledTimes(1);
    });
    
    it('should return false when SSE is disabled', async () => {
      sseClient.config.enabled = false;
      
      const result = await sseClient.connectToAuction('12345', 'auction_123');
      
      expect(result).toBe(false);
      expect(sseClient.connections.size).toBe(0);
    });
  });
  
  describe('handleBidUpdate', () => {
    beforeEach(async () => {
      await sseClient.initialize();
    });
    
    it('should handle bid update events', async () => {
      const productId = '12345';
      const auctionId = 'auction_123';
      const bidData = {
        currentBid: 150,
        bidCount: 5,
        lastBidder: 'user123'
      };
      
      const emitSpy = jest.spyOn(mockEventEmitter, 'emit');
      await sseClient.handleBidUpdate(productId, auctionId, bidData);
      
      expect(emitSpy).toHaveBeenCalledWith('auction:update', expect.objectContaining({
        auctionId,
        productId,
        data: expect.objectContaining({
          currentBid: 150,
          bidCount: 5,
          lastBidder: 'user123',
          updateSource: 'sse'
        })
      }));
    });
    
    it('should emit auction update event', async () => {
      const productId = '12345';
      const auctionId = 'auction_123';
      const bidData = { currentBid: 150 };
      
      const emitSpy = jest.spyOn(mockEventEmitter, 'emit');
      
      await sseClient.handleBidUpdate(productId, auctionId, bidData);
      
      expect(emitSpy).toHaveBeenCalledWith('auction:update', {
        auctionId,
        productId,
        type: 'bid',
        data: expect.objectContaining({
          currentBid: 150,
          updateSource: 'sse'
        }),
        source: 'sse',
        timestamp: expect.any(String)
      });
    });
  });
  
  describe('handleAuctionClosed', () => {
    beforeEach(async () => {
      await sseClient.initialize();
    });
    
    it('should handle auction closed events', async () => {
      const productId = '12345';
      const auctionId = 'auction_123';
      const closeData = {
        finalBid: 200,
        winner: 'winner123'
      };
      
      // First connect
      await sseClient.connectToAuction(productId, auctionId);
      
      const emitSpy = jest.spyOn(mockEventEmitter, 'emit');
      await sseClient.handleAuctionClosed(productId, auctionId, closeData);
      
      expect(emitSpy).toHaveBeenCalledWith('auction:closed', expect.objectContaining({
        auctionId,
        productId,
        data: expect.objectContaining({
          status: 'closed',
          finalBid: 200,
          winner: 'winner123',
          updateSource: 'sse'
        })
      }));
      
      // Should disconnect
      expect(sseClient.connections.has(productId)).toBe(false);
    });
    
    it('should emit auction closed event', async () => {
      const productId = '12345';
      const auctionId = 'auction_123';
      const closeData = { finalBid: 200 };
      
      const emitSpy = jest.spyOn(mockEventEmitter, 'emit');
      
      await sseClient.handleAuctionClosed(productId, auctionId, closeData);
      
      expect(emitSpy).toHaveBeenCalledWith('auction:closed', {
        auctionId,
        productId,
        data: expect.objectContaining({
          status: 'closed',
          finalBid: 200,
          updateSource: 'sse'
        }),
        source: 'sse',
        timestamp: expect.any(String)
      });
    });
  });
  
  describe('disconnect', () => {
    beforeEach(async () => {
      await sseClient.initialize();
    });
    
    it('should disconnect specific product', async () => {
      const productId = '12345';
      const auctionId = 'auction_123';
      
      await sseClient.connectToAuction(productId, auctionId);
      expect(sseClient.connections.has(productId)).toBe(true);
      
      sseClient.disconnect(productId);
      
      expect(sseClient.connections.has(productId)).toBe(false);
      expect(mockEventSources[0].close).toHaveBeenCalled();
    });
    
    it('should handle disconnect for non-existent product gracefully', () => {
      expect(() => {
        sseClient.disconnect('nonexistent');
      }).not.toThrow();
    });
  });
  
  describe('disconnectAll', () => {
    beforeEach(async () => {
      await sseClient.initialize();
    });
    
    it('should disconnect all connections', async () => {
      await sseClient.connectToAuction('123', 'auction_123');
      await sseClient.connectToAuction('456', 'auction_456');
      
      expect(sseClient.connections.size).toBe(2);
      
      sseClient.disconnectAll();
      
      expect(sseClient.connections.size).toBe(0);
      expect(mockEventSources[0].close).toHaveBeenCalled();
      expect(mockEventSources[1].close).toHaveBeenCalled();
    });
  });
  
  describe('getConnectionStatus', () => {
    beforeEach(async () => {
      await sseClient.initialize();
    });
    
    it('should return connection status', async () => {
      await sseClient.connectToAuction('123', 'auction_123');
      
      const status = sseClient.getConnectionStatus();
      
      expect(status).toEqual({
        enabled: true,
        totalConnections: 1,
        connections: [{
          productId: '123',
          readyState: 1,
          sessionId: undefined,
          reconnectAttempts: 0
        }]
      });
    });
    
    it('should return empty status when no connections', () => {
      const status = sseClient.getConnectionStatus();
      
      expect(status).toEqual({
        enabled: true,
        totalConnections: 0,
        connections: []
      });
    });
  });
  
  describe('handleReconnection', () => {
    beforeEach(async () => {
      await sseClient.initialize();
    });
    
    it('should emit fallback event after max attempts', async () => {
      const productId = '12345';
      const auctionId = 'auction_123';
      
      // Set max attempts to 1 for quick testing
      sseClient.config.maxReconnectAttempts = 1;
      sseClient.reconnectAttempts.set(productId, 1);
      
      const emitSpy = jest.spyOn(mockEventEmitter, 'emit');
      
      await sseClient.handleReconnection(productId, auctionId);
      
      expect(emitSpy).toHaveBeenCalledWith('sse:fallback', { productId, auctionId });
    });
  });
});