# Behavior-Driven Development Testing Plan for Nellis Auction Backend (Original)

> **Note**: This is the original BDD testing plan created before Phase 0 discovery. 
> For the current plan incorporating all Phase 0 findings, see [BDD Testing Plan (Updated)](./BDD_TESTING_PLAN.md).

## Overview

This plan outlines a comprehensive approach to rewriting the testing framework using Behavior-Driven Development (BDD) principles, along with necessary refactoring to improve testability.

## Phase 0: Discovery and Analysis (Week 1)

### 0.1 Deep Codebase Analysis
**CRITICAL**: Before writing any tests, conduct a thorough analysis of the existing codebase to understand all functionality.

#### Discovery Process:
1. **Code Archaeology**
   - Read through all service implementations
   - Document all API endpoints and their behaviors
   - Map WebSocket event flows
   - Identify all business rules and edge cases
   - Document error handling patterns

2. **Behavior Documentation**
   - Create a comprehensive list of all application behaviors
   - Group behaviors by domain (auction monitoring, bidding, authentication, etc.)
   - Identify critical vs. nice-to-have functionality
   - Document undocumented behaviors found in code

3. **Architecture Review**
   - Question existing implementation strategies
   - Identify architectural smells
   - Evaluate if current patterns are appropriate
   - Document areas needing architectural changes

### 0.2 BDD Test Documentation Phase

#### Step 1: Initial BDD Test Generation
Create comprehensive BDD tests that document ALL discovered functionality:

```gherkin
# tests/features/draft/auction-monitoring-complete.feature
Feature: Complete Auction Monitoring Behaviors
  # Document every behavior found in the codebase
  
  Scenario: Monitor auction with immediate update
  Scenario: Monitor auction that's about to end
  Scenario: Monitor auction with rapid bid changes
  Scenario: Handle monitoring when authentication expires
  Scenario: Recover monitoring after service restart
  # ... continue for all discovered behaviors
```

#### Step 2: Review and Refinement
**MANDATORY**: Take a second pass through all generated BDD tests to ensure:

1. **Effectiveness Checklist**:
   - [ ] Does the test accurately describe the business behavior?
   - [ ] Are all edge cases covered?
   - [ ] Is the language clear to non-technical stakeholders?
   - [ ] Are the scenarios independent and atomic?
   - [ ] Do the tests avoid implementation details?

2. **Efficiency Checklist**:
   - [ ] Are scenarios DRY (using Background, Scenario Outlines)?
   - [ ] Is test data minimal but sufficient?
   - [ ] Can scenarios run in parallel?
   - [ ] Are common steps reusable?
   - [ ] Is the execution time reasonable?

3. **Review Process**:
   ```
   For each feature file:
   1. Read through all scenarios
   2. Check against effectiveness criteria
   3. Check against efficiency criteria
   4. Refactor scenarios as needed
   5. Get stakeholder review if possible
   6. Document any unclear business rules
   ```

### 0.3 Architecture Assessment

Before beginning refactoring, conduct a critical review of the current architecture:

#### Questions to Answer:
1. **Service Boundaries**
   - Are services correctly scoped?
   - Should AuctionMonitor be split into smaller services?
   - Is NellisApi doing too much?

2. **Data Flow**
   - Is the current event-driven approach appropriate?
   - Should we use CQRS for auction state?
   - Is the polling mechanism the best approach?

3. **State Management**
   - Should auction state be in a state machine?
   - Is the current storage abstraction sufficient?
   - Do we need event sourcing for audit trails?

4. **Scalability**
   - Can the current architecture handle 1000+ auctions?
   - Are there bottlenecks in the polling mechanism?
   - Should we use a message queue?

#### Architecture Refactoring Plan Template:
```markdown
# Architecture Refactoring Recommendations

## Current Issues:
1. [Issue description]
   - Impact: [High/Medium/Low]
   - Effort: [High/Medium/Low]
   - Recommendation: [Specific change]

## Proposed Changes:
1. **Service Reorganization**
   - Split AuctionMonitor into:
     - AuctionStateManager
     - BiddingEngine
     - PollingOrchestrator
   
2. **State Machine Implementation**
   - Define clear auction states
   - Implement state transitions
   - Add state validation

3. **Event Sourcing** (if applicable)
   - Store all auction events
   - Enable replay capability
   - Improve debugging

## Migration Strategy:
[Step-by-step plan for architectural changes]
```

## Phase 1: Foundation Setup (Week 2)

