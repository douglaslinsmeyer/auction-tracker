# Nellis Auction Backend Tests

This directory contains the integration test suite for the Nellis Auction Backend.

## Test Files

### Integration Tests

1. **api.test.js** - Tests all API endpoints with proper mocking
   - Status endpoint
   - Auction management endpoints
   - Authentication endpoints
   - Configuration endpoints

2. **auctionMonitor.test.js** - Tests auction monitoring logic
   - Initialization and recovery
   - Auction management (add/remove/update)
   - Auto-bidding strategies
   - Event handling
   - Cleanup operations

3. **storage.test.js** - Tests Redis persistence layer
   - Storage initialization
   - Auction data persistence
   - Cookie storage
   - Bid history management
   - System state persistence
   - Memory fallback behavior
   - Error handling

4. **simple.test.js** - Basic integration tests demonstrating HTTP request/response patterns

5. **minimal.test.js** - Minimal tests for HTTP and WebSocket functionality

6. **working.test.js** - Complete working example showing all integration test patterns

## Test Infrastructure

### Utilities

- **TestServer** - Creates Express server for testing
- **WsTestClient** - WebSocket client for testing WebSocket functionality
- **testUtils** - Common test utilities and helpers
- **redis.mock.js** - Custom Redis mock implementation

### Mock Data

- **mockData.js** - Contains mock auction data, cookies, and API responses

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/integration/api.test.js

# Run with coverage
npm test:coverage

# Run only integration tests
npm test:integration
```

## Test Status

✅ All tests passing (66/66 tests across 6 test suites)

The test suite provides comprehensive coverage of:
- HTTP API endpoints
- WebSocket communication
- Auction monitoring logic
- Data persistence with Redis
- Error handling and fallback mechanisms
- Authentication flows