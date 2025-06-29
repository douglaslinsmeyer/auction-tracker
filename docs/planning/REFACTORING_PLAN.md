# Refactoring Plan for Testability

## Overview

This document outlines the step-by-step refactoring plan to transform the codebase from singleton-based services to a dependency injection architecture that supports BDD testing.

## Phase 0: Architecture Assessment (Before Refactoring)

### Critical Questions to Address

Before beginning any refactoring, we must critically examine if our current implementation strategies are appropriate:

#### 1. Service Design Review

**AuctionMonitor Service**
- **Current**: Monolithic service handling monitoring, bidding, and state management
- **Questions**:
  - Should this be split into AuctionStateManager, BiddingEngine, and MonitoringOrchestrator?
  - Is the EventEmitter pattern the right choice for internal communication?
  - Should we implement a proper state machine for auction states?

**NellisApi Service**
- **Current**: Direct API wrapper with cookie management
- **Questions**:
  - Should authentication be a separate service?
  - Is the retry logic appropriately placed here?
  - Should we implement circuit breaker pattern for API calls?

**Storage Service**
- **Current**: Dual Redis/Memory implementation
- **Questions**:
  - Is the fallback pattern properly implemented?
  - Should we use Repository pattern for data access?
  - Do we need event sourcing for auction history?

#### 2. Architectural Patterns Review

**Current Polling Mechanism**
```javascript
// Current: Individual timers per auction
setInterval(() => this.checkAuction(auctionId), 5000);
```
- **Issues**: Inefficient, doesn't scale, hard to test
- **Alternative**: Queue-based polling with worker pool
- **Alternative**: WebSocket subscription to auction service

**State Management**
```javascript
// Current: Direct Map storage
this.monitoredAuctions = new Map();
```
- **Issues**: No state validation, no history, hard to debug
- **Alternative**: State machine with defined transitions
- **Alternative**: Event sourcing with replay capability

**Error Handling**
- **Current**: Try-catch blocks with console.log
- **Issues**: No structured error handling, poor observability
- **Alternative**: Error boundary pattern with recovery strategies
- **Alternative**: Result<T, E> pattern for explicit error handling

#### 3. Scalability Concerns

**Questions to Answer**:
1. Can the current architecture handle 1000+ concurrent auctions?
2. What happens when Redis is down for extended periods?
3. How do we handle partial failures in bid placement?
4. Is the current WebSocket implementation scalable?

### Recommended Architecture Changes

Based on the assessment, consider these architectural changes:

```javascript
// Proposed: Domain-Driven Design approach
src/
├── domain/
│   ├── auction/
│   │   ├── Auction.js           // Auction aggregate
│   │   ├── AuctionState.js      // State machine
│   │   ├── BidStrategy.js       // Strategy pattern for bidding
│   │   └── events/              // Domain events
│   ├── monitoring/
│   │   ├── Monitor.js           // Monitoring aggregate
│   │   ├── PollingStrategy.js   // Configurable polling
│   │   └── MonitoringService.js
│   └── shared/
│       ├── Result.js            // Result<T, E> type
│       └── DomainEvent.js       // Base event class
├── application/
│   ├── commands/                // Command handlers
│   ├── queries/                 // Query handlers
│   └── services/                // Application services
├── infrastructure/
│   ├── api/                     // External API clients
│   ├── persistence/             // Repository implementations
│   └── messaging/               // Event bus, WebSocket
```

### Architecture Decision Records (ADRs)

Create ADRs for major decisions:

```markdown
# ADR-001: Replace Polling with Event-Driven Updates

## Status
Proposed

## Context
Current polling mechanism doesn't scale and wastes resources.

## Decision
Implement WebSocket subscription to auction service for real-time updates.

## Consequences
- Positive: Better performance, real-time updates
- Negative: More complex implementation, requires WebSocket infrastructure
```

## Current Architecture Issues

### Singleton Anti-Pattern
```javascript
// Current: src/services/auctionMonitor.js
class AuctionMonitor { /* ... */ }
module.exports = new AuctionMonitor(); // ❌ Singleton instance
```

### Direct Dependencies
```javascript
// Current: Direct imports create tight coupling
const nellisApi = require('./nellisApi'); // ❌ Hard dependency
const storage = require('./storage');     // ❌ Hard dependency
```