### 1.1 BDD Testing Framework Setup
- **Install BDD tools**:
  - `jest-cucumber` for Gherkin-style BDD tests
  - `@cucumber/cucumber` for feature file support
  - `chai` for more expressive assertions
  - `sinon` for advanced mocking capabilities

### 1.2 Project Structure Reorganization
```
tests/
├── features/           # Gherkin feature files
│   ├── auction-monitoring.feature
│   ├── bidding-strategies.feature
│   ├── websocket-communication.feature
│   └── authentication.feature
├── step-definitions/   # Step implementation
│   ├── auction-steps.js
│   ├── bidding-steps.js
│   └── common-steps.js
├── support/           # Test utilities
│   ├── world.js       # Test context
│   ├── hooks.js       # Before/After hooks
│   └── helpers/       # Test helpers
├── unit/              # Unit tests (BDD style)
│   ├── services/
│   ├── controllers/
│   └── models/
└── integration/       # Integration tests

src/
├── services/          # Refactored services
│   ├── interfaces/    # Service interfaces
│   ├── implementations/
│   └── factories/     # Service factories
├── controllers/       # HTTP/WebSocket controllers
├── models/           # Data models
├── repositories/     # Data access layer
└── container/        # Dependency injection

```

## Phase 2: Core Refactoring for Testability (Week 1-2)

### 2.1 Service Interface Definition

```javascript
// src/services/interfaces/IAuctionMonitor.js
class IAuctionMonitor {
  async startMonitoring(auctionId, config) { throw new Error('Not implemented'); }
  async stopMonitoring(auctionId) { throw new Error('Not implemented'); }
  async placeBid(auctionId, amount) { throw new Error('Not implemented'); }
  getMonitoredAuctions() { throw new Error('Not implemented'); }
}

// src/services/interfaces/INellisApi.js
class INellisApi {
  async authenticate(cookies) { throw new Error('Not implemented'); }
  async getAuctionData(auctionId) { throw new Error('Not implemented'); }
  async placeBid(auctionId, amount) { throw new Error('Not implemented'); }
}

// src/services/interfaces/IStorage.js
class IStorage {
  async saveAuction(auctionId, data) { throw new Error('Not implemented'); }
  async getAuction(auctionId) { throw new Error('Not implemented'); }
  async deleteAuction(auctionId) { throw new Error('Not implemented'); }
  async getAllAuctions() { throw new Error('Not implemented'); }
}
```

### 2.2 Dependency Injection Container

```javascript
// src/container/ServiceContainer.js
class ServiceContainer {
  constructor() {
    this.services = new Map();
    this.factories = new Map();
  }

  register(name, factory, options = {}) {
    this.factories.set(name, { factory, options });
    if (options.singleton) {
      this.services.set(name, factory(this));
    }
  }

  get(name) {
    if (this.services.has(name)) {
      return this.services.get(name);
    }
    
    const registration = this.factories.get(name);
    if (!registration) {
      throw new Error(`Service ${name} not registered`);
    }
    
    if (registration.options.singleton) {
      const instance = registration.factory(this);
      this.services.set(name, instance);
      return instance;
    }
    
    return registration.factory(this);
  }

  reset() {
    this.services.clear();
  }
}
```

### 2.3 Service Factory Pattern

```javascript
// src/services/factories/auctionMonitorFactory.js
function createAuctionMonitor(container) {
  const nellisApi = container.get('nellisApi');
  const storage = container.get('storage');
  const eventBus = container.get('eventBus');
  
  return new AuctionMonitor({
    nellisApi,
    storage,
    eventBus,
    pollingInterval: process.env.POLLING_INTERVAL || 5000
  });
}

// src/services/implementations/AuctionMonitor.js
class AuctionMonitor extends IAuctionMonitor {
  constructor({ nellisApi, storage, eventBus, pollingInterval }) {
    super();
    this.nellisApi = nellisApi;
    this.storage = storage;
    this.eventBus = eventBus;
    this.pollingInterval = pollingInterval;
    this.monitors = new Map();
  }
  
  // Implementation with injected dependencies
}
```

## Phase 3: BDD Test Implementation (Week 3-4)

### 3.1 Comprehensive Feature Documentation

**IMPORTANT**: These feature files must be created AFTER Phase 0 discovery and reviewed for effectiveness and efficiency.

#### Example: Discovered Behaviors to BDD Tests

