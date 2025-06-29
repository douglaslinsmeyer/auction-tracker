/**
 * Global error handler middleware
 * Prevents sensitive information like stack traces from being exposed
 */

const logger = require('winston');

/**
 * Error handler middleware
 * Must be the last middleware added to Express
 */
function errorHandler(err, req, res, next) {
  // Log the full error internally
  logger.error('Request error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    headers: req.headers
  });

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Create safe error response
  const errorResponse = {
    success: false,
    error: getClientSafeError(err, statusCode),
    code: err.code || 'INTERNAL_ERROR'
  };

  // Add request ID if available
  if (req.id) {
    errorResponse.requestId = req.id;
  }

  // Send response
  res.status(statusCode).json(errorResponse);
}

/**
 * Get client-safe error message
 * @param {Error} err - The error object
 * @param {number} statusCode - HTTP status code
 * @returns {string} Safe error message
 */
function getClientSafeError(err, statusCode) {
  // For client errors (4xx), return the actual message
  if (statusCode >= 400 && statusCode < 500) {
    return err.message || 'Bad request';
  }

  // For server errors (5xx), return generic message
  // unless we explicitly marked it as safe
  if (err.isClientSafe) {
    return err.message;
  }

  // Generic error messages by status code
  const genericMessages = {
    500: 'Internal server error',
    502: 'Bad gateway',
    503: 'Service unavailable',
    504: 'Gateway timeout'
  };

  return genericMessages[statusCode] || 'An error occurred';
}

/**
 * Async error wrapper for route handlers
 * Catches async errors and passes them to error handler
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create a client-safe error
 * @param {string} message - Error message safe for client
 * @param {number} statusCode - HTTP status code
 * @param {string} code - Error code
 * @returns {Error} Error object
 */
function createError(message, statusCode = 500, code = 'ERROR') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.isClientSafe = true;
  return error;
}

/**
 * Not found handler
 * Use before error handler
 */
function notFoundHandler(req, res, next) {
  const error = createError(`Cannot ${req.method} ${req.url}`, 404, 'NOT_FOUND');
  next(error);
}

module.exports = {
  errorHandler,
  asyncHandler,
  createError,
  notFoundHandler
};