/**
 * CircuitBreakerNellisApi
 * Wraps NellisApi with circuit breaker pattern for improved fault tolerance
 */

const logger = require('../../utils/logger');
const featureFlags = require('../../config/features');

/**
 * Circuit states
 */
const CIRCUIT_STATES = {
  CLOSED: 'closed',       // Normal operation
  OPEN: 'open',          // Failing fast
  HALF_OPEN: 'half_open' // Testing if service recovered
};

/**
 * CircuitBreakerNellisApi - Enhances NellisApi with circuit breaker pattern
 */
class CircuitBreakerNellisApi {
  constructor(nellisApi) {
    this._nellisApi = nellisApi;
    
    // Circuit breaker state
    this._state = CIRCUIT_STATES.CLOSED;
    this._failureCount = 0;
    this._lastFailureTime = null;
    this._nextAttemptTime = null;
    
    // Configuration
    this._config = {
      failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD) || 5,
      timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT) || 60000, // 1 minute
      halfOpenRetryDelay: parseInt(process.env.CIRCUIT_BREAKER_RETRY_DELAY) || 10000, // 10 seconds
      successThreshold: parseInt(process.env.CIRCUIT_BREAKER_SUCCESS_THRESHOLD) || 3
    };
    
    // Metrics
    this._metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      circuitOpened: 0,
      fastFailures: 0,
      halfOpenAttempts: 0,
      successfulRecoveries: 0
    };
    
    // Track consecutive successes in half-open state
    this._halfOpenSuccesses = 0;
  }

  /**
   * Initialize with circuit breaker support
   */
  async initialize() {
    if (this._isEnabled()) {
      logger.info('Circuit breaker initialized for NellisApi');
    }
    return this._nellisApi.initialize();
  }

  /**
   * Get auction data with circuit breaker protection
   */
  async getAuctionData(auctionId) {
    if (!this._isEnabled()) {
      return this._nellisApi.getAuctionData(auctionId);
    }
    
    return this._executeWithCircuitBreaker(
      'getAuctionData',
      () => this._nellisApi.getAuctionData(auctionId),
      auctionId
    );
  }

  /**
   * Place bid with circuit breaker protection
   */
  async placeBid(auctionId, amount) {
    if (!this._isEnabled()) {
      return this._nellisApi.placeBid(auctionId, amount);
    }
    
    return this._executeWithCircuitBreaker(
      'placeBid',
      () => this._nellisApi.placeBid(auctionId, amount),
      `${auctionId}:${amount}`
    );
  }

  /**
   * Authenticate with circuit breaker protection
   */
  async authenticate(credentials) {
    if (!this._isEnabled()) {
      return this._nellisApi.authenticate(credentials);
    }
    
    return this._executeWithCircuitBreaker(
      'authenticate',
      () => this._nellisApi.authenticate(credentials),
      'auth'
    );
  }

  /**
   * Check auth with circuit breaker protection
   */
  async checkAuth() {
    if (!this._isEnabled()) {
      return this._nellisApi.checkAuth();
    }
    
    return this._executeWithCircuitBreaker(
      'checkAuth',
      () => this._nellisApi.checkAuth(),
      'checkAuth'
    );
  }

  /**
   * Execute operation with circuit breaker logic
   */
  async _executeWithCircuitBreaker(operation, fn, context) {
    this._metrics.totalRequests++;
    
    // Check circuit state
    if (this._state === CIRCUIT_STATES.OPEN) {
      if (Date.now() < this._nextAttemptTime) {
        // Fast fail
        this._metrics.fastFailures++;
        const error = new Error(`Circuit breaker is OPEN for ${operation}. Failing fast.`);
        error.circuitBreakerState = CIRCUIT_STATES.OPEN;
        error.nextAttemptTime = this._nextAttemptTime;
        throw error;
      } else {
        // Transition to half-open
        this._transitionToHalfOpen();
      }
    }
    
    try {
      const startTime = Date.now();
      const result = await fn();
      const duration = Date.now() - startTime;
      
      // Operation succeeded
      this._onSuccess(operation, duration, context);
      return result;
      
    } catch (error) {
      // Operation failed
      this._onFailure(operation, error, context);
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  _onSuccess(operation, duration, context) {
    this._metrics.successfulRequests++;
    
    if (this._state === CIRCUIT_STATES.HALF_OPEN) {
      this._halfOpenSuccesses++;
      logger.info(`Circuit breaker half-open success for ${operation} (${this._halfOpenSuccesses}/${this._config.successThreshold})`);
      
      if (this._halfOpenSuccesses >= this._config.successThreshold) {
        this._transitionToClosed();
        this._metrics.successfulRecoveries++;
        logger.info(`Circuit breaker recovered and closed for ${operation}`);
      }
    } else if (this._state === CIRCUIT_STATES.CLOSED) {
      // Reset failure count on successful operation
      this._failureCount = 0;
    }
    
    logger.debug(`Circuit breaker success: ${operation} completed in ${duration}ms`);
  }

  /**
   * Handle failed operation
   */
  _onFailure(operation, error, context) {
    this._metrics.failedRequests++;
    this._failureCount++;
    this._lastFailureTime = Date.now();
    
    logger.warn(`Circuit breaker failure: ${operation} failed`, {
      error: error.message,
      failureCount: this._failureCount,
      state: this._state,
      context
    });
    
    if (this._state === CIRCUIT_STATES.HALF_OPEN) {
      // Half-open failure transitions back to open
      this._transitionToOpen();
      logger.warn(`Circuit breaker re-opened due to half-open failure in ${operation}`);
    } else if (this._state === CIRCUIT_STATES.CLOSED && this._failureCount >= this._config.failureThreshold) {
      // Too many failures, open the circuit
      this._transitionToOpen();
      logger.error(`Circuit breaker opened due to ${this._failureCount} failures in ${operation}`);
    }
  }

  /**
   * Transition to OPEN state
   */
  _transitionToOpen() {
    this._state = CIRCUIT_STATES.OPEN;
    this._nextAttemptTime = Date.now() + this._config.timeout;
    this._metrics.circuitOpened++;
    
    logger.warn(`Circuit breaker opened. Next attempt at: ${new Date(this._nextAttemptTime).toISOString()}`);
  }

  /**
   * Transition to HALF_OPEN state
   */
  _transitionToHalfOpen() {
    this._state = CIRCUIT_STATES.HALF_OPEN;
    this._halfOpenSuccesses = 0;
    this._metrics.halfOpenAttempts++;
    
    logger.info('Circuit breaker transitioned to HALF_OPEN state');
  }

  /**
   * Transition to CLOSED state
   */
  _transitionToClosed() {
    this._state = CIRCUIT_STATES.CLOSED;
    this._failureCount = 0;
    this._lastFailureTime = null;
    this._nextAttemptTime = null;
    this._halfOpenSuccesses = 0;
    
    logger.info('Circuit breaker transitioned to CLOSED state');
  }

  /**
   * Force open the circuit (for testing/maintenance)
   */
  forceOpen() {
    this._transitionToOpen();
    logger.warn('Circuit breaker manually forced to OPEN state');
  }

  /**
   * Force close the circuit (for testing/recovery)
   */
  forceClose() {
    this._transitionToClosed();
    logger.info('Circuit breaker manually forced to CLOSED state');
  }

  /**
   * Get circuit breaker metrics and status
   */
  getCircuitBreakerStatus() {
    return {
      enabled: this._isEnabled(),
      state: this._state,
      failureCount: this._failureCount,
      lastFailureTime: this._lastFailureTime ? new Date(this._lastFailureTime).toISOString() : null,
      nextAttemptTime: this._nextAttemptTime ? new Date(this._nextAttemptTime).toISOString() : null,
      config: this._config,
      metrics: {
        ...this._metrics,
        successRate: this._metrics.totalRequests > 0 
          ? (this._metrics.successfulRequests / this._metrics.totalRequests * 100).toFixed(2) + '%'
          : '0%'
      }
    };
  }

  /**
   * Reset circuit breaker metrics (for testing)
   */
  resetMetrics() {
    this._metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      circuitOpened: 0,
      fastFailures: 0,
      halfOpenAttempts: 0,
      successfulRecoveries: 0
    };
    logger.info('Circuit breaker metrics reset');
  }

  /**
   * Check if circuit breaker is enabled via feature flag
   */
  _isEnabled() {
    return featureFlags.isEnabled('USE_CIRCUIT_BREAKER');
  }

  // Delegate all other methods to the wrapped instance
  get cookies() {
    return this._nellisApi.cookies;
  }

  set cookies(value) {
    this._nellisApi.cookies = value;
  }

  /**
   * Static factory method
   */
  static wrap(nellisApi) {
    return new CircuitBreakerNellisApi(nellisApi);
  }
}

module.exports = CircuitBreakerNellisApi;