```gherkin
# tests/features/auction-monitoring-discovered.feature
Feature: Auction Monitoring - Complete Behaviors
  As documented during Phase 0 discovery
  
  # Discovered Behavior 1: Polling interval increases for stable auctions
  Scenario: Adaptive polling for stable auctions
    Given an auction "12345" with no bids for 10 minutes
    When the monitor polls for updates
    Then the polling interval should increase to 10 seconds
    And system resources should be conserved
  
  # Discovered Behavior 2: Rapid polling near auction end
  Scenario Outline: Aggressive polling near auction end
    Given an auction "12345" with <time> seconds remaining
    When monitoring is active
    Then polling interval should be <interval> seconds
    
    Examples:
      | time | interval |
      | 300  | 5        |
      | 60   | 2        |
      | 30   | 1        |
  
  # Discovered Behavior 3: Bid validation before placement
  Scenario: Prevent invalid bids
    Given an auction with minimum increment of $5
    And current bid is $100
    When I attempt to bid $102
    Then the bid should be rejected
    And I should see "Bid must be at least $105"
  
  # Discovered Edge Case: Authentication token expiry
  Scenario: Handle authentication expiry during monitoring
    Given I am monitoring 5 auctions
    When my authentication token expires
    Then monitoring should pause for all auctions
    And I should receive an "auth-required" notification
    And auction states should be preserved
    
  # Discovered Business Rule: Soft auction endings
  Scenario: Soft ending extends auction time
    Given an auction ending at 2:00:00 PM
    When a bid is placed at 1:59:35 PM
    Then auction end time should extend to 2:00:30 PM
    And all watchers should be notified of extension
```

### 3.2 Second-Pass Review Template

```gherkin
# tests/features/review-template.md
## Feature: [Feature Name]
### Review Date: [Date]
### Reviewer: [Name]

#### Effectiveness Review:
- [ ] Business value clear in feature description
- [ ] All discovered behaviors covered
- [ ] Edge cases from code analysis included
- [ ] Error scenarios documented
- [ ] Language understandable by stakeholders

#### Efficiency Review:
- [ ] Duplicate scenarios consolidated
- [ ] Common steps extracted to Background
- [ ] Data tables used where appropriate
- [ ] Scenario Outlines for parameterized tests
- [ ] No implementation details in scenarios

#### Improvements Made:
1. [List of changes after review]
2. [...]

#### Questions for Stakeholders:
1. [Unclear business rules]
2. [...]
```

```gherkin
# tests/features/bidding-strategies.feature
Feature: Automated Bidding Strategies
  As a user
  I want to use different bidding strategies
  So that I can bid effectively on auctions

  Background:
    Given I am authenticated
    And I am monitoring auction "12345"

  Scenario: Aggressive bidding strategy
    Given my bidding strategy is "aggressive"
    And my maximum bid is $100
    And the current bid is $50
    When another user places a bid of $55
    Then I should automatically bid $60
    And my bid history should show the automatic bid

  Scenario: Last-second bidding strategy
    Given my bidding strategy is "last-second"
    And my maximum bid is $100
    And the auction has 10 seconds remaining
    When the timer reaches 5 seconds
    Then I should place a bid of the next increment
    And the bid should be confirmed before auction ends

  Scenario: Maximum bid limit enforcement
    Given my bidding strategy is "aggressive"
    And my maximum bid is $100
    And the current bid is $95
    When another user places a bid of $100
    Then I should not place an automatic bid
    And I should receive a "max-bid-reached" notification
```

### 3.2 Step Definitions

```javascript
// tests/step-definitions/auction-steps.js
const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('chai');

Given('I am authenticated with valid cookies', async function() {
  this.cookies = 'valid-test-cookies';
  await this.container.get('nellisApi').authenticate(this.cookies);
});

Given('an auction {string} exists with status {string}', async function(auctionId, status) {
  this.mockAuction = {
    id: auctionId,
    status,
    currentBid: 50,
    timeRemaining: 3600
  };
  
  this.nellisApiMock.getAuctionData
    .withArgs(auctionId)
    .resolves(this.mockAuction);
});

When('I start monitoring auction {string}', async function(auctionId) {
  const auctionMonitor = this.container.get('auctionMonitor');
  await auctionMonitor.startMonitoring(auctionId, {
    maxBid: 100,
    strategy: 'aggressive',
    autoBid: true
  });
});

Then('auction {string} should be in the monitored list', function(auctionId) {
  const auctionMonitor = this.container.get('auctionMonitor');
  const monitoredAuctions = auctionMonitor.getMonitoredAuctions();
  expect(monitoredAuctions).to.have.property(auctionId);
});
```

### 3.3 Test Context (World)

