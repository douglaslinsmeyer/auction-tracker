# Testing Strategy

## Core Testing Principle (Validated in Phase 3)
**Any time we create new functionality or modify existing functionality, we must update our tests and run them. If they fail, we must fix them until they pass.**

**Phase 3 Proof**: This principle saved us multiple times during wrapper implementation.

## Test Categories

### 1. Unit Tests ✅ **HIGHLY EFFECTIVE**
**Purpose**: Test individual components in isolation  
**Phase 3 Results**: 47 passing tests, caught 8 implementation bugs early

```javascript
// Pattern proven in Phase 3
describe('PollingQueueWrapper', () => {
  beforeEach(() => {
    featureFlags.isEnabled.mockReturnValue(true);
    wrapper = new PollingQueueWrapper(mockStorage, mockApi, mockLogger);
  });

  it('should enqueue auctions with correct priority', () => {
    const auction = { data: { timeRemaining: 30, isWinning: false } };
    const priority = wrapper._calculatePriority(auction);
    
    expect(priority).toBeLessThan(1000); // Higher priority for ending soon
  });
});
```

**Best Practices Learned**:
- Mock feature flags for predictable testing
- Test both enabled and disabled states
- Use realistic data structures
- Test edge cases (null data, invalid input)

### 2. Integration Tests ✅ **CRITICAL FOR COMPATIBILITY**
**Purpose**: Test component interactions and Chrome extension compatibility

```javascript
// Pattern that prevented breaking changes
describe('Chrome Extension Compatibility', () => {
  it('should work with legacy singleton import', async () => {
    const auctionMonitor = require('./services/auctionMonitor');
    const result = await auctionMonitor.addAuction('123', {
      strategy: 'manual',
      maxBid: 100
    });
    expect(result).toBe(true);
  });

  it('should work with modern class wrapper', async () => {
    const monitor = new AuctionMonitorClass();
    const result = await monitor.addAuction('123', {
      strategy: 'manual', 
      maxBid: 100
    });
    expect(result).toBe(true);
  });
});
```

### 3. BDD Tests (Cucumber) ✅ **EXCELLENT FOR BEHAVIOR DOCUMENTATION**
**Purpose**: Test business behaviors and document feature requirements

```gherkin
# Pattern that documented expected behavior clearly
Feature: Polling Queue Performance
  Background:
    Given I am authenticated with a valid token
    And the external auction API is available

  @performance
  Scenario: Legacy polling continues when feature disabled
    Given the polling queue feature is disabled
    When I start monitoring 5 auctions
    Then each auction should have its own polling timer
    And the system should use individual setInterval calls

  @performance  
  Scenario: Polling queue manages updates when enabled
    Given the polling queue feature is enabled
    When I start monitoring 5 auctions
    Then all auctions should be added to the polling queue
    And only one polling worker should be active
    And CPU usage should be lower than legacy polling
```

**BDD Success Factors**:
- Clear business language in scenarios
- Background steps for common setup
- Tags for organizing test runs (@performance, @load, etc.)
- Step definitions that match natural language

### 4. Performance Tests ✅ **ESSENTIAL FOR OPTIMIZATION**
**Purpose**: Ensure no performance regression and validate improvements

```javascript
// Pattern that validated performance improvements
describe('Performance Benchmarks', () => {
  let cpuMonitor;

  beforeEach(() => {
    cpuMonitor = new CPUMonitor();
  });

  it('should handle 100 auctions efficiently with queue enabled', async () => {
    featureFlags.enable('USE_POLLING_QUEUE');
    
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    // Add 100 auctions
    for (let i = 0; i < 100; i++) {
      await monitor.addAuction(`auction-${i}`, config);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Let queue process
    
    const duration = Date.now() - startTime;
    const memoryIncrease = process.memoryUsage().heapUsed - startMemory;
    const cpuUsage = cpuMonitor.getUsage();
    
    expect(duration).toBeLessThan(5000);
    expect(memoryIncrease / 1024 / 1024).toBeLessThan(50); // <50MB
    expect(cpuUsage).toBeLessThan(50); // <50% CPU
  });
});
```

## Testing Patterns

### 1. Feature Flag Testing ✅ **MANDATORY PATTERN**
Every feature must be tested with flag ON and OFF:

```javascript
describe('Feature: Polling Queue', () => {
  describe('when enabled', () => {
    beforeEach(() => {
      process.env.USE_POLLING_QUEUE = 'true';
    });
    
    it('should use queue for updates', () => {
      // Test new behavior
    });
  });
  
  describe('when disabled', () => {
    beforeEach(() => {
      process.env.USE_POLLING_QUEUE = 'false';
    });
    
    it('should use legacy polling', () => {
      // Test old behavior still works
    });
  });
});
```

### 2. Wrapper Testing
Test both delegation and enhancement:

```javascript
describe('Wrapper Pattern', () => {
  it('should delegate to singleton by default', () => {
    const wrapper = new ServiceWrapper();
    const spy = sinon.spy(wrapper._singleton, 'method');
    
    wrapper.method();
    expect(spy).toHaveBeenCalled();
  });
  
  it('should enhance behavior when feature enabled', () => {
    process.env.USE_ENHANCEMENT = 'true';
    const wrapper = new ServiceWrapper();
    
    const result = wrapper.method();
    expect(result).toHaveProperty('enhanced', true);
  });
});
```

### 3. Backward Compatibility Testing
Ensure nothing breaks:

```javascript
describe('Backward Compatibility', () => {
  const testCases = [
    { name: 'direct import', import: () => require('./service') },
    { name: 'destructured import', import: () => require('./services').service },
    { name: 'DI container', import: () => container.get('service') }
  ];
  
  testCases.forEach(({ name, import: getService }) => {
    it(`should work with ${name}`, () => {
      const service = getService();
      expect(service.method).toBeDefined();
      expect(() => service.method()).not.toThrow();
    });
  });
});
```

## BDD Test Implementation Plan

### 186 Scenarios Organized by Priority

#### Priority 1: Core Business Logic (50 scenarios)
```gherkin
Feature: Auction Monitoring
  - Start monitoring
  - Stop monitoring  
  - Update configuration
  - Handle auction end
  - Recover from restart

Feature: Bidding Strategies
  - Manual bidding
  - Aggressive auto-bid
  - Last-second sniping
  - Max bid enforcement
  - Bid increment logic

Feature: Real-time Updates
  - WebSocket connection
  - Auction state broadcast
  - Error propagation
  - Reconnection logic
```

#### Priority 2: Edge Cases (80 scenarios)
```gherkin
Feature: Error Handling
  - Network failures
  - API timeouts
  - Invalid data
  - Authentication expiry
  - Rate limit exceeded

Feature: Concurrent Operations
  - Multiple bid attempts
  - Simultaneous updates
  - Race conditions
  - State conflicts

Feature: Resource Management
  - Memory limits
  - Connection limits
  - Storage failures
  - Cleanup operations
```

#### Priority 3: Integration (56 scenarios)
```gherkin
Feature: Chrome Extension
  - Message passing
  - State synchronization
  - Error reporting
  - Version compatibility

Feature: System Integration
  - Redis availability
  - API health checks
  - Performance degradation
  - Graceful shutdown
```

## Test Execution Strategy

### Continuous Integration
```yaml
# Run on every commit
on-commit:
  - unit-tests
  - integration-tests
  - backward-compatibility-tests

# Run on PR
on-pr:
  - all-tests
  - performance-benchmarks
  - chrome-extension-tests

# Nightly
nightly:
  - full-bdd-suite
  - load-tests
  - security-scans
```

### Local Development
```bash
# Before committing
npm run test:unit
npm run test:compat

# Before major changes
npm run test:all

# When adding features
npm run test:bdd -- --grep "feature name"
```

## Metrics and Coverage

### Coverage Goals
- **Unit Tests**: 80% coverage
- **Integration Tests**: All API endpoints
- **BDD Tests**: All 186 scenarios
- **Performance Tests**: Baseline + regression

### Test Quality Metrics
- **Flakiness**: <1% failure rate
- **Speed**: Unit tests <30s, Integration <2m
- **Isolation**: No test dependencies
- **Clarity**: Clear failure messages

## Anti-Patterns to Avoid

### 1. Testing Implementation Details
❌ BAD:
```javascript
it('should call internal method', () => {
  expect(service._internalMethod).toHaveBeenCalled();
});
```

✅ GOOD:
```javascript
it('should return expected result', () => {
  expect(service.publicMethod()).toBe(expectedResult);
});
```

### 2. Skipping Backward Compatibility
❌ BAD: Only testing new code
✅ GOOD: Testing both old and new patterns work

### 3. Ignoring Feature Flags
❌ BAD: Assuming features are always on
✅ GOOD: Testing all flag combinations

## Test Maintenance

### When Tests Fail
1. **Understand why** - Is it a real bug or test issue?
2. **Fix the cause** - Don't just update assertions
3. **Add missing tests** - If bug wasn't caught
4. **Update documentation** - If behavior changed

### Keeping Tests Fast
1. Use test doubles for external services
2. Parallelize where possible
3. Skip slow tests in watch mode
4. Use focused tests during development

### Test Data Management
1. Use factories for consistent test data
2. Clean up after each test
3. Avoid hard-coded values
4. Use meaningful test descriptions

## Conclusion

Our testing strategy ensures that:
1. **Nothing breaks** - Backward compatibility tests
2. **Features work** - BDD scenarios
3. **Performance maintained** - Benchmark tests
4. **Quality improves** - Coverage metrics

The wrapper pattern makes testing easier by providing clear seams for test doubles and feature flags.