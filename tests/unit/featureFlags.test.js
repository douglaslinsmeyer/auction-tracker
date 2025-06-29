/**
 * Feature Flag System Tests
 */

const { FeatureFlags, FEATURE_FLAGS } = require('../../src/config/features');

describe('Feature Flags', () => {
  let featureFlags;

  beforeEach(() => {
    // Clear any environment variables
    for (const config of Object.values(FEATURE_FLAGS)) {
      delete process.env[config.name];
    }
    // Create fresh instance
    featureFlags = new FeatureFlags();
  });

  describe('Initialization', () => {
    it('should use default values when no environment variables set', async () => {
      await featureFlags.initialize();
      
      expect(featureFlags.isEnabled('USE_POLLING_QUEUE')).toBe(false);
      expect(featureFlags.isEnabled('USE_CIRCUIT_BREAKER')).toBe(false);
      expect(featureFlags.isEnabled('USE_STATE_MACHINE')).toBe(false);
    });

    it('should read from environment variables', async () => {
      process.env.USE_POLLING_QUEUE = 'true';
      process.env.USE_CIRCUIT_BREAKER = 'false';
      
      await featureFlags.initialize();
      
      expect(featureFlags.isEnabled('USE_POLLING_QUEUE')).toBe(true);
      expect(featureFlags.isEnabled('USE_CIRCUIT_BREAKER')).toBe(false);
    });

    it('should handle initialization without Redis', async () => {
      await featureFlags.initialize(null);
      expect(featureFlags.initialized).toBe(true);
    });
  });

  describe('Feature Checking', () => {
    beforeEach(async () => {
      await featureFlags.initialize();
    });

    it('should return false for unknown features', () => {
      expect(featureFlags.isEnabled('UNKNOWN_FEATURE')).toBe(false);
    });

    it('should return default when not initialized', () => {
      const newFlags = new FeatureFlags();
      expect(newFlags.isEnabled('USE_POLLING_QUEUE')).toBe(false);
    });
  });

  describe('Manual Control', () => {
    beforeEach(async () => {
      await featureFlags.initialize();
    });

    it('should allow enabling features programmatically', () => {
      expect(featureFlags.isEnabled('USE_POLLING_QUEUE')).toBe(false);
      
      featureFlags.enable('USE_POLLING_QUEUE');
      
      expect(featureFlags.isEnabled('USE_POLLING_QUEUE')).toBe(true);
    });

    it('should allow disabling features programmatically', () => {
      featureFlags.enable('USE_CIRCUIT_BREAKER');
      expect(featureFlags.isEnabled('USE_CIRCUIT_BREAKER')).toBe(true);
      
      featureFlags.disable('USE_CIRCUIT_BREAKER');
      
      expect(featureFlags.isEnabled('USE_CIRCUIT_BREAKER')).toBe(false);
    });

    it('should ignore unknown features', () => {
      featureFlags.enable('UNKNOWN_FEATURE');
      expect(featureFlags.isEnabled('UNKNOWN_FEATURE')).toBe(false);
    });
  });

  describe('Status Reporting', () => {
    beforeEach(async () => {
      process.env.USE_POLLING_QUEUE = 'true';
      await featureFlags.initialize();
    });

    it('should return complete status', () => {
      const status = featureFlags.getStatus();
      
      expect(status.USE_POLLING_QUEUE).toMatchObject({
        name: 'USE_POLLING_QUEUE',
        description: 'Use priority-based polling queue instead of individual timers',
        enabled: true,
        phase: 3
      });
      
      expect(status.USE_CIRCUIT_BREAKER).toMatchObject({
        name: 'USE_CIRCUIT_BREAKER',
        enabled: false,
        phase: 3
      });
    });
  });

  describe('Reset', () => {
    it('should reset all flags to defaults', async () => {
      await featureFlags.initialize();
      
      featureFlags.enable('USE_POLLING_QUEUE');
      featureFlags.enable('USE_CIRCUIT_BREAKER');
      
      featureFlags.reset();
      
      expect(featureFlags.isEnabled('USE_POLLING_QUEUE')).toBe(false);
      expect(featureFlags.isEnabled('USE_CIRCUIT_BREAKER')).toBe(false);
    });
  });

  describe('Redis Integration', () => {
    let mockRedis;

    beforeEach(() => {
      mockRedis = {
        connected: true,
        get: jest.fn(),
        set: jest.fn()
      };
    });

    it('should load flags from Redis when available', async () => {
      mockRedis.get.mockImplementation((key) => {
        if (key === 'feature:use_polling_queue') return Promise.resolve('true');
        return Promise.resolve(null);
      });
      
      await featureFlags.initialize(mockRedis);
      
      expect(featureFlags.isEnabled('USE_POLLING_QUEUE')).toBe(true);
      expect(mockRedis.get).toHaveBeenCalledWith('feature:use_polling_queue');
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));
      
      await featureFlags.initialize(mockRedis);
      
      // Should fall back to defaults
      expect(featureFlags.isEnabled('USE_POLLING_QUEUE')).toBe(false);
    });

    it('should update flags in Redis', async () => {
      await featureFlags.initialize(mockRedis);
      
      await featureFlags.updateInRedis('USE_CIRCUIT_BREAKER', true);
      
      expect(mockRedis.set).toHaveBeenCalledWith('feature:use_circuit_breaker', 'true');
      expect(featureFlags.isEnabled('USE_CIRCUIT_BREAKER')).toBe(true);
    });

    it('should throw error when Redis not available for updates', async () => {
      await featureFlags.initialize(null);
      
      await expect(
        featureFlags.updateInRedis('USE_CIRCUIT_BREAKER', true)
      ).rejects.toThrow('Redis not available');
    });
  });
});