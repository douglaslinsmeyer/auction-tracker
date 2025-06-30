# Logging Guidelines

This document provides comprehensive guidelines for logging across all project components to ensure consistent, secure, and CI/CD-friendly logging practices.

## Overview

The project implements a comprehensive logging strategy across three components:
- **Backend**: Winston-based structured logging with security redaction
- **Dashboard**: Lightweight browser logging with test environment detection  
- **Extension**: Chrome Extension Manifest V3 compliant logging with context awareness

## ❌ NEVER Do This

```javascript
// ❌ NEVER use console methods directly in source code
console.log('User logged in');
console.error('Something went wrong');
console.warn('This is deprecated');
console.info('Processing data');

// ❌ These cause "Cannot log after tests are done" CI/CD failures
```

## ✅ Always Do This

### Backend Logging (Node.js with Winston)

```javascript
// ✅ Import and use the Winston logger
const logger = require('../utils/logger');

// ✅ Structured logging with context
logger.info('User authenticated successfully', { 
  userId: user.id, 
  email: user.email,
  loginMethod: 'oauth' 
});

logger.warn('Rate limit approaching', { 
  requests: currentCount, 
  limit: maxRequests,
  timeWindow: '1min' 
});

logger.error('Database connection failed', { 
  error: err.message, 
  stack: err.stack,
  dbHost: process.env.DB_HOST 
});

logger.debug('Processing auction data', { 
  auctionId, 
  bidCount, 
  processingTime: endTime - startTime 
});
```

### Dashboard Logging (Browser)

```javascript
// ✅ Use the global Logger (automatically available)
Logger.info('Dashboard initialized');
Logger.warn('WebSocket connection unstable', { retryCount: 3 });
Logger.error('Failed to load auction data', { error: error.message });
Logger.debug('User interaction', { 
  action: 'bid_placed', 
  auctionId: '12345',
  timestamp: Date.now() 
});

// ✅ Or import as module
const logger = require('./logger');
logger.info('Component loaded', { component: 'AuctionList' });
```

### Extension Logging (Chrome Extension)

```javascript
// ✅ Import logger in background.js
importScripts('./logger.js');

// ✅ Use ExtensionLogger with context-aware methods
ExtensionLogger.lifecycle('Extension starting up');
ExtensionLogger.info('Monitoring auction', { auctionId: '12345' });
ExtensionLogger.user('Button clicked', { action: 'start_monitoring' });
ExtensionLogger.api('GET', '/api/auctions', { status: 200, count: 5 });
ExtensionLogger.error('Background script error', error);

// ✅ Context is automatically detected (BACKGROUND, CONTENT, POPUP)
ExtensionLogger.debug('Message received', { type: 'auctionUpdate' });
```

## Log Levels and When to Use Them

### ERROR (Always logged, even in tests)
- **Actual errors** that require immediate attention
- **Failed operations** that affect functionality
- **Unhandled exceptions** and critical failures

```javascript
logger.error('Payment processing failed', { 
  orderId: '12345', 
  error: err.message,
  userId: req.user.id 
});
```

### WARN (Production and development only)
- **Potentially problematic** situations
- **Fallback mechanisms** being used
- **Deprecation warnings**
- **Rate limit** warnings

```javascript
logger.warn('Falling back to polling due to SSE failure', { 
  sseError: err.message,
  fallbackInterval: 5000 
});
```

### INFO (Production and development only)
- **General application flow**
- **User actions** and system events
- **Service connections** and disconnections
- **Important state changes**

```javascript
logger.info('User started monitoring auction', { 
  userId: user.id,
  auctionId: '12345',
  strategy: 'sniping' 
});
```

### DEBUG (Development only, suppressed in production)
- **Detailed diagnostic** information
- **Data processing** steps
- **Internal state** changes
- **Performance metrics**

```javascript
logger.debug('Auction data processed', { 
  auctionId: '12345',
  bidCount: 15,
  processingTimeMs: 45,
  dataSize: data.length 
});
```

## Test Environment Behavior

### Automatic Test Suppression
All loggers automatically detect test environments and suppress output:

- **Backend**: Detects `NODE_ENV=test` and silences all logs except ERROR
- **Dashboard**: Detects test URLs (`?test=true`, `?e2e=true`) and webdriver presence
- **Extension**: Detects test manifests and missing Chrome APIs

### Override for Test Development
```bash
# Enable logs during test development
ENABLE_TEST_LOGS=true npm test

# Or set in .env file
ENABLE_TEST_LOGS=true
```

## Security and Privacy

