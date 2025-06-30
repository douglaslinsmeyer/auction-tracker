/**
 * Chrome Extension Logger with Manifest V3 best practices and test suppression
 * Based on Google's recommendations for extension logging
 */

/**
 * Detect if running in test environment for Chrome extension
 * @returns {boolean} True if in test mode
 */
const isTestEnvironment = () => {
  try {
    // Check if we're in a test environment
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      return true; // Likely a test environment without Chrome APIs
    }
    
    const manifest = chrome.runtime.getManifest();
    
    // Check for test indicators in manifest
    return manifest.version_name?.includes('test') ||
           manifest.version_name?.includes('dev') ||
           manifest.name?.includes('Test') ||
           manifest.name?.includes('Development');
  } catch (error) {
    // If we can't access chrome.runtime, assume test environment
    return true;
  }
};

/**
 * Get extension context for logging
 * @returns {string} Context string (background, content, popup, etc.)
 */
const getContext = () => {
  try {
    if (typeof window !== 'undefined' && window.location) {
      const url = window.location.href;
      if (url.includes('popup.html')) return 'POPUP';
      if (url.includes('options.html')) return 'OPTIONS';
      if (url.includes('chrome-extension://')) return 'PAGE';
    }
    
    // Check if this is a content script
    if (typeof window !== 'undefined' && window.location && 
        !window.location.href.startsWith('chrome-extension://')) {
      return 'CONTENT';
    }
    
    // Check if this is a service worker (background script)
    if (typeof importScripts === 'function') {
      return 'BACKGROUND';
    }
    
    return 'UNKNOWN';
  } catch (error) {
    return 'ERROR';
  }
};

/**
 * Format log message with timestamp and context
 * @param {string} level - Log level
 * @param {...any} args - Arguments to log
 * @returns {array} Formatted arguments
 */
const formatMessage = (level, ...args) => {
  const timestamp = new Date().toISOString();
  const context = getContext();
  const prefix = `[${timestamp}] [EXT-${context}-${level}]`;
  return [prefix, ...args];
};

/**
 * Chrome Extension Logger
 * Follows Manifest V3 best practices for logging
 */
const logger = {
  /**
   * Log debug message (suppressed in test mode)
   * @param {...any} args - Arguments to log
   */
  debug: (...args) => {
    if (isTestEnvironment()) return;
    console.debug(...formatMessage('DEBUG', ...args));
  },

  /**
   * Log info message (suppressed in test mode)
   * @param {...any} args - Arguments to log
   */
  info: (...args) => {
    if (isTestEnvironment()) return;
    console.info(...formatMessage('INFO', ...args));
  },

  /**
   * Log warning message (suppressed in test mode)
   * @param {...any} args - Arguments to log
   */
  warn: (...args) => {
    if (isTestEnvironment()) return;
    console.warn(...formatMessage('WARN', ...args));
  },

  /**
   * Log error message (always logged, even in test mode for debugging)
   * @param {...any} args - Arguments to log
   */
  error: (...args) => {
    console.error(...formatMessage('ERROR', ...args));
  },

  /**
   * Log extension lifecycle events
   * @param {string} event - Event name
   * @param {...any} args - Additional arguments
   */
  lifecycle: (event, ...args) => {
    if (isTestEnvironment()) return;
    console.info(...formatMessage('LIFECYCLE', `${event}:`, ...args));
  },

  /**
   * Log API calls and responses
   * @param {string} method - HTTP method
   * @param {string} url - Request URL
   * @param {any} response - Response data
   */
  api: (method, url, response) => {
    if (isTestEnvironment()) return;
    console.info(...formatMessage('API', `${method} ${url}`, response));
  },

  /**
   * Log user interactions
   * @param {string} action - User action
   * @param {...any} args - Additional context
   */
  user: (action, ...args) => {
    if (isTestEnvironment()) return;
    console.info(...formatMessage('USER', `${action}:`, ...args));
  },

  /**
   * Check if in test mode
   * @returns {boolean} True if in test mode
   */
  isTestMode: isTestEnvironment,

  /**
   * Get current context
   * @returns {string} Current context
   */
  getContext: getContext
};

// Make available globally for extension scripts
if (typeof globalThis !== 'undefined') {
  globalThis.ExtensionLogger = logger;
}

// Export for modules if available
if (typeof module !== 'undefined' && module.exports) {
  module.exports = logger;
}

// For extension background script
if (typeof self !== 'undefined' && self.ExtensionLogger === undefined) {
  self.ExtensionLogger = logger;
}