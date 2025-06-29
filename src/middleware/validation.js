const schemas = require('../validators/schemas');

/**
 * Create validation middleware for request body
 * @param {string} schemaName - Name of the schema to use
 * @returns {Function} Express middleware
 */
function validateBody(schemaName) {
  return (req, res, next) => {
    const validator = schemas[`validate${schemaName}`];
    if (!validator) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'VALIDATION_CONFIG_ERROR'
      });
    }

    const { error, value } = validator(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
        code: 'VALIDATION_ERROR',
        field: error.details[0].path.join('.')
      });
    }

    // Replace body with validated and sanitized value
    req.body = value;
    next();
  };
}

/**
 * Create validation middleware for request params
 * @param {string} paramName - Name of the parameter to validate
 * @param {string} schemaName - Name of the schema to use
 * @returns {Function} Express middleware
 */
function validateParam(paramName, schemaName) {
  return (req, res, next) => {
    const validator = schemas[`validate${schemaName}`];
    if (!validator) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'VALIDATION_CONFIG_ERROR'
      });
    }

    const { error, value } = validator(req.params[paramName]);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
        code: 'VALIDATION_ERROR',
        field: paramName
      });
    }

    // Replace param with validated value
    req.params[paramName] = value;
    next();
  };
}

/**
 * Validate auction ID parameter
 */
const validateAuctionId = validateParam('id', 'AuctionId');

/**
 * Sanitize string input to prevent XSS
 * @param {string} input - Input string
 * @returns {string} Sanitized string
 */
function sanitizeString(input) {
  if (typeof input !== 'string') return input;
  
  // Remove any HTML tags
  return input
    .replace(/<[^>]*>/g, '')
    .trim()
    .substring(0, 1000); // Limit length
}

/**
 * Sanitize object recursively
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

module.exports = {
  validateBody,
  validateParam,
  validateAuctionId,
  sanitizeString,
  sanitizeObject
};