### Automatic Redaction (Backend)
The Winston logger automatically redacts sensitive fields:

```javascript
// ✅ These fields are automatically redacted
logger.info('User data processed', {
  password: 'secret123',      // → [REDACTED]
  token: 'abc123',           // → [REDACTED]  
  apiKey: 'key456',          // → [REDACTED]
  cookie: 'session=xyz',     // → [REDACTED]
  authorization: 'Bearer x'   // → [REDACTED]
});
```

### Manual Redaction for Additional Fields
```javascript
// ✅ Use structured logging to avoid accidental exposure
logger.info('Processing payment', {
  userId: user.id,
  amount: payment.amount,
  // Don't log sensitive card details
  cardLast4: payment.card.last4  // Only last 4 digits
});
```

## Environment Configuration

### Backend (.env)
```bash
# Log level (error, warn, info, debug)
LOG_LEVEL=info

# Enable logs during tests (default: false)
ENABLE_TEST_LOGS=false

# Automatically detected
NODE_ENV=production
```

### Dashboard (Automatic Detection)
- URL parameters: `?test=true`, `?e2e=true`, `?logLevel=debug`
- Webdriver presence: `navigator.webdriver === true`
- Local storage: `localStorage.dashboard_log_level`

### Extension (Manifest-based Detection)
- Manifest version_name containing "test" or "dev"
- Missing Chrome APIs (test environment)
- Automatic context detection (background, content, popup)

## Migration Guide

### From Console to Logger
```javascript
// ❌ Old way
console.log('User action:', action);
console.error('Error occurred:', error);
console.warn('Warning:', message);

// ✅ New way
logger.info('User action performed', { action, userId });
logger.error('Operation failed', { error: error.message, context });
logger.warn('Potential issue detected', { message, severity: 'medium' });
```

### Testing Your Changes
```bash
# 1. Run tests to ensure no CI/CD breakage
npm test

# 2. Check integration tests pass
npm run test:integration

# 3. Verify E2E tests don't fail due to logging
npm run test:e2e

# 4. Test in development mode
NODE_ENV=development npm start
```

## Common Patterns

### API Requests
```javascript
// ✅ Backend API logging
logger.info('API request received', {
  method: req.method,
  path: req.path,
  userId: req.user?.id,
  userAgent: req.get('user-agent')
});

// ✅ Extension API logging  
ExtensionLogger.api('POST', '/api/auctions/123/bid', {
  status: response.status,
  auctionId: '123'
});
```

### Error Handling
```javascript
// ✅ Comprehensive error logging
try {
  await processAuction(auctionId);
} catch (error) {
  logger.error('Auction processing failed', {
    auctionId,
    error: error.message,
    stack: error.stack,
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  });
  throw error; // Re-throw for proper error handling
}
```

### Performance Monitoring
```javascript
// ✅ Performance logging
const startTime = Date.now();
await processLargeDataset(data);
const endTime = Date.now();

logger.debug('Data processing completed', {
  datasetSize: data.length,
  processingTimeMs: endTime - startTime,
  recordsPerSecond: Math.round(data.length / ((endTime - startTime) / 1000))
});
```

## Troubleshooting

### "Cannot log after tests are done" Error
This happens when console methods are used after Jest has finished running tests.

**Solution**: Replace all `console.*` calls with the appropriate logger.

### Logs Not Appearing in Development
Check your log level configuration:

```javascript
// Backend
process.env.LOG_LEVEL = 'debug';

// Dashboard  
localStorage.setItem('dashboard_log_level', 'DEBUG');

// Extension
// Logs automatically appear in development builds
```

### Test Environment Detection Not Working
Ensure your test environment variables are properly set:

```bash
# Backend
NODE_ENV=test

# Dashboard (automatic detection)
# URL: http://localhost:3001?test=true

# Extension (automatic detection)
# manifest.json: "version_name": "1.0.0-test"
```

## Best Practices Summary

1. **✅ NEVER use console methods** in source code
2. **✅ ALWAYS use the appropriate logger** for each component  
3. **✅ Use structured logging** with context objects
4. **✅ Include relevant metadata** (userIds, timestamps, etc.)
5. **✅ Test logging changes** don't break CI/CD
6. **✅ Use appropriate log levels** (error, warn, info, debug)
7. **✅ Let automatic redaction** handle sensitive data
8. **✅ Leverage context-aware logging** in extensions
9. **✅ Monitor test suppression** works correctly
10. **✅ Document custom logging patterns** for your team

Following these guidelines ensures consistent, secure, and maintainable logging across the entire auction monitoring system.