const mockData = require('../__fixtures__/mockData');

class TestUtils {
  static generateId() {
    return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static async waitFor(condition, timeout = 5000, interval = 100) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error('Timeout waiting for condition');
  }

  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static mockWebSocket() {
    return {
      send: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      readyState: 1, // OPEN
      isAlive: true
    };
  }

  static mockRequest(overrides = {}) {
    return {
      headers: {},
      params: {},
      query: {},
      body: {},
      ...overrides
    };
  }

  static mockResponse() {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis()
    };
    return res;
  }

  static createMockAuctionMonitor() {
    return {
      monitoredAuctions: new Map(),
      pollingIntervals: new Map(),
      getMonitoredAuctions: jest.fn().mockReturnValue([]),
      addAuction: jest.fn().mockResolvedValue(true),
      removeAuction: jest.fn().mockResolvedValue(true),
      updateAuctionConfig: jest.fn().mockResolvedValue(true),
      updateAuction: jest.fn().mockResolvedValue(),
      broadcastAuctionState: jest.fn(),
      initialize: jest.fn().mockResolvedValue(),
      shutdown: jest.fn()
    };
  }

  static createMockStorage() {
    return {
      connected: true,
      initialize: jest.fn().mockResolvedValue(),
      isHealthy: jest.fn().mockResolvedValue(true),
      saveAuction: jest.fn().mockResolvedValue(true),
      getAuction: jest.fn().mockResolvedValue(null),
      getAllAuctions: jest.fn().mockResolvedValue([]),
      removeAuction: jest.fn().mockResolvedValue(true),
      saveCookies: jest.fn().mockResolvedValue(true),
      getCookies: jest.fn().mockResolvedValue(null),
      saveBidHistory: jest.fn().mockResolvedValue(true),
      getBidHistory: jest.fn().mockResolvedValue([]),
      saveSystemState: jest.fn().mockResolvedValue(true),
      getSystemState: jest.fn().mockResolvedValue(null),
      close: jest.fn().mockResolvedValue(),
      on: jest.fn(),
      emit: jest.fn()
    };
  }

  static createMockNellisApi() {
    return {
      getAuctionData: jest.fn().mockResolvedValue(mockData.mockAuctionData),
      placeBid: jest.fn().mockResolvedValue({ success: true, data: {} }),
      checkAuth: jest.fn().mockResolvedValue({ authenticated: true, cookieCount: 3 }),
      setCookies: jest.fn()
    };
  }
}

module.exports = TestUtils;