## Target Architecture

### Dependency Injection Pattern
```javascript
// Target: Export class, inject dependencies
class AuctionMonitor {
  constructor({ nellisApi, storage, eventBus }) {
    this.nellisApi = nellisApi;    // ✅ Injected
    this.storage = storage;          // ✅ Injected
    this.eventBus = eventBus;        // ✅ Injected
  }
}
module.exports = AuctionMonitor;     // ✅ Export class
```

## Refactoring Steps

### Step 1: Create Service Interfaces (Non-Breaking)

First, create interfaces without breaking existing code:

```javascript
// src/services/interfaces/index.js
module.exports = {
  IAuctionMonitor: require('./IAuctionMonitor'),
  INellisApi: require('./INellisApi'),
  IStorage: require('./IStorage'),
  IWebSocketHandler: require('./IWebSocketHandler')
};
```

### Step 2: Create Parallel Class Exports

Export both singleton (for backward compatibility) and class:

```javascript
// src/services/auctionMonitor.js
class AuctionMonitor {
  // ... existing implementation
}

const instance = new AuctionMonitor();

module.exports = instance;
module.exports.AuctionMonitor = AuctionMonitor; // Also export class
```

### Step 3: Implement Service Container

```javascript
// src/container/ServiceContainer.js
class ServiceContainer {
  constructor() {
    this.services = new Map();
    this.factories = new Map();
  }

  register(name, factory, options = {}) {
    this.factories.set(name, { factory, options });
  }

  get(name) {
    // Implementation
  }
}

// src/container/production.js
const { ServiceContainer } = require('./ServiceContainer');
const { AuctionMonitor } = require('../services/auctionMonitor');
const { NellisApi } = require('../services/nellisApi');
const { StorageService } = require('../services/storage');

function createProductionContainer() {
  const container = new ServiceContainer();
  
  // Register services
  container.register('storage', (c) => new StorageService(), { singleton: true });
  container.register('nellisApi', (c) => new NellisApi(), { singleton: true });
  container.register('auctionMonitor', (c) => new AuctionMonitor({
    nellisApi: c.get('nellisApi'),
    storage: c.get('storage'),
    eventBus: c.get('eventBus')
  }), { singleton: true });
  
  return container;
}

module.exports = { createProductionContainer };
```

### Step 4: Gradual Service Refactoring

#### 4.1 Storage Service (Least Dependencies)

```javascript
// src/services/storage.js - BEFORE
class StorageService {
  constructor() {
    this.redisClient = null;
    this.memoryFallback = new Map();
  }
  
  async initialize() {
    // Redis connection logic
  }
}

module.exports = new StorageService();
```

```javascript
// src/services/storage.js - AFTER
class StorageService {
  constructor({ redisConfig = {}, logger = console } = {}) {
    this.redisConfig = redisConfig;
    this.logger = logger;
    this.redisClient = null;
    this.memoryFallback = new Map();
  }
  
  async initialize() {
    // Same logic, but uses injected config
  }
}

// Maintain backward compatibility
const instance = new StorageService();
module.exports = instance;
module.exports.StorageService = StorageService;
```

#### 4.2 NellisApi Service

```javascript
// src/services/nellisApi.js - AFTER
class NellisApi {
  constructor({ axiosInstance = axios, logger = console } = {}) {
    this.axios = axiosInstance;
    this.logger = logger;
    this.cookies = '';
  }
  
  // Methods remain the same, but use this.axios instead of axios
}

const instance = new NellisApi();
module.exports = instance;
module.exports.NellisApi = NellisApi;
```

#### 4.3 AuctionMonitor Service

```javascript
// src/services/auctionMonitor.js - AFTER
class AuctionMonitor extends EventEmitter {
  constructor({ nellisApi, storage, logger = console, config = {} } = {}) {
    super();
    this.nellisApi = nellisApi || require('./nellisApi'); // Fallback for compatibility
    this.storage = storage || require('./storage');
    this.logger = logger;
    this.config = {
      pollingInterval: 5000,
      maxRetries: 3,
      ...config
    };
    
    this.monitoredAuctions = new Map();
    this.pollingIntervals = new Map();
  }
  
  // Methods updated to use injected dependencies
}

const instance = new AuctionMonitor();
module.exports = instance;
module.exports.AuctionMonitor = AuctionMonitor;
```

