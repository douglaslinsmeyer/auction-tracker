# Phase 4 Implementation Guide

Based on the requirements and answers provided, this guide outlines the specific implementation steps for Phase 4.

## Branch Strategy

```bash
# Create feature branch for test reorganization
git checkout -b feature/phase-4-test-reorganization

# After reorganization is complete and tests pass
git checkout main
git merge feature/phase-4-test-reorganization
```

## Day 1-2: Test Infrastructure Reorganization

### 1. Consolidate Jest Configurations

Since `npm test` is used for production deployments, we'll ensure backward compatibility:

```javascript
// jest.config.js - Unified configuration
module.exports = {
  // Base configuration
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/__support__/setup.js'],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Use __mocks__ convention (Jest standard)
  moduleNameMapper: {
    '^ioredis$': '<rootDir>/tests/__mocks__/ioredis.js'
  },
  
  // Projects for different test types
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
      testTimeout: 10000
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      testTimeout: 30000
    },
    {
      displayName: 'e2e',
      preset: 'jest-puppeteer',
      testMatch: ['<rootDir>/tests/e2e/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/e2e/setup.js'],
      testTimeout: 60000
    }
  ],
  
  // Coverage settings
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js'
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

### 2. Create Test Data Factories

As requested, we'll use factories instead of fixtures:

```javascript
// tests/__support__/factories/auctionFactory.js
class AuctionFactory {
  static create(overrides = {}) {
    const defaults = {
      id: this.generateId(),
      title: 'Test Auction Item',
      currentBid: 50,
      timeLeft: 300,
      status: 'active',
      createdAt: new Date(),
      endTime: new Date(Date.now() + 300000)
    };
    
    return { ...defaults, ...overrides };
  }
  
  static createEnding(overrides = {}) {
    return this.create({
      timeLeft: 30,
      endTime: new Date(Date.now() + 30000),
      ...overrides
    });
  }
  
  static createEnded(overrides = {}) {
    return this.create({
      status: 'ended',
      timeLeft: 0,
      endTime: new Date(Date.now() - 1000),
      ...overrides
    });
  }
  
  static generateId() {
    return 'AUC' + Math.random().toString(36).substr(2, 9).toUpperCase();
  }
}

// tests/__support__/factories/userFactory.js
class UserFactory {
  static create(overrides = {}) {
    const defaults = {
      id: this.generateId(),
      email: `test${Date.now()}@example.com`,
      maxBid: 500,
      strategy: 'manual',
      isAuthenticated: true
    };
    
    return { ...defaults, ...overrides };
  }
  
  static generateId() {
    return 'USR' + Math.random().toString(36).substr(2, 9);
  }
}

// tests/__support__/factories/bidFactory.js
class BidFactory {
  static create(overrides = {}) {
    const defaults = {
      auctionId: AuctionFactory.generateId(),
      amount: 100,
      userId: UserFactory.generateId(),
      timestamp: new Date(),
      status: 'pending'
    };
    
    return { ...defaults, ...overrides };
  }
}

module.exports = { AuctionFactory, UserFactory, BidFactory };
```

### 3. Mock Strategy for External Dependencies

All external dependencies will be mocked as requested:

```javascript
// tests/__mocks__/ioredis.js
// Unified Redis mock (replacing custom redis.mock.js)
class RedisMock {
  constructor() {
    this.data = new Map();
    this.expiries = new Map();
  }
  
  async get(key) {
    if (this.isExpired(key)) {
      this.data.delete(key);
      return null;
    }
    return this.data.get(key) || null;
  }
  
  async set(key, value, ...args) {
    this.data.set(key, value);
    // Handle EX flag for expiry
    if (args[0] === 'EX' && args[1]) {
      this.expiries.set(key, Date.now() + (args[1] * 1000));
    }
    return 'OK';
  }
  
  async del(key) {
    this.data.delete(key);
    this.expiries.delete(key);
    return 1;
  }
  
  // Add other Redis methods as needed
  
  isExpired(key) {
    const expiry = this.expiries.get(key);
    return expiry && Date.now() > expiry;
  }
  
  _reset() {
    this.data.clear();
    this.expiries.clear();
  }
}

module.exports = RedisMock;

// tests/__mocks__/nellisApi.js
// Mock for Nellis API
class NellisApiMock {
  constructor() {
    this.auctions = new Map();
    this.responses = new Map();
  }
  
  setMockResponse(endpoint, response) {
    this.responses.set(endpoint, response);
  }
  
  async getAuction(auctionId) {
    if (this.responses.has(`auction-${auctionId}`)) {
      return this.responses.get(`auction-${auctionId}`);
    }
    
    // Default mock response
    return {
      id: auctionId,
      title: 'Mock Auction',
      currentBid: 100,
      timeLeft: 300,
      status: 'active'
    };
  }
  
  async placeBid(auctionId, amount) {
    // Mock successful bid
    return {
      success: true,
      newBid: amount,
      message: 'Bid placed successfully'
    };
  }
  
