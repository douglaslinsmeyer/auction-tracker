/**
 * Request signing utility for API security
 * Uses HMAC-SHA256 to sign requests and prevent CSRF/replay attacks
 */

const crypto = require('crypto');
const logger = require('./logger');

class RequestSigning {
  constructor() {
    this.algorithm = 'sha256';
    this.timestampWindow = 300000; // 5 minutes in milliseconds
  }

  /**
   * Generate signature for a request
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {string} path - Request path (e.g., /api/auction/123)
   * @param {number} timestamp - Unix timestamp in milliseconds
   * @param {string} body - Request body (stringified JSON)
   * @param {string} secret - Signing secret
   * @returns {string} Base64 encoded signature
   */
  generateSignature(method, path, timestamp, body = '', secret) {
    if (!secret) {
      throw new Error('Signing secret is required');
    }

    // Create canonical request string
    const canonicalRequest = [
      method.toUpperCase(),
      path,
      timestamp,
      body ? crypto.createHash('sha256').update(body).digest('hex') : ''
    ].join('\n');

    // Generate HMAC signature
    const hmac = crypto.createHmac(this.algorithm, secret);
    hmac.update(canonicalRequest);
    return hmac.digest('base64');
  }

  /**
   * Verify request signature
   * @param {Object} req - Express request object
   * @param {string} secret - Signing secret
   * @returns {Object} { valid: boolean, error?: string }
   */
  verifySignature(req, secret) {
    try {
      // Extract signature headers
      const signature = req.headers['x-signature'];
      const timestamp = parseInt(req.headers['x-timestamp']);

      if (!signature) {
        return { valid: false, error: 'Missing signature header' };
      }

      if (!timestamp || isNaN(timestamp)) {
        return { valid: false, error: 'Missing or invalid timestamp header' };
      }

      // Check timestamp is within acceptable window
      const now = Date.now();
      if (Math.abs(now - timestamp) > this.timestampWindow) {
        logger.warn('Request timestamp outside acceptable window', {
          timestamp,
          now,
          diff: Math.abs(now - timestamp)
        });
        return { valid: false, error: 'Request timestamp too old or too far in future' };
      }

      // Get request body (if any)
      const body = req.body ? JSON.stringify(req.body) : '';

      // Generate expected signature
      const expectedSignature = this.generateSignature(
        req.method,
        req.originalUrl || req.url,
        timestamp,
        body,
        secret
      );

      // Compare signatures using timing-safe comparison
      const valid = crypto.timingSafeEqual(
        Buffer.from(signature, 'base64'),
        Buffer.from(expectedSignature, 'base64')
      );

      if (!valid) {
        logger.warn('Invalid request signature', {
          method: req.method,
          path: req.originalUrl || req.url,
          ip: req.ip
        });
        return { valid: false, error: 'Invalid signature' };
      }

      return { valid: true };
    } catch (error) {
      logger.error('Error verifying request signature:', error);
      return { valid: false, error: 'Signature verification failed' };
    }
  }

  /**
   * Express middleware for optional request signing
   * @param {string} secret - Signing secret
   * @param {Object} options - Middleware options
   * @returns {Function} Express middleware
   */
  middleware(secret, options = {}) {
    const { 
      required = false, 
      excludePaths = ['/health', '/api-docs'], 
      headerName = 'x-signature-required' 
    } = options;

    return (req, res, next) => {
      // Skip excluded paths
      if (excludePaths.some(path => req.path.startsWith(path))) {
        return next();
      }

      // Check if signing is required for this request
      const isSigningRequired = required || req.headers[headerName] === 'true';

      // If signature is present, verify it
      if (req.headers['x-signature']) {
        const result = this.verifySignature(req, secret);
        
        if (!result.valid) {
          logger.warn('Request signature verification failed', {
            error: result.error,
            method: req.method,
            path: req.originalUrl || req.url,
            ip: req.ip
          });

          return res.status(401).json({
            success: false,
            error: result.error,
            code: 'INVALID_SIGNATURE'
          });
        }

        // Mark request as signed for downstream handlers
        req.signed = true;
      } else if (isSigningRequired) {
        // Signature required but not present
        return res.status(401).json({
          success: false,
          error: 'Request signature required',
          code: 'SIGNATURE_REQUIRED',
          headers: {
            'X-Signature': 'HMAC-SHA256 signature',
            'X-Timestamp': 'Unix timestamp in milliseconds'
          }
        });
      }

      next();
    };
  }

  /**
   * Generate signature headers for a request
   * @param {string} method - HTTP method
   * @param {string} path - Request path
   * @param {string} body - Request body
   * @param {string} secret - Signing secret
   * @returns {Object} Headers object with signature and timestamp
   */
  generateHeaders(method, path, body, secret) {
    const timestamp = Date.now();
    const signature = this.generateSignature(method, path, timestamp, body, secret);

    return {
      'X-Signature': signature,
      'X-Timestamp': timestamp.toString()
    };
  }

  /**
   * Client helper for signing fetch requests
   * @param {string} url - Request URL
   * @param {Object} options - Fetch options
   * @param {string} secret - Signing secret
   * @returns {Object} Modified fetch options with signature headers
   */
  signFetchRequest(url, options = {}, secret) {
    const urlObj = new URL(url);
    const method = options.method || 'GET';
    const body = options.body || '';

    const signatureHeaders = this.generateHeaders(
      method,
      urlObj.pathname + urlObj.search,
      body,
      secret
    );

    return {
      ...options,
      headers: {
        ...options.headers,
        ...signatureHeaders
      }
    };
  }
}

module.exports = new RequestSigning();