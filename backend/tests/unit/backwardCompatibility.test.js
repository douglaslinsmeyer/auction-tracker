/**
 * Backward Compatibility Tests
 * Ensures that existing code continues to work with new architecture
 */

const sinon = require('sinon');

describe('Backward Compatibility', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('Service Singleton Exports', () => {
    it('should export singleton instances directly', () => {
      const services = require('../../src/services');
      
      // Check singleton exports
      expect(services.auctionMonitor).toBeDefined();
      expect(services.nellisApi).toBeDefined();
      expect(services.storage).toBeDefined();
      expect(services.wsHandler).toBeDefined();
      
      // Verify they have expected methods
      expect(typeof services.auctionMonitor.addAuction).toBe('function');
      expect(typeof services.nellisApi.getAuctionData).toBe('function');
      expect(typeof services.storage.saveAuction).toBe('function');
      expect(typeof services.wsHandler.handleConnection).toBe('function');
    });

    it('should maintain singleton behavior', () => {
      const services1 = require('../../src/services');
      const services2 = require('../../src/services');
      
      // Same instances
      expect(services1.auctionMonitor).toBe(services2.auctionMonitor);
      expect(services1.nellisApi).toBe(services2.nellisApi);
      expect(services1.storage).toBe(services2.storage);
      expect(services1.wsHandler).toBe(services2.wsHandler);
    });
  });

  describe('Direct Service Imports', () => {
    it('should allow direct import of singletons', () => {
      const auctionMonitor = require('../../src/services/auctionMonitor');
      const nellisApi = require('../../src/services/nellisApi');
      const storage = require('../../src/services/storage');
      const wsHandler = require('../../src/services/websocket');
      
      expect(auctionMonitor).toBeDefined();
      expect(nellisApi).toBeDefined();
      expect(storage).toBeDefined();
      expect(wsHandler).toBeDefined();
    });
  });

  describe('Class-based Exports', () => {
    it('should export class constructors', () => {
      const services = require('../../src/services');
      
      expect(typeof services.AuctionMonitorClass).toBe('function');
      expect(typeof services.NellisApiClass).toBe('function');
      expect(typeof services.StorageClass).toBe('function');
      expect(typeof services.WebSocketHandlerClass).toBe('function');
    });

    it('should create new instances from classes', () => {
      const services = require('../../src/services');
      
      const monitor1 = new services.AuctionMonitorClass();
      const monitor2 = new services.AuctionMonitorClass();
      
      // Different instances but same underlying singleton (for now)
      expect(monitor1).not.toBe(monitor2);
      expect(monitor1._singleton).toBe(monitor2._singleton);
    });
  });

  describe('API Compatibility', () => {
    it('should maintain existing method signatures for auctionMonitor', async () => {
      const { auctionMonitor } = require('../../src/services');
      
      // Test method existence and signatures
      expect(typeof auctionMonitor.addAuction).toBe('function');
      expect(auctionMonitor.addAuction.length).toBe(1); // Only auctionId is required (others have defaults)
      
      expect(typeof auctionMonitor.removeAuction).toBe('function');
      expect(auctionMonitor.removeAuction.length).toBe(1); // auctionId
      
      expect(typeof auctionMonitor.getMonitoredAuctions).toBe('function');
      expect(auctionMonitor.getMonitoredAuctions.length).toBe(0);
    });

    it('should maintain existing method signatures for nellisApi', () => {
      const { nellisApi } = require('../../src/services');
      
      expect(typeof nellisApi.getAuctionData).toBe('function');
      expect(nellisApi.getAuctionData.length).toBe(1); // auctionId
      
      expect(typeof nellisApi.placeBid).toBe('function');
      expect(nellisApi.placeBid.length).toBe(2); // auctionId, amount
      
      expect(typeof nellisApi.setCookies).toBe('function');
      expect(nellisApi.setCookies.length).toBe(1); // cookies
    });
  });

  describe('Chrome Extension Compatibility', () => {
    it('should work with Chrome extension import pattern', () => {
      // Simulate Chrome extension import
      const auctionMonitor = require('../../src/services/auctionMonitor');
      
      // Should be able to call methods directly
      expect(() => {
        auctionMonitor.getMonitoredAuctions();
        auctionMonitor.getMonitoredCount();
      }).not.toThrow();
    });

    it('should work with destructured imports', () => {
      // Common Chrome extension pattern
      const { auctionMonitor, nellisApi } = require('../../src/services');
      
      expect(auctionMonitor).toBeDefined();
      expect(nellisApi).toBeDefined();
      expect(auctionMonitor.monitoredAuctions).toBeInstanceOf(Map);
    });
  });

  describe('Container Integration', () => {
    it('should work with dependency injection container', () => {
      const { container } = require('../../src/container/serviceRegistration');
      
      const monitor = container.get('auctionMonitor');
      const api = container.get('nellisApi');
      
      expect(monitor).toBeDefined();
      expect(api).toBeDefined();
      
      // Should be same as singletons
      const { auctionMonitor, nellisApi } = require('../../src/services');
      expect(monitor).toBe(auctionMonitor);
      expect(api).toBe(nellisApi);
    });
  });
});