  _reset() {
    this.auctions.clear();
    this.responses.clear();
  }
}

module.exports = NellisApiMock;
```

### 4. Directory Reorganization Script

```bash
#!/bin/bash
# reorganize-tests.sh

echo "Starting test reorganization..."

# Create new directory structure
mkdir -p tests/__fixtures__
mkdir -p tests/__mocks__
mkdir -p tests/__support__/factories
mkdir -p tests/bdd/features/{api,auction-monitoring,authentication,bidding-strategies,performance,websocket}
mkdir -p tests/bdd/step-definitions
mkdir -p tests/bdd/support

# Move fixtures to __fixtures__ (though we'll use factories)
if [ -d "tests/fixtures" ]; then
  mv tests/fixtures/* tests/__fixtures__/ 2>/dev/null || true
  rmdir tests/fixtures
fi

# Move and rename Redis mock
if [ -f "tests/mocks/redis.mock.js" ]; then
  mv tests/mocks/redis.mock.js tests/__mocks__/ioredis.js
  rmdir tests/mocks
fi

# Move utilities to __support__
if [ -d "tests/utils" ]; then
  mv tests/utils/* tests/__support__/ 2>/dev/null || true
  rmdir tests/utils
fi

# Move setup file
if [ -f "tests/setup.js" ]; then
  mv tests/setup.js tests/__support__/setup.js
fi

# Consolidate BDD files
# Move features from discovered directory
if [ -d "tests/features/discovered" ]; then
  # Move only .feature files, not documentation
  find tests/features/discovered -name "*.feature" -exec mv {} tests/bdd/features/ \;
fi

# Move all other features
find tests/features -name "*.feature" -exec mv {} tests/bdd/features/ \; 2>/dev/null || true

# Consolidate step definitions from both locations
if [ -d "tests/step-definitions" ]; then
  mv tests/step-definitions/* tests/bdd/step-definitions/ 2>/dev/null || true
  rmdir tests/step-definitions
fi

if [ -d "tests/features/step_definitions" ]; then
  mv tests/features/step_definitions/* tests/bdd/step-definitions/ 2>/dev/null || true
  rmdir tests/features/step_definitions
fi

# Move BDD support files
if [ -d "tests/support" ]; then
  mv tests/support/hooks.js tests/bdd/support/ 2>/dev/null || true
  mv tests/support/world.js tests/bdd/support/ 2>/dev/null || true
  # Keep other support files in __support__
  mv tests/support/* tests/__support__/ 2>/dev/null || true
  rmdir tests/support
fi

# Clean up empty directories
find tests/features -type d -empty -delete 2>/dev/null || true

# Update imports in all test files
echo "Updating import paths..."
find tests -name "*.js" -type f -exec sed -i \
  -e "s|'../fixtures/|'../__fixtures__/|g" \
  -e "s|'../mocks/|'../__mocks__/|g" \
  -e "s|'../utils/|'../__support__/|g" \
  -e "s|'../support/|'../__support__/|g" \
  -e "s|'./fixtures/|'./__fixtures__/|g" \
  -e "s|'./mocks/|'./__mocks__/|g" \
  -e "s|'./utils/|'./__support__/|g" \
  {} \;

echo "Test reorganization complete!"
```

### 5. Update Package.json Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --selectProjects=unit",
    "test:integration": "jest --selectProjects=integration",
    "test:e2e": "jest --selectProjects=e2e",
    "test:e2e:headful": "HEADLESS=false npm run test:e2e",
    "test:bdd": "cucumber-js tests/bdd/features --require tests/bdd/step-definitions --require tests/bdd/support",
    "test:bdd:watch": "nodemon --watch tests/bdd --exec 'npm run test:bdd'",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:bdd && npm run test:e2e",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

## Day 3-5: BDD Implementation

### Step Definition Organization by Feature

Following your preference for feature-based organization:

```javascript
// tests/bdd/step-definitions/auction-monitoring.steps.js
const { Given, When, Then } = require('@cucumber/cucumber');
const { AuctionFactory } = require('../../__support__/factories/auctionFactory');

// Reusable step definitions for auction monitoring
Given('an auction {string} exists with current bid ${float}', async function(auctionId, currentBid) {
  const auction = AuctionFactory.create({ id: auctionId, currentBid });
  await this.storage.set(`auction:${auctionId}`, JSON.stringify(auction));
});

Given('I am monitoring auction {string}', async function(auctionId) {
  await this.auctionMonitor.startMonitoring(auctionId);
  this.currentAuctionId = auctionId;
});

When('I start monitoring auction {string}', async function(auctionId) {
  const result = await this.auctionMonitor.startMonitoring(auctionId);
  this.lastResult = result;
});

Then('the auction should appear in my monitored list', async function() {
  const monitored = await this.auctionMonitor.getMonitoredAuctions();
  expect(monitored).toContain(this.currentAuctionId);
});

// tests/bdd/step-definitions/bidding-strategies.steps.js
const { Given, When, Then } = require('@cucumber/cucumber');
const { BidFactory } = require('../../__support__/factories/bidFactory');

Given('I am using the {word} bidding strategy', function(strategy) {
  this.currentStrategy = strategy;
  this.auctionMonitor.setStrategy(this.currentAuctionId, strategy);
});

Given('I have set my maximum bid to ${float}', function(maxBid) {
  this.maxBid = maxBid;
  this.auctionMonitor.setMaxBid(this.currentAuctionId, maxBid);
});

When('another user bids ${float}', async function(amount) {
  const bid = BidFactory.create({ 
    auctionId: this.currentAuctionId, 
    amount,
    userId: 'competitor'
  });
  await this.auctionMonitor.handleCompetingBid(bid);
});

Then('I should automatically bid ${float}', async function(expectedBid) {
  const myBids = await this.storage.get(`bids:${this.currentAuctionId}:${this.userId}`);
  const lastBid = JSON.parse(myBids).pop();
  expect(lastBid.amount).toBe(expectedBid);
});
```

### Happy Path Scenarios First

Based on your preference for happy paths:

```gherkin
# tests/bdd/features/auction-monitoring/happy-path.feature
@happy-path @smoke
Feature: Auction Monitoring Happy Path
  As an auction participant
  I want to monitor auctions successfully
  So that I can participate in bidding

  Background:
    Given I am authenticated as a valid user
    And the system is running normally

  Scenario: Successfully start monitoring an auction
    Given an auction "ABC123" exists with current bid $50.00
    When I start monitoring auction "ABC123"
    Then the monitoring should be successful
    And I should receive real-time updates
    And the auction should appear in my monitored list

  Scenario: Successfully stop monitoring an auction
    Given I am monitoring auction "XYZ789"
    When I stop monitoring auction "XYZ789"
    Then the monitoring should stop
    And I should not receive further updates
    And the auction should not appear in my monitored list

# tests/bdd/features/bidding-strategies/happy-path.feature
@happy-path @bidding
Feature: Bidding Strategies Happy Path
  As an auction participant
  I want my bidding strategy to work correctly
  So that I can win auctions efficiently

  Scenario: Manual bidding strategy
    Given an auction "MAN001" exists with current bid $100.00
    And I am monitoring auction "MAN001"
    And I am using the manual bidding strategy
    When I manually place a bid of $125.00
    Then my bid should be accepted
    And I should be the high bidder

  Scenario: Aggressive bidding strategy
    Given an auction "AGG001" exists with current bid $100.00
    And I am monitoring auction "AGG001"
    And I am using the aggressive bidding strategy
    And I have set my maximum bid to $200.00
    When another user bids $125.00
    Then I should automatically bid $130.00
    And I should be the high bidder
```

## Test Documentation

Create `tests/README.md`:

```markdown
# Test Suite Documentation

## Overview
This test suite uses Jest for unit/integration/e2e tests and Cucumber for BDD tests.

## Structure
- `__fixtures__/`: Test data (deprecated - use factories)
- `__mocks__/`: Mock implementations for external dependencies
- `__support__/`: Shared test utilities and factories
- `unit/`: Unit tests for individual modules
- `integration/`: Integration tests for API and services
- `e2e/`: End-to-end tests with Puppeteer
- `bdd/`: Behavior-driven development tests with Cucumber

## Running Tests

```bash
npm test              # Run all tests (for production deployment)
npm run test:unit    # Run unit tests only
npm run test:bdd     # Run BDD tests only
npm run test:watch   # Run tests in watch mode
```

## Test Data
We use factory patterns for test data generation:

```javascript
const { AuctionFactory, UserFactory } = require('./__support__/factories');

// Create test auction
const auction = AuctionFactory.create({ currentBid: 150 });

// Create ending auction
const endingAuction = AuctionFactory.createEnding();
```

## Mocking Strategy
- All external APIs (Nellis) are mocked
- Redis is mocked using `__mocks__/ioredis.js`
- No real network calls in tests
- Factories provide consistent test data

## Writing Tests
1. Follow existing patterns in the codebase
2. Organize step definitions by feature
3. Reuse step definitions to avoid duplication
4. Focus on happy paths first, then edge cases
5. Use descriptive test names

## Best Practices
- Keep tests isolated and independent
- Clean up test data after each test
- Use factories for complex data structures
- Mock external dependencies consistently
- Write tests before implementing features (BDD)
```

## Implementation Timeline

- **Day 1**: Set up branch, reorganize directories, consolidate configs
- **Day 2**: Implement factories, update imports, test all existing tests pass
- **Days 3-5**: Implement BDD scenarios following happy path approach
- **Extension**: Available if needed beyond 2 days for reorganization

This implementation guide provides a clear path forward based on all your requirements and preferences.