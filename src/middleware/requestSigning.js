/**
 * Request signing middleware
 * Provides optional request signature verification for enhanced API security
 */

const requestSigning = require('../utils/requestSigning');
const logger = require('../utils/logger');

/**
 * Create request signing middleware
 * @param {Object} options - Middleware configuration
 * @returns {Function} Express middleware
 */
function createSigningMiddleware(options = {}) {
  const {
    secret = process.env.API_SIGNING_SECRET,
    enabled = process.env.ENABLE_REQUEST_SIGNING === 'true',
    required = false,
    excludePaths = [
      '/health',
      '/api-docs',
      '/api/auth/login',
      '/api/settings',
      '/favicon.ico',
      '/ws'
    ],
    bidEndpointsRequired = true // Require signing for bid endpoints
  } = options;

  // If signing is disabled globally, return pass-through middleware
  if (!enabled) {
    return (req, res, next) => next();
  }

  // Warn if no secret is configured
  if (!secret) {
    logger.warn('Request signing enabled but API_SIGNING_SECRET not configured');
    return (req, res, next) => next();
  }

  return (req, res, next) => {
    // Skip excluded paths
    if (excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Determine if signing is required for this endpoint
    let isRequired = required;

    // Bid endpoints should always require signing if enabled
    if (bidEndpointsRequired && req.path.includes('/bid')) {
      isRequired = true;
    }

    // Check for signature
    const hasSignature = !!req.headers['x-signature'];

    if (hasSignature) {
      // Verify the signature
      const result = requestSigning.verifySignature(req, secret);

      if (!result.valid) {
        logger.warn('Invalid request signature', {
          error: result.error,
          method: req.method,
          path: req.path,
          ip: req.ip
        });

        return res.status(401).json({
          success: false,
          error: 'Invalid request signature',
          code: 'INVALID_SIGNATURE',
          details: result.error
        });
      }

      // Mark request as verified
      req.signatureVerified = true;
      req.signatureTimestamp = parseInt(req.headers['x-timestamp']);
    } else if (isRequired) {
      // Signature required but not present
      return res.status(401).json({
        success: false,
        error: 'Request signature required for this endpoint',
        code: 'SIGNATURE_REQUIRED',
        instructions: {
          headers: {
            'X-Signature': 'HMAC-SHA256 signature of request',
            'X-Timestamp': 'Unix timestamp in milliseconds'
          },
          algorithm: 'HMAC-SHA256',
          format: 'method\\npath\\ntimestamp\\nbody_hash'
        }
      });
    }

    next();
  };
}

/**
 * Helper middleware to add signature info to response headers
 */
function addSignatureInfo(req, res, next) {
  if (process.env.ENABLE_REQUEST_SIGNING === 'true') {
    res.setHeader('X-Signature-Supported', 'true');
    res.setHeader('X-Signature-Algorithm', 'HMAC-SHA256');
    
    if (req.signatureVerified) {
      res.setHeader('X-Signature-Verified', 'true');
    }
  }
  next();
}

module.exports = {
  createSigningMiddleware,
  addSignatureInfo
};