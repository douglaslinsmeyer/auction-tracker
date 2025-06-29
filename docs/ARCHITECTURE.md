# System Architecture

## Overview
The Nellis Auction Backend has evolved through three successful phases into a **high-performance, resilient service** that monitors and automates bidding on nellisauction.com. It maintains 100% backward compatibility while incorporating modern performance optimizations and fault tolerance patterns.

## Architecture Principles (Proven)
1. **✅ Backward Compatibility**: All changes maintain compatibility with the Chrome extension
2. **✅ Gradual Enhancement**: Supporting both legacy singleton and modern enhanced patterns  
3. **✅ Interface-Driven**: Clean contracts between components via interfaces
4. **✅ Resilient**: Circuit breakers and fallback mechanisms for external dependencies
5. **✅ Observable**: Comprehensive metrics and monitoring for production insights
6. **✅ Toggleable**: Feature flags enable safe rollout and instant rollback

## Component Architecture

### Service Layer (Enhanced in Phase 3, SSE in Phase 4.5)
The system uses a modular service architecture with dependency injection support, performance/resilience layers, and SSE integration:

```
┌─────────────────────────────────────────────────────────────┐
│                        API Layer                            │
│  ┌─────────────────┐              ┌────────────────────┐   │
│  │   REST API      │              │   WebSocket API    │   │
│  │  (Express.js)   │              │  (ws - to clients) │   │
│  └────────┬────────┘              └─────────┬──────────┘   │
└───────────┼──────────────────────────────────┼──────────────┘
            │                                  │
┌───────────┼──────────────────────────────────┼──────────────┐
│           │        Service Layer             │              │
│  ┌────────▼────────┐              ┌─────────▼──────────┐   │
│  │ ServiceContainer│              │  Service Interfaces │   │
│  │  (DI Container) │◄─────────────┤  (IAuctionMonitor,  │   │
│  └────────┬────────┘              │   INellisApi, etc)  │   │
│           │                       └────────────────────┘   │
│  ┌────────▼───────────────────────────────────────────┐    │
│  │              Service Implementations               │    │
│  │  ┌──────────────┐ ┌──────────┐ ┌───────────────┐  │    │
│  │  │AuctionMonitor│ │NellisApi │ │Storage Service│  │    │
│  │  └──────────────┘ └──────────┘ └───────────────┘  │    │
│  │  ┌──────────────┐ ┌──────────────────────────────┐ │    │
│  │  │  SSE Client  │ │   PollingQueueWrapper       │ │    │
│  │  │  (Phase 4.5) │ │    (Fallback polling)       │ │    │
│  │  └──────────────┘ └──────────────────────────────┘ │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
            │                                  │
┌───────────▼──────────────────────────────────▼──────────────┐
│                    External Systems                         │
│  ┌─────────────────┐    ┌─────────────┐    ┌───────────┐   │
│  │     Redis       │    │ Nellis SSE  │    │  Nellis   │   │
│  │  (Persistence)  │    │  Endpoint   │    │   API     │   │
│  └─────────────────┘    └─────────────┘    └───────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Service Interfaces
All major services implement interfaces for clean contracts:

- **IAuctionMonitor**: Auction monitoring and bidding operations
- **INellisApi**: External API communication
- **IStorage**: Data persistence operations
- **IWebSocketHandler**: Real-time communication

### Service Implementations

#### SSEClient (NEW - Phase 4.5)
**Primary Real-Time Updates**:
- Connects to Nellis SSE endpoints for each monitored auction
- Handles events: `ch_product_bids`, `ch_product_closed`
- Automatic reconnection with exponential backoff
- Emits events for WebSocket relay to clients
- Feature flag controlled rollout

#### AuctionMonitor (Enhanced with SSE Support)
**Core Functionality** (Unchanged):
- Manages auction lifecycles
- Implements bidding strategies
- Handles real-time updates
- Maintains auction state

**Phase 3 Enhancements**:
- ✅ **PollingQueueWrapper**: Now serves as fallback when SSE unavailable
  - Rate limiting: Max 10 API requests/second
  - Priority-based processing (ending auctions first)
  - Memory efficient (1 worker vs N timers)
  - Comprehensive metrics collection

**Phase 4.5 Enhancements**:
- ✅ **SSE Integration**: Primary update mechanism
  - Automatic SSE connection for monitored auctions
  - Fallback to polling on SSE failure
  - Hybrid mode during transition

#### NellisApi (Now with Resilience Layer)
**Core Functionality** (Unchanged):
- Authenticates with nellisauction.com
- Fetches auction data
- Places bids
- Manages cookies

**Phase 3 Enhancements**:
- ✅ **CircuitBreakerNellisApi**: Fault tolerance for API calls
  - States: CLOSED → OPEN → HALF_OPEN → CLOSED
  - Configurable failure thresholds (default: 5 failures)
  - Automatic recovery detection (default: 60s timeout)
  - Fast-fail during outages to prevent resource waste

#### Storage (Enhanced in Phase 3)
- Primary: Redis for distributed persistence
- Fallback: In-memory storage
- Encrypts sensitive data (AES-256-GCM)
- Handles state recovery
- **New**: Stores feature flag configuration

#### WebSocketHandler (Enhanced for SSE Relay)
- Manages client connections (Chrome extensions)
- Broadcasts auction updates from both SSE and polling sources
- Handles authentication
- Implements rate limiting
- **Phase 4.5**: Relays SSE events to connected clients

## Data Flow

### Auction Monitoring Flow (SSE-Enabled)
```
Chrome Extension
    │
    ├─── HTTP POST /api/auctions/:id/monitor
    │         │
    │         ▼
    │    Validation (Joi)
    │         │
    │         ▼
    │    AuctionMonitor.addAuction()
    │         │
    │         ├──► Storage.saveAuction()
    │         │
    │         └──► If SSE enabled & product ID found:
    │                   ├──► SSEClient.connectToAuction()
    │                   │         │
    │                   │         ▼
    │                   │    Nellis SSE Endpoint
    │                   │         │
    │                   │         ▼
    │                   │    Real-time Events
    │                   │
    │                   └──► Start Fallback Polling (30s)
    │
    └─── WebSocket ◄── Broadcast Updates (from SSE or polling)
