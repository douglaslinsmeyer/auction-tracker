/**
 * Lightweight client-side logger with test environment suppression
 * Based on best practices for browser logging
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

/**
 * Detect if running in test environment
 * @returns {boolean} True if in test mode
 */
const isTestEnvironment = () => {
  // Check for common test environment indicators
  return window.location.search.includes('test=true') ||
         window.location.search.includes('e2e=true') ||
         (window.location.hostname === 'localhost' &&
          window.location.search.includes('headless=true')) ||
         window.navigator.webdriver === true ||
         window.__TEST_MODE__ === true;
};

/**
 * Get current log level based on environment
 * @returns {number} Current log level
 */
const getCurrentLogLevel = () => {
  if (isTestEnvironment()) {
    return LOG_LEVELS.ERROR; // Only errors in test mode
  }

  // Check for explicit log level in URL or localStorage
  const urlParams = new URLSearchParams(window.location.search);
  const urlLogLevel = urlParams.get('logLevel');
  const storedLogLevel = localStorage.getItem('dashboard_log_level');

  const logLevelStr = urlLogLevel || storedLogLevel || 'INFO';
  return LOG_LEVELS[logLevelStr.toUpperCase()] ?? LOG_LEVELS.INFO;
};

/**
 * Format log message with timestamp and prefix
 * @param {string} level - Log level
 * @param {...any} args - Arguments to log
 * @returns {array} Formatted arguments
 */
const formatMessage = (level, ...args) => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [DASHBOARD-${level}]`;
  return [prefix, ...args];
};

/**
 * Dashboard Logger
 */
const Logger = {
  /**
   * Log error message
   * @param {...any} args - Arguments to log
   */
  error: (...args) => {
    if (getCurrentLogLevel() >= LOG_LEVELS.ERROR) {
      console.error(...formatMessage('ERROR', ...args));
    }
  },

  /**
   * Log warning message
   * @param {...any} args - Arguments to log
   */
  warn: (...args) => {
    if (getCurrentLogLevel() >= LOG_LEVELS.WARN) {
      console.warn(...formatMessage('WARN', ...args));
    }
  },

  /**
   * Log info message
   * @param {...any} args - Arguments to log
   */
  info: (...args) => {
    if (getCurrentLogLevel() >= LOG_LEVELS.INFO) {
      console.info(...formatMessage('INFO', ...args));
    }
  },

  /**
   * Log debug message
   * @param {...any} args - Arguments to log
   */
  debug: (...args) => {
    if (getCurrentLogLevel() >= LOG_LEVELS.DEBUG) {
      console.log(...formatMessage('DEBUG', ...args));
    }
  },

  /**
   * Set log level dynamically
   * @param {string} level - Log level (ERROR, WARN, INFO, DEBUG)
   */
  setLevel: (level) => {
    const upperLevel = level.toUpperCase();
    if (upperLevel in LOG_LEVELS) {
      localStorage.setItem('dashboard_log_level', upperLevel);
    }
  },

  /**
   * Get current log level name
   * @returns {string} Current log level name
   */
  getLevel: () => {
    const currentLevel = getCurrentLogLevel();
    return Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === currentLevel) || 'INFO';
  },

  /**
   * Check if test environment
   * @returns {boolean} True if in test mode
   */
  isTestMode: isTestEnvironment
};

// Export for use in modules or make available globally
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Logger;
} else {
  window.Logger = Logger;
}