```javascript
// tests/support/world.js
const { setWorldConstructor } = require('@cucumber/cucumber');
const sinon = require('sinon');
const { ServiceContainer } = require('../../src/container/ServiceContainer');

class TestWorld {
  constructor() {
    this.container = new ServiceContainer();
    this.mocks = {};
    this.spies = {};
    this.events = [];
  }

  setupMocks() {
    // Create mocks for all services
    this.nellisApiMock = {
      authenticate: sinon.stub().resolves(true),
      getAuctionData: sinon.stub(),
      placeBid: sinon.stub()
    };

    this.storageMock = {
      saveAuction: sinon.stub().resolves(),
      getAuction: sinon.stub(),
      deleteAuction: sinon.stub().resolves(),
      getAllAuctions: sinon.stub().resolves([])
    };

    this.eventBusMock = {
      emit: sinon.spy((event, data) => {
        this.events.push({ event, data });
      }),
      on: sinon.stub()
    };

    // Register mocks in container
    this.container.register('nellisApi', () => this.nellisApiMock);
    this.container.register('storage', () => this.storageMock);
    this.container.register('eventBus', () => this.eventBusMock);
  }

  reset() {
    this.container.reset();
    sinon.restore();
    this.events = [];
  }
}

setWorldConstructor(TestWorld);
```

## Phase 4: Unit Testing with BDD Style (Week 3)

### 4.1 BDD-Style Unit Tests

```javascript
// tests/unit/services/AuctionMonitor.spec.js
describe('AuctionMonitor', () => {
  let container;
  let auctionMonitor;
  let nellisApiMock;
  let storageMock;

  beforeEach(() => {
    container = new ServiceContainer();
    setupMocks();
    auctionMonitor = container.get('auctionMonitor');
  });

  describe('when starting to monitor an auction', () => {
    const auctionId = '12345';
    const config = { maxBid: 100, strategy: 'aggressive' };

    beforeEach(() => {
      nellisApiMock.getAuctionData.resolves({
        id: auctionId,
        status: 'active',
        currentBid: 50
      });
    });

    it('should fetch the auction data', async () => {
      await auctionMonitor.startMonitoring(auctionId, config);
      
      expect(nellisApiMock.getAuctionData).to.have.been.calledWith(auctionId);
    });

    it('should save the auction to storage', async () => {
      await auctionMonitor.startMonitoring(auctionId, config);
      
      expect(storageMock.saveAuction).to.have.been.calledWith(
        auctionId,
        sinon.match.has('config', config)
      );
    });

    it('should start polling for updates', async () => {
      await auctionMonitor.startMonitoring(auctionId, config);
      
      expect(auctionMonitor.isMonitoring(auctionId)).to.be.true;
    });

    describe('and the auction does not exist', () => {
      beforeEach(() => {
        nellisApiMock.getAuctionData.rejects(new Error('Auction not found'));
      });

      it('should throw an error', async () => {
        await expect(
          auctionMonitor.startMonitoring(auctionId, config)
        ).to.be.rejectedWith('Auction not found');
      });

      it('should not save to storage', async () => {
        try {
          await auctionMonitor.startMonitoring(auctionId, config);
        } catch (e) {}
        
        expect(storageMock.saveAuction).not.to.have.been.called;
      });
    });
  });
});
```

## Phase 5: Integration Testing (Week 4)

### 5.1 API Integration Tests

```javascript
// tests/integration/api/auction-endpoints.spec.js
describe('Auction API Endpoints', () => {
  let app;
  let container;

  beforeEach(async () => {
    container = createTestContainer();
    app = createApp(container);
  });

  describe('POST /api/auctions/:id/monitor', () => {
    it('should start monitoring an auction', async () => {
      const response = await request(app)
        .post('/api/auctions/12345/monitor')
        .set('Authorization', 'test-token')
        .send({
          maxBid: 100,
          strategy: 'aggressive',
          autoBid: true
        });

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message', 'Monitoring started');
    });
  });
});
```

### 5.2 WebSocket Integration Tests

```javascript
// tests/integration/websocket/auction-updates.spec.js
describe('WebSocket Auction Updates', () => {
  let wsClient;
  let wsServer;
  let container;

  beforeEach(async () => {
    container = createTestContainer();
    wsServer = createWebSocketServer(container);
    wsClient = new WebSocketTestClient(wsServer.url);
    await wsClient.connect();
  });

  it('should receive updates when auction data changes', async () => {
    // Start monitoring
    await wsClient.send('startMonitoring', { auctionId: '12345' });
    
    // Simulate auction update
    const auctionMonitor = container.get('auctionMonitor');
    await auctionMonitor.updateAuction('12345', { currentBid: 75 });
    
    // Verify update received
    const update = await wsClient.waitForMessage('auctionUpdate');
    expect(update.auctionId).to.equal('12345');
    expect(update.data.currentBid).to.equal(75);
  });
});
```

