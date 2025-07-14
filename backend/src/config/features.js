/**
 * Feature Flag Configuration
 * Centralized feature flag management for safe rollout
 */

const logger = require('../utils/logger');

/**
 * Feature flag definitions
 * Each flag controls a specific enhancement
 */
const FEATURE_FLAGS = {
  // Phase 3 - Performance & Architecture
  USE_POLLING_QUEUE: {
    name: 'USE_POLLING_QUEUE',
    description: 'Use priority-based polling queue instead of individual timers',
    defaultValue: false,
    phase: 3
  },
  USE_CIRCUIT_BREAKER: {
    name: 'USE_CIRCUIT_BREAKER',
    description: 'Enable circuit breaker for Nellis API calls',
    defaultValue: false,
    phase: 3
  },
  USE_STATE_MACHINE: {
    name: 'USE_STATE_MACHINE',
    description: 'Use state machine for auction lifecycle management',
    defaultValue: false,
    phase: 3
  },

  // Phase 4 - Testing & Monitoring
  ENABLE_PERFORMANCE_METRICS: {
    name: 'ENABLE_PERFORMANCE_METRICS',
    description: 'Collect detailed performance metrics',
    defaultValue: false,
    phase: 4
  },

  // Phase 4.5 - SSE Integration
  USE_SSE: {
    name: 'USE_SSE',
    description: 'Enable Server-Sent Events for real-time auction updates',
    defaultValue: false,
    phase: 4.5
  },

  // Phase 5 - Advanced Features
  USE_SMART_BIDDING: {
    name: 'USE_SMART_BIDDING',
    description: 'Enable ML-based bidding strategies',
    defaultValue: false,
    phase: 5
  },
  USE_MINIMAL_POLLING: {
    name: 'USE_MINIMAL_POLLING',
    description: 'Use minimal polling strategy to reduce API calls',
    defaultValue: false,
    phase: 5
  }
};

/**
 * Feature flag manager
 */
class FeatureFlags {
  constructor() {
    this.flags = {};
    this.redisClient = null;
    this.initialized = false;
  }

  /**
   * Initialize feature flags from environment and Redis
   * @param {Object} redisClient - Optional Redis client for dynamic flags
   */
  async initialize(redisClient = null) {
    this.redisClient = redisClient;

    // Load from environment variables
    for (const [key, config] of Object.entries(FEATURE_FLAGS)) {
      const envValue = process.env[config.name];
      if (envValue !== undefined) {
        this.flags[key] = envValue === 'true';
        logger.info(`Feature flag ${config.name} set to ${this.flags[key]} from environment`);
      } else {
        this.flags[key] = config.defaultValue;
      }
    }

    // Load from Redis if available
    if (this.redisClient && this.redisClient.connected) {
      await this.loadFromRedis();
    }

    this.initialized = true;
    this.logStatus();
  }

  /**
   * Load feature flags from Redis
   */
  async loadFromRedis() {
    try {
      for (const [key, config] of Object.entries(FEATURE_FLAGS)) {
        const redisKey = `feature:${config.name.toLowerCase()}`;
        const value = await this.redisClient.get(redisKey);
        if (value !== null) {
          this.flags[key] = value === 'true';
          logger.info(`Feature flag ${config.name} set to ${this.flags[key]} from Redis`);
        }
      }
    } catch (error) {
      logger.error('Error loading feature flags from Redis:', error);
    }
  }

  /**
   * Check if a feature is enabled
   * @param {string} featureName - Feature flag name (key from FEATURE_FLAGS)
   * @returns {boolean} True if enabled
   */
  isEnabled(featureName) {
    if (!this.initialized) {
      logger.warn('Feature flags not initialized, using defaults');
      return FEATURE_FLAGS[featureName]?.defaultValue || false;
    }

    return this.flags[featureName] || false;
  }

  /**
   * Enable a feature (for testing)
   * @param {string} featureName - Feature flag name
   */
  enable(featureName) {
    if (FEATURE_FLAGS[featureName]) {
      this.flags[featureName] = true;
      logger.info(`Feature ${featureName} enabled programmatically`);
    }
  }

  /**
   * Disable a feature (for testing)
   * @param {string} featureName - Feature flag name
   */
  disable(featureName) {
    if (FEATURE_FLAGS[featureName]) {
      this.flags[featureName] = false;
      logger.info(`Feature ${featureName} disabled programmatically`);
    }
  }

  /**
   * Get all feature flags and their current status
   * @returns {Object} Feature flag status
   */
  getStatus() {
    const status = {};
    for (const [key, config] of Object.entries(FEATURE_FLAGS)) {
      status[key] = {
        name: config.name,
        description: config.description,
        enabled: this.flags[key] || false,
        phase: config.phase
      };
    }
    return status;
  }

  /**
   * Log current feature flag status
   */
  logStatus() {
    logger.info('Feature Flag Status:');
    const status = this.getStatus();
    for (const info of Object.values(status)) {
      logger.info(`  ${info.name}: ${info.enabled ? 'ENABLED' : 'DISABLED'} - ${info.description}`);
    }
  }

  /**
   * Update a feature flag in Redis (for live toggling)
   * @param {string} featureName - Feature flag name
   * @param {boolean} enabled - Enable or disable
   */
  async updateInRedis(featureName, enabled) {
    if (!this.redisClient || !this.redisClient.connected) {
      throw new Error('Redis not available for feature flag updates');
    }

    const config = FEATURE_FLAGS[featureName];
    if (!config) {
      throw new Error(`Unknown feature flag: ${featureName}`);
    }

    const redisKey = `feature:${config.name.toLowerCase()}`;
    await this.redisClient.set(redisKey, enabled.toString());
    this.flags[featureName] = enabled;

    logger.info(`Feature flag ${featureName} updated to ${enabled} in Redis`);
  }

  /**
   * Reset all flags to defaults (for testing)
   */
  reset() {
    for (const [key, config] of Object.entries(FEATURE_FLAGS)) {
      this.flags[key] = config.defaultValue;
    }
    logger.info('Feature flags reset to defaults');
  }
}

// Create singleton instance
const featureFlags = new FeatureFlags();

// Export both instance and class
module.exports = featureFlags;
module.exports.FeatureFlags = FeatureFlags;
module.exports.FEATURE_FLAGS = FEATURE_FLAGS;