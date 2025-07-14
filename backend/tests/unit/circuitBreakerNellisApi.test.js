/**
 * Unit tests for CircuitBreakerNellisApi
 */

const CircuitBreakerNellisApi = require('../../src/services/classes/CircuitBreakerNellisApi');
const featureFlags = require('../../src/config/features');

// Mock dependencies
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../src/config/features');

describe('CircuitBreakerNellisApi', () => {
  let wrapper;
  let mockNellisApi;
  let mockLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock nellis API
    mockNellisApi = {
      getAuctionData: jest.fn(),
      placeBid: jest.fn(),
      authenticate: jest.fn(),
      checkAuth: jest.fn(),
      initialize: jest.fn(),
      cookies: null
    };

    // Mock logger
    mockLogger = require('../../src/utils/logger');

    // Create wrapper instance
    wrapper = new CircuitBreakerNellisApi(mockNellisApi);

    // Default feature flag behavior (enabled)
    featureFlags.isEnabled.mockReturnValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize and delegate to wrapped API', async () => {
      mockNellisApi.initialize.mockResolvedValue(true);

      const result = await wrapper.initialize();

      expect(result).toBe(true);
      expect(mockNellisApi.initialize).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Circuit breaker initialized for NellisApi');
    });

    it('should start in CLOSED state', () => {
      const status = wrapper.getCircuitBreakerStatus();
      expect(status.state).toBe('closed');
      expect(status.failureCount).toBe(0);
    });
  });

  describe('Feature Flag Integration', () => {
    it('should bypass circuit breaker when feature disabled', async () => {
      featureFlags.isEnabled.mockReturnValue(false);
      mockNellisApi.getAuctionData.mockResolvedValue({ id: '123' });

      const result = await wrapper.getAuctionData('123');

      expect(result).toEqual({ id: '123' });
      expect(mockNellisApi.getAuctionData).toHaveBeenCalledWith('123');

      const status = wrapper.getCircuitBreakerStatus();
      expect(status.enabled).toBe(false);
    });

    it('should use circuit breaker when feature enabled', async () => {
      featureFlags.isEnabled.mockReturnValue(true);
      mockNellisApi.getAuctionData.mockResolvedValue({ id: '123' });

      const result = await wrapper.getAuctionData('123');

      expect(result).toEqual({ id: '123' });

      const status = wrapper.getCircuitBreakerStatus();
      expect(status.enabled).toBe(true);
      expect(status.metrics.totalRequests).toBe(1);
      expect(status.metrics.successfulRequests).toBe(1);
    });
  });

  describe('Circuit States', () => {
    beforeEach(() => {
      // Set low thresholds for testing
      wrapper._config = {
        failureThreshold: 3,
        timeout: 60000,
        halfOpenRetryDelay: 10000,
        successThreshold: 2
      };
    });

    describe('CLOSED State', () => {
      it('should handle successful operations', async () => {
        mockNellisApi.getAuctionData.mockResolvedValue({ id: '123' });

        const result = await wrapper.getAuctionData('123');

        expect(result).toEqual({ id: '123' });

        const status = wrapper.getCircuitBreakerStatus();
        expect(status.state).toBe('closed');
        expect(status.metrics.successfulRequests).toBe(1);
        expect(status.failureCount).toBe(0);
      });

      it('should track failures but stay closed under threshold', async () => {
        mockNellisApi.getAuctionData.mockRejectedValue(new Error('API Error'));

        // First failure
        await expect(wrapper.getAuctionData('123')).rejects.toThrow('API Error');

        let status = wrapper.getCircuitBreakerStatus();
        expect(status.state).toBe('closed');
        expect(status.failureCount).toBe(1);

        // Second failure
        await expect(wrapper.getAuctionData('123')).rejects.toThrow('API Error');

        status = wrapper.getCircuitBreakerStatus();
        expect(status.state).toBe('closed');
        expect(status.failureCount).toBe(2);
      });

      it('should transition to OPEN after reaching failure threshold', async () => {
        mockNellisApi.getAuctionData.mockRejectedValue(new Error('API Error'));

        // Reach failure threshold (3)
        for (let i = 0; i < 3; i++) {
          await expect(wrapper.getAuctionData('123')).rejects.toThrow('API Error');
        }

        const status = wrapper.getCircuitBreakerStatus();
        expect(status.state).toBe('open');
        expect(status.failureCount).toBe(3);
        expect(status.nextAttemptTime).toBeTruthy();
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Circuit breaker opened due to 3 failures')
        );
      });

      it('should reset failure count on successful operation', async () => {
        mockNellisApi.getAuctionData
          .mockRejectedValueOnce(new Error('API Error'))
          .mockRejectedValueOnce(new Error('API Error'))
          .mockResolvedValueOnce({ id: '123' }); // Success resets counter

        // Two failures
        await expect(wrapper.getAuctionData('123')).rejects.toThrow('API Error');
        await expect(wrapper.getAuctionData('123')).rejects.toThrow('API Error');

        // Success
        await wrapper.getAuctionData('123');

        const status = wrapper.getCircuitBreakerStatus();
        expect(status.state).toBe('closed');
        expect(status.failureCount).toBe(0);
      });
    });

    describe('OPEN State', () => {
      beforeEach(async () => {
        // Force circuit to OPEN state
        mockNellisApi.getAuctionData.mockRejectedValue(new Error('API Error'));
        for (let i = 0; i < 3; i++) {
          await expect(wrapper.getAuctionData('123')).rejects.toThrow('API Error');
        }
        expect(wrapper.getCircuitBreakerStatus().state).toBe('open');
      });

      it('should fail fast without calling underlying API', async () => {
        mockNellisApi.getAuctionData.mockClear();

        await expect(wrapper.getAuctionData('123')).rejects.toThrow(
          'Circuit breaker is OPEN for getAuctionData. Failing fast.'
        );

        expect(mockNellisApi.getAuctionData).not.toHaveBeenCalled();

        const status = wrapper.getCircuitBreakerStatus();
        expect(status.metrics.fastFailures).toBe(1);
      });

      it('should transition to HALF_OPEN after timeout', async () => {
        const now = Date.now();
        jest.spyOn(Date, 'now').mockReturnValue(now + 61000); // After timeout

        mockNellisApi.getAuctionData.mockResolvedValue({ id: '123' });

        const result = await wrapper.getAuctionData('123');

        expect(result).toEqual({ id: '123' });
        expect(wrapper.getCircuitBreakerStatus().state).toBe('half_open');
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Circuit breaker transitioned to HALF_OPEN state'
        );

        Date.now.mockRestore();
      });
    });

    describe('HALF_OPEN State', () => {
      beforeEach(async () => {
        // Force to OPEN, then transition to HALF_OPEN
        wrapper.forceOpen();
        jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000);
        mockNellisApi.getAuctionData.mockResolvedValue({ id: '123' });
        await wrapper.getAuctionData('123'); // This should transition to HALF_OPEN
        expect(wrapper.getCircuitBreakerStatus().state).toBe('half_open');
        Date.now.mockRestore();
      });

      it('should track successful operations in half-open state', async () => {
        // Reset to ensure we're in half-open with 1 success
        wrapper._transitionToHalfOpen();
        wrapper._halfOpenSuccesses = 1;

        mockNellisApi.getAuctionData.mockResolvedValue({ id: '456' });

        await wrapper.getAuctionData('456');

        const status = wrapper.getCircuitBreakerStatus();
        expect(status.state).toBe('closed'); // Should transition to closed after 2 successes
        expect(status.metrics.successfulRecoveries).toBe(1);
      });

      it('should transition to CLOSED after enough successes', async () => {
        mockNellisApi.getAuctionData.mockResolvedValue({ id: '456' });

        // One more success should close it (need 2 total, already have 1)
        await wrapper.getAuctionData('456');

        const status = wrapper.getCircuitBreakerStatus();
        expect(status.state).toBe('closed');
        expect(status.failureCount).toBe(0);
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('Circuit breaker recovered and closed')
        );
      });

      it('should transition back to OPEN on failure', async () => {
        mockNellisApi.getAuctionData.mockRejectedValue(new Error('Still failing'));

        await expect(wrapper.getAuctionData('456')).rejects.toThrow('Still failing');

        const status = wrapper.getCircuitBreakerStatus();
        expect(status.state).toBe('open');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Circuit breaker re-opened due to half-open failure')
        );
      });
    });
  });

  describe('All API Methods', () => {
    it('should protect getAuctionData calls', async () => {
      mockNellisApi.getAuctionData.mockResolvedValue({ id: '123' });

      const result = await wrapper.getAuctionData('123');

      expect(result).toEqual({ id: '123' });
      expect(mockNellisApi.getAuctionData).toHaveBeenCalledWith('123');
    });

    it('should protect placeBid calls', async () => {
      mockNellisApi.placeBid.mockResolvedValue({ success: true });

      const result = await wrapper.placeBid('123', 100);

      expect(result).toEqual({ success: true });
      expect(mockNellisApi.placeBid).toHaveBeenCalledWith('123', 100);
    });

    it('should protect authenticate calls', async () => {
      mockNellisApi.authenticate.mockResolvedValue(true);

      const result = await wrapper.authenticate({ cookies: 'test' });

      expect(result).toBe(true);
      expect(mockNellisApi.authenticate).toHaveBeenCalledWith({ cookies: 'test' });
    });

    it('should protect checkAuth calls', async () => {
      mockNellisApi.checkAuth.mockResolvedValue({ authenticated: true });

      const result = await wrapper.checkAuth();

      expect(result).toEqual({ authenticated: true });
      expect(mockNellisApi.checkAuth).toHaveBeenCalled();
    });
  });

  describe('Manual Control', () => {
    it('should allow forcing circuit open', () => {
      wrapper.forceOpen();

      const status = wrapper.getCircuitBreakerStatus();
      expect(status.state).toBe('open');
      expect(mockLogger.warn).toHaveBeenCalledWith('Circuit breaker manually forced to OPEN state');
    });

    it('should allow forcing circuit closed', () => {
      wrapper.forceOpen();
      wrapper.forceClose();

      const status = wrapper.getCircuitBreakerStatus();
      expect(status.state).toBe('closed');
      expect(status.failureCount).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith('Circuit breaker manually forced to CLOSED state');
    });

    it('should reset metrics', () => {
      // Generate some metrics
      wrapper._metrics.totalRequests = 10;
      wrapper._metrics.successfulRequests = 8;
      wrapper._metrics.failedRequests = 2;

      wrapper.resetMetrics();

      const status = wrapper.getCircuitBreakerStatus();
      expect(status.metrics.totalRequests).toBe(0);
      expect(status.metrics.successfulRequests).toBe(0);
      expect(status.metrics.failedRequests).toBe(0);
    });
  });

  describe('Metrics and Status', () => {
    it('should return comprehensive status', async () => {
      mockNellisApi.getAuctionData
        .mockResolvedValueOnce({ id: '1' })
        .mockResolvedValueOnce({ id: '2' })
        .mockRejectedValueOnce(new Error('Error'));

      await wrapper.getAuctionData('1');
      await wrapper.getAuctionData('2');
      await expect(wrapper.getAuctionData('3')).rejects.toThrow('Error');

      const status = wrapper.getCircuitBreakerStatus();

      expect(status.enabled).toBe(true);
      expect(status.state).toBe('closed');
      expect(status.failureCount).toBe(1);
      expect(status.config).toEqual(wrapper._config);
      expect(status.metrics.totalRequests).toBe(3);
      expect(status.metrics.successfulRequests).toBe(2);
      expect(status.metrics.failedRequests).toBe(1);
      expect(status.metrics.successRate).toBe('66.67%');
    });

    it('should format timestamps correctly', async () => {
      // Generate a failure to set lastFailureTime
      mockNellisApi.getAuctionData.mockRejectedValue(new Error('Test error'));
      await expect(wrapper.getAuctionData('123')).rejects.toThrow('Test error');

      wrapper.forceOpen();

      const status = wrapper.getCircuitBreakerStatus();
      expect(status.lastFailureTime).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(status.nextAttemptTime).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Property Delegation', () => {
    it('should delegate cookies getter/setter', () => {
      wrapper.cookies = 'test-cookies';
      expect(mockNellisApi.cookies).toBe('test-cookies');

      mockNellisApi.cookies = 'updated-cookies';
      expect(wrapper.cookies).toBe('updated-cookies');
    });
  });

  describe('Static Factory', () => {
    it('should create wrapper instance via static method', () => {
      const wrapped = CircuitBreakerNellisApi.wrap(mockNellisApi);

      expect(wrapped).toBeInstanceOf(CircuitBreakerNellisApi);
      expect(wrapped._nellisApi).toBe(mockNellisApi);
    });
  });

  describe('Error Context', () => {
    it('should include operation context in circuit breaker errors', async () => {
      wrapper.forceOpen();

      try {
        await wrapper.getAuctionData('123');
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error.message).toContain('Circuit breaker is OPEN for getAuctionData');
        expect(error.circuitBreakerState).toBe('open');
        expect(error.nextAttemptTime).toBeTruthy();
      }
    });
  });
});