## Phase 6: Test Data Management (Week 4)

### 6.1 Test Data Builders

```javascript
// tests/support/builders/AuctionBuilder.js
class AuctionBuilder {
  constructor() {
    this.auction = {
      id: '12345',
      title: 'Test Auction',
      status: 'active',
      currentBid: 0,
      bidIncrement: 5,
      timeRemaining: 3600,
      totalBids: 0
    };
  }

  withId(id) {
    this.auction.id = id;
    return this;
  }

  withCurrentBid(amount) {
    this.auction.currentBid = amount;
    return this;
  }

  withTimeRemaining(seconds) {
    this.auction.timeRemaining = seconds;
    return this;
  }

  aboutToEnd() {
    this.auction.timeRemaining = 30;
    return this;
  }

  ended() {
    this.auction.status = 'ended';
    this.auction.timeRemaining = 0;
    return this;
  }

  build() {
    return { ...this.auction };
  }
}
```

## Phase 7: Performance and Load Testing (Week 5)

### 7.1 Performance Tests

```javascript
// tests/performance/concurrent-monitoring.spec.js
describe('Concurrent Auction Monitoring Performance', () => {
  it('should handle 100 concurrent auctions', async () => {
    const auctionIds = Array.from({ length: 100 }, (_, i) => `auction-${i}`);
    
    const startTime = Date.now();
    
    await Promise.all(
      auctionIds.map(id => 
        auctionMonitor.startMonitoring(id, { maxBid: 100 })
      )
    );
    
    const duration = Date.now() - startTime;
    expect(duration).to.be.below(5000); // Should complete in under 5 seconds
    
    const monitoredCount = auctionMonitor.getMonitoredAuctions().size;
    expect(monitoredCount).to.equal(100);
  });
});
```

## Phase 8: Continuous Integration (Week 5)

### 8.1 Test Scripts

```json
// package.json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:integration && npm run test:e2e",
    "test:unit": "jest --testMatch='**/unit/**/*.spec.js'",
    "test:integration": "jest --testMatch='**/integration/**/*.spec.js'",
    "test:e2e": "cucumber-js tests/features",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage --coverageThreshold='{\"global\":{\"branches\":80,\"functions\":80,\"lines\":80,\"statements\":80}}'",
    "test:performance": "jest --testMatch='**/performance/**/*.spec.js'"
  }
}
```

### 8.2 GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      redis:
        image: redis:6-alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npm run test:e2e
      - run: npm run test:coverage
      
      - uses: codecov/codecov-action@v2
```

## Implementation Timeline

### Week 1: Discovery and Analysis (Phase 0)
- Deep codebase analysis and behavior documentation
- Architecture assessment and critique
- Generate comprehensive BDD tests from discovered behaviors
- Review and refine BDD tests for effectiveness/efficiency
- Create architecture refactoring recommendations

### Week 2: Foundation (Phase 1)
- Set up BDD testing framework
- Create service interfaces based on Phase 0 findings
- Implement dependency injection container
- Address critical architecture issues identified

### Week 3: Core Refactoring (Phase 2)
- Refactor services to use dependency injection
- Implement architecture improvements from Phase 0
- Create service factories
- Update initialization flow

### Week 4: BDD Tests (Phase 3)
- Implement reviewed feature files from Phase 0
- Create step definitions
- Write BDD-style unit tests
- Ensure all discovered behaviors are tested

### Week 5: Integration & Data (Phase 4)
- Write integration tests
- Create test data builders
- Set up test fixtures
- Validate architecture changes

### Week 6: Performance & CI (Phase 5)
- Add performance tests
- Configure CI/CD pipeline
- Achieve 80%+ test coverage
- Final review of test effectiveness

## Success Metrics

1. **Test Coverage**: Achieve minimum 80% code coverage
2. **Test Execution Time**: All tests complete in under 2 minutes
3. **Test Reliability**: Zero flaky tests
4. **Code Quality**: All services testable in isolation
5. **Documentation**: All features documented with Gherkin scenarios
6. **Maintainability**: New features require minimal test setup

## Best Practices

1. **Write tests first**: Follow true TDD/BDD approach
2. **Keep tests isolated**: Each test should be independent
3. **Use descriptive names**: Test names should describe behavior
4. **Mock external dependencies**: Never hit real APIs in tests
5. **Test edge cases**: Include error scenarios and boundaries
6. **Maintain test data**: Use builders for consistent test data
7. **Regular refactoring**: Keep tests clean and maintainable