```

### Bidding Flow (SSE or Polling Triggered)
```
SSE Event or Polling Timer
    │
    ▼
Update received (instant via SSE or periodic via polling)
    │
    ▼
AuctionMonitor evaluates strategy
    │
    ├─── Manual: No action
    ├─── Aggressive: Bid if outbid
    └─── Sniping: Bid if < 30 seconds
              │
              ▼
         NellisApi.placeBid()
              │
              ▼
         Update Storage
              │
              ▼
         Broadcast via WebSocket
```

## Security Architecture

### Authentication
- Token-based auth (required at startup)
- No default tokens
- WebSocket authentication on connect

### Data Protection
- AES-256-GCM encryption for sensitive data
- Automatic log redaction
- No stack traces in production

### API Security
- Rate limiting on all endpoints
- Input validation with Joi
- CORS with extension whitelist
- Security headers (Helmet)
- Optional request signing (HMAC-SHA256)

## Deployment Architecture

### Development
```
Developer Machine
    │
    ├── Node.js Server (nodemon)
    ├── Local Redis (optional)
    └── Chrome Extension (dev mode)
```

### Production
```
Load Balancer
    │
    ├── Node.js Instance 1 ──┐
    ├── Node.js Instance 2 ──┼── Redis Cluster
    └── Node.js Instance N ──┘
```

## Error Handling

### Graceful Degradation
- Redis unavailable → In-memory storage
- API unavailable → Circuit breaker activates
- WebSocket fails → Client reconnects

### Error Recovery
- Automatic state recovery on startup
- Retry logic for transient failures
- Cleanup timers for ended auctions

## Performance Considerations

### Optimizations
- Connection pooling for Redis
- Efficient WebSocket broadcasting
- Debounced updates
- Memory cleanup timers

### Monitoring
- Health endpoint with memory stats
- Auction count tracking
- Error rate monitoring
- Performance metrics ready for Prometheus

## Architecture Patterns

### Wrapper Pattern (Core Strategy)
Our primary pattern for evolution without breaking changes:

```javascript
// Step 1: Original singleton
const auctionMonitor = { /* existing code */ };

// Step 2: Interface definition
class IAuctionMonitor { /* contract */ }

// Step 3: Wrapper class
class AuctionMonitorClass extends IAuctionMonitor {
  constructor() { this._singleton = auctionMonitor; }
  addAuction(...args) { return this._singleton.addAuction(...args); }
}

// Step 4: Enhanced wrapper
class EnhancedAuctionMonitor extends AuctionMonitorClass {
  addAuction(...args) {
    // New behavior with feature flag
    if (features.USE_NEW_BEHAVIOR) {
      // Enhanced implementation
    }
    return super.addAuction(...args);
  }
}
```

### Feature Flag Pattern
Every enhancement is toggleable:

```javascript
const features = {
  USE_POLLING_QUEUE: process.env.USE_POLLING_QUEUE === 'true',
  USE_CIRCUIT_BREAKER: process.env.USE_CIRCUIT_BREAKER === 'true',
  // Can also be managed via Redis for live toggling
};
```

### Decorator Pattern
For cross-cutting concerns:

```javascript
class MetricsDecorator {
  constructor(service) { this._service = service; }
  
  async method(...args) {
    const start = Date.now();
    try {
      const result = await this._service.method(...args);
      metrics.recordSuccess(Date.now() - start);
      return result;
    } catch (error) {
      metrics.recordError(error);
      throw error;
    }
  }
}
```

## Migration Path

### Phase 1-2: Foundation ✅ COMPLETED
- Added interfaces without breaking changes
- Implemented DI container
- Created wrapper classes
- Maintained 100% backward compatibility

### Phase 3: Performance (Wrapper-Based)
- PollingQueueWrapper for efficient updates
- CircuitBreakerNellisApi for resilience  
- StateMachineMonitor for state management
- All behind feature flags

### Phase 4-6: Enhancement & Hardening
- Comprehensive BDD tests
- Performance monitoring
- Production observability
- Gradual feature rollout

### Key Learning: Evolution, Not Revolution
Instead of rewriting, we wrap and enhance. This approach has proven to:
- Eliminate breaking changes
- Enable incremental improvement
- Allow instant rollback
- Maintain team velocity

## Technology Stack

### Core
- **Runtime**: Node.js 14+
- **Framework**: Express.js 4.x
- **WebSocket**: ws 8.x
- **Storage**: Redis 6.x

### Security
- **Validation**: Joi
- **Encryption**: Node.js crypto (AES-256-GCM)
- **Headers**: Helmet
- **Rate Limiting**: express-rate-limit

### Development
- **Testing**: Jest, Cucumber
- **Logging**: Winston
- **Process Manager**: PM2 (production)
- **Container**: Docker