### Step 5: Update Entry Points

```javascript
// src/index.js - BEFORE
const storage = require('./services/storage');
const auctionMonitor = require('./services/auctionMonitor');
const websocketHandler = require('./services/websocket');

async function startServer() {
  await storage.initialize();
  // ...
}
```

```javascript
// src/index.js - AFTER
const { createProductionContainer } = require('./container/production');

async function startServer() {
  const container = createProductionContainer();
  
  const storage = container.get('storage');
  const auctionMonitor = container.get('auctionMonitor');
  const websocketHandler = container.get('websocketHandler');
  
  await storage.initialize();
  // ... rest remains the same
}
```

### Step 6: Update Routes to Use Container

```javascript
// src/routes/api.js - AFTER
function createApiRouter(container) {
  const router = express.Router();
  const auctionMonitor = container.get('auctionMonitor');
  const storage = container.get('storage');
  
  // Routes use injected services
  router.post('/auctions/:auctionId/monitor', async (req, res) => {
    // ... implementation
  });
  
  return router;
}

// Backward compatibility
module.exports = createApiRouter({ 
  get: (name) => require(`../services/${name}`) 
});
module.exports.createApiRouter = createApiRouter;
```

## Migration Strategy

### Phase 1: Add New Structure (Week 1)
- Create interfaces
- Add container system
- Export classes alongside singletons
- No breaking changes

### Phase 2: Update Tests (Week 2)
- New tests use dependency injection
- Old tests continue to work
- Gradually migrate test files

### Phase 3: Update Application (Week 3)
- Update entry points to use container
- Maintain backward compatibility
- Test in staging environment

### Phase 4: Remove Legacy Code (Week 4)
- Remove singleton exports
- Update all imports
- Full dependency injection

## Testing During Migration

### Parallel Testing
```javascript
// tests/migration/compatibility.test.js
describe('Backward Compatibility', () => {
  it('should work with singleton imports', () => {
    const auctionMonitor = require('../../src/services/auctionMonitor');
    expect(auctionMonitor).toBeDefined();
    expect(auctionMonitor.monitoredAuctions).toBeDefined();
  });
  
  it('should work with class imports', () => {
    const { AuctionMonitor } = require('../../src/services/auctionMonitor');
    const instance = new AuctionMonitor();
    expect(instance).toBeDefined();
    expect(instance.monitoredAuctions).toBeDefined();
  });
});
```

### Integration Testing
```javascript
// tests/migration/container-integration.test.js
describe('Container Integration', () => {
  let container;
  
  beforeEach(() => {
    container = createTestContainer();
  });
  
  it('should create all services', () => {
    expect(container.get('storage')).toBeDefined();
    expect(container.get('nellisApi')).toBeDefined();
    expect(container.get('auctionMonitor')).toBeDefined();
  });
  
  it('should maintain singleton behavior', () => {
    const storage1 = container.get('storage');
    const storage2 = container.get('storage');
    expect(storage1).toBe(storage2);
  });
});
```

## Benefits After Refactoring

### 1. Testability
- Services can be tested in isolation
- Easy to mock dependencies
- No global state pollution

### 2. Flexibility
- Different configurations for different environments
- Easy to swap implementations
- Support for multiple instances

### 3. Maintainability
- Clear dependency graph
- Easier to understand service relationships
- Simplified debugging

### 4. BDD Support
- Services can be easily mocked in step definitions
- Test scenarios can inject specific behaviors
- Parallel test execution without conflicts

## Risk Mitigation

### 1. Gradual Migration
- No big-bang rewrite
- Each phase is independently valuable
- Can pause migration if issues arise

### 2. Backward Compatibility
- Existing code continues to work
- Tests provide safety net
- Can rollback individual services

### 3. Testing Coverage
- Write tests for both old and new patterns
- Ensure feature parity
- Performance benchmarks

## Success Criteria

1. All existing tests pass without modification
2. New BDD tests can mock any service
3. No performance degradation
4. Zero downtime during migration
5. Improved test execution speed
6. Reduced test flakiness