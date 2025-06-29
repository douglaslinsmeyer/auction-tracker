# Test Suite Documentation

## Overview
This test suite uses Jest for unit/integration/e2e tests and Cucumber for BDD tests. All tests are organized following Jest conventions with a focus on maintainability and clarity.

## Directory Structure
```
tests/
├── __fixtures__/         # Test data (deprecated - use factories)
├── __mocks__/           # Mock implementations for external dependencies
│   ├── ioredis.js       # Redis mock
│   └── nellisApi.js     # Nellis API mock
├── __support__/         # Shared test utilities and factories
│   ├── factories/       # Test data factories
│   │   ├── auctionFactory.js
│   │   ├── userFactory.js
│   │   ├── bidFactory.js
│   │   └── index.js
│   ├── setup.js         # Jest setup file
│   ├── testServer.js    # Express test server
│   ├── testUtils.js     # General test utilities
│   └── wsTestClient.js  # WebSocket test client
├── unit/                # Unit tests for individual modules
├── integration/         # Integration tests for API and services
├── e2e/                # End-to-end tests with Puppeteer
│   └── setup.js        # E2E-specific setup
└── bdd/                # Behavior-driven development tests
    ├── features/       # Gherkin feature files
    │   ├── api/
    │   ├── auction-monitoring/
    │   ├── authentication/
    │   ├── bidding-strategies/
    │   ├── performance/
    │   └── websocket/
    ├── step-definitions/  # Cucumber step implementations
    └── support/          # BDD-specific support files
        ├── hooks.js
        └── world.js
```

## Running Tests

### All Tests
```bash
npm test              # Run all tests (for production deployment)
npm run test:all      # Run all test types sequentially
npm run test:coverage # Run with coverage report
```

### Specific Test Types
```bash
npm run test:unit         # Run unit tests only
npm run test:integration  # Run integration tests only
npm run test:e2e         # Run end-to-end tests (headless)
npm run test:e2e:headful # Run end-to-end tests (with browser)
npm run test:bdd         # Run BDD/Cucumber tests
```

### Development Mode
```bash
npm run test:watch      # Run tests in watch mode
npm run test:bdd:watch  # Run BDD tests in watch mode
```

## Test Data Management

### Factory Pattern
We use factory patterns for generating test data instead of static fixtures:

```javascript
const { AuctionFactory, UserFactory, BidFactory } = require('./__support__/factories');

// Create test auction with defaults
const auction = AuctionFactory.create();

// Create auction with specific properties
const endingAuction = AuctionFactory.createEnding({ 
  currentBid: 150 
});

// Create auction with bid history
const activeAuction = AuctionFactory.createWithBids(5);

// Create user with strategy
const aggressiveUser = UserFactory.createWithStrategy('aggressive', {
  maxBid: 1000
});

// Create bid sequence
const bids = BidFactory.createBidSequence('AUC123', 10);
```

### Benefits of Factories
- Dynamic test data generation
- Consistent object structures
- Easy to create variations
- Reduces test coupling
- Better than static fixtures

## Mocking Strategy

### External Dependencies
All external dependencies are mocked to ensure fast, reliable tests:

1. **Redis** (`ioredis`)
   - Full in-memory implementation
   - Supports get/set/del/expire/ttl
   - Hash operations (hset/hget/hgetall)
   - Pub/Sub functionality
   - Test helpers for inspection

2. **Nellis API**
   - Simulates auction data
   - Configurable responses
   - Network delay simulation
   - Failure injection for testing

### Mock Usage Examples

```javascript
// Redis mock is auto-loaded via moduleNameMapper
const Redis = require('ioredis');
const redis = new Redis();

// Redis operations work as expected
await redis.set('key', 'value');
const value = await redis.get('key'); // 'value'

// Test helpers
redis._reset(); // Clear all data
redis._getData(); // Inspect stored data

// Nellis API mock
const nellisApi = require('../__mocks__/nellisApi');

// Configure responses
nellisApi.setMockResponse('auction-123', {
  id: '123',
  currentBid: 200
});

// Simulate failures
nellisApi.setShouldFail(true, 3); // Fail next 3 calls
nellisApi.setDelay(100); // Add 100ms delay

// Reset for next test
nellisApi._reset();
```

## Writing Tests

### Naming Conventions
- Test files: `[module].test.js`
- Describe blocks: Component or module name
- It blocks: Start with "should" + expected behavior

### Test Structure
```javascript
describe('AuctionMonitor', () => {
  let auctionMonitor;
  let mockStorage;
  
  beforeEach(() => {
    // Setup
    mockStorage = { get: jest.fn(), set: jest.fn() };
    auctionMonitor = new AuctionMonitor(mockStorage);
  });
  
  afterEach(() => {
    // Cleanup
    jest.clearAllMocks();
  });
  
  describe('startMonitoring', () => {
    it('should start monitoring an auction', async () => {
      // Arrange
      const auction = AuctionFactory.create();
      
      // Act
      await auctionMonitor.startMonitoring(auction.id);
      
      // Assert
      expect(mockStorage.set).toHaveBeenCalledWith(
        expect.stringContaining(auction.id),
        expect.any(String)
      );
    });
  });
});
```

### BDD Test Organization

#### Feature Files
Organized by domain in `tests/bdd/features/`:
- `auction-monitoring/` - Monitoring lifecycle scenarios
- `bidding-strategies/` - Manual, aggressive, last-second strategies
- `authentication/` - Login and cookie sync
- `performance/` - Load and reliability scenarios
- `websocket/` - Real-time communication

#### Step Definitions
Organized by feature in `tests/bdd/step-definitions/`:
- Reuse common steps across features
- Keep steps declarative, not imperative
- Use factories for test data

Example:
```javascript
const { Given, When, Then } = require('@cucumber/cucumber');
const { AuctionFactory } = require('../../__support__/factories');

Given('an auction {string} exists with current bid ${float}', async function(id, bid) {
  const auction = AuctionFactory.create({ id, currentBid: bid });
  await this.storage.set(`auction:${id}`, JSON.stringify(auction));
});
```

## Test Status

### Current Test Suite Status
✅ **Unit Tests**: 47 tests passing
- Circuit breaker functionality
- Polling queue management
- Feature flags
- Request signing
- ID generation
- Backward compatibility

✅ **Integration Tests**: 66 tests passing across 6 test suites
- HTTP API endpoints
- WebSocket communication
- Auction monitoring logic
- Data persistence with Redis
- Error handling and fallback mechanisms
- Authentication flows

✅ **BDD Tests**: 7 scenarios implemented
- Auction monitoring lifecycle
- Auto-bidding strategies

⏳ **Remaining**: 139 BDD scenarios to implement in Phase 4

## Best Practices

### General Guidelines
1. **Isolation**: Each test should be independent
2. **Clarity**: Test names should clearly describe behavior
3. **Speed**: Mock external dependencies
4. **Reliability**: No flaky tests
5. **Coverage**: Aim for 80%+ coverage

### Following Existing Patterns
- Use existing mock patterns in the codebase
- Follow established naming conventions
- Reuse test utilities and factories
- Maintain consistent test structure

### Happy Path First
When writing scenarios:
1. Start with successful operations
2. Add edge cases incrementally
3. Focus on user-visible behavior
4. Keep scenarios concise (3-5 steps)

### Step Definition Reuse
- Create generic, parameterized steps
- Avoid duplication across features
- Use factories for consistent data
- Keep steps focused on behavior

## Troubleshooting

### Common Issues

1. **Import Errors**
   - Check paths use `__support__`, `__mocks__`, `__fixtures__`
   - Ensure Jest config has correct moduleNameMapper

2. **Mock Not Working**
   - Verify mock is in `__mocks__` directory
   - Check mock filename matches module name
   - Clear Jest cache: `npx jest --clearCache`

3. **BDD Tests Failing**
   - Ensure all feature files are in `tests/bdd/features`
   - Check step definitions are in `tests/bdd/step-definitions`
   - Verify Cucumber configuration in package.json

4. **Async Issues**
   - Always await async operations
   - Use proper Jest async patterns
   - Check for unhandled promise rejections

### Debug Commands
```bash
# Run specific test file
npm test -- tests/unit/auctionMonitor.test.js

# Run tests matching pattern
npm test -- --testNamePattern="should start monitoring"

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand

# Run with verbose output
npm test -- --verbose
```

## Continuous Integration

Tests are designed to run in CI/CD pipelines:
- All external dependencies mocked
- No network calls required
- Consistent test data via factories
- Proper setup/teardown
- Exit codes for build systems

## Contributing

When adding new tests:
1. Follow the established patterns
2. Use factories for test data
3. Mock external dependencies
4. Write clear test descriptions
5. Ensure tests are reliable
6. Update this documentation if needed