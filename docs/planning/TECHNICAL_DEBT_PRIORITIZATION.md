# Technical Debt Prioritization

## Prioritization Framework

**Impact Score** (1-5):
- 5: Critical - System failure, data loss, security breach
- 4: High - Major feature broken, performance severely degraded  
- 3: Medium - Feature limitations, moderate performance impact
- 2: Low - Minor inconvenience, workarounds available
- 1: Minimal - Cosmetic issues, nice-to-have improvements

**Effort Score** (1-5):
- 5: Very High - Multiple weeks, major architecture change
- 4: High - 1-2 weeks, significant refactoring
- 3: Medium - 3-5 days, moderate changes
- 2: Low - 1-2 days, localized changes  
- 1: Minimal - Few hours, simple fix

**Priority** = Impact × (6 - Effort) = Higher score means fix sooner

## Critical Priority (Score ≥ 20) 🔴

### 1. Hardcoded Authentication Token
**Impact**: 5 (Security breach risk)
**Effort**: 1 (Few hours to fix)
**Priority**: 25
**Description**: Default 'dev-token' in production is a critical security vulnerability
**Solution**:
```javascript
// Remove default, require ENV var
if (!process.env.AUTH_TOKEN) {
  throw new Error('AUTH_TOKEN environment variable required');
}
```
**Dependencies**: None
**Timeline**: Immediate

### 2. Memory Leak - No Auction Cleanup
**Impact**: 5 (System crash)
**Effort**: 2 (1-2 days)
**Priority**: 20
**Description**: Ended auctions never removed from memory in fallback mode
**Solution**:
- Implement cleanup timer for ended auctions
- Add memory usage monitoring
- Set maximum auction limit
**Dependencies**: None
**Timeline**: Week 1

### 3. No API Rate Limiting
**Impact**: 4 (Service disruption)
**Effort**: 1 (Few hours)
**Priority**: 20
**Description**: Vulnerable to DDoS and API abuse
**Solution**:
```javascript
const rateLimit = require('express-rate-limit');
app.use('/api', rateLimit({
  windowMs: 60000,
  max: 100
}));
```
**Dependencies**: npm install express-rate-limit
**Timeline**: Week 1

## High Priority (Score 15-19) 🟠

### 4. Singleton Services (Testability)
**Impact**: 4 (Can't test properly)
**Effort**: 4 (1-2 weeks)
**Priority**: 8
**Description**: All services are singletons, making testing very difficult
**Solution**:
- Export classes instead of instances
- Implement dependency injection
- Create service factories
**Dependencies**: Major refactoring
**Timeline**: Week 2-3

### 5. Individual Polling Timers
**Impact**: 4 (CPU/performance issues)
**Effort**: 3 (3-5 days)
**Priority**: 12
**Description**: Each auction has its own setInterval timer
**Solution**:
- Implement polling queue
- Use single timer with priority queue
- Add backpressure controls
**Dependencies**: Architecture change
**Timeline**: Week 3

### 6. No Circuit Breaker for API
**Impact**: 3 (Cascading failures)
**Effort**: 2 (1-2 days)
**Priority**: 12
**Description**: Failed API calls continue indefinitely
**Solution**:
```javascript
const CircuitBreaker = require('opossum');
const breaker = new CircuitBreaker(nellisApiCall, {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
});
```
**Dependencies**: npm install opossum
**Timeline**: Week 2

### 7. Plain Text Cookie Storage
**Impact**: 4 (Security risk)
**Effort**: 2 (1-2 days)
**Priority**: 16
**Description**: Cookies stored unencrypted in Redis
**Solution**:
- Encrypt cookies before storage
- Use crypto module for encryption
- Rotate encryption keys
**Dependencies**: Key management
**Timeline**: Week 1

### 8. Synchronous WebSocket Broadcasts
**Impact**: 3 (Performance bottleneck)
**Effort**: 2 (1-2 days)
**Priority**: 12
**Description**: Broadcasting blocks event loop
**Solution**:
- Make broadcasts asynchronous
- Implement message queuing
- Use worker threads if needed
**Dependencies**: None
**Timeline**: Week 2

## Medium Priority (Score 10-14) 🟡

### 9. No State Machine for Auctions
**Impact**: 3 (Invalid states possible)
**Effort**: 3 (3-5 days)
**Priority**: 9
**Description**: Auction state transitions not validated
**Solution**:
- Implement proper state machine
- Validate all transitions
- Add state change events
**Dependencies**: Architecture change
**Timeline**: Week 4

### 10. Error Swallowing
**Impact**: 3 (Silent failures)
**Effort**: 2 (1-2 days)
**Priority**: 12
**Description**: Many errors logged but not handled
**Solution**:
- Implement error boundaries
- Add error recovery strategies
- Create error metrics
**Dependencies**: Monitoring setup
**Timeline**: Week 3

### 11. No Request Correlation
**Impact**: 2 (Hard to debug)
**Effort**: 1 (Few hours)
**Priority**: 10
**Description**: Can't trace requests through system
**Solution**:
```javascript
app.use((req, res, next) => {
  req.id = uuid.v4();
  res.setHeader('X-Request-ID', req.id);
  next();
});
```
**Dependencies**: None
**Timeline**: Week 2

### 12. Missing Input Validation
**Impact**: 3 (Security/stability)
**Effort**: 2 (1-2 days)
**Priority**: 12
**Description**: User inputs not properly validated
**Solution**:
- Add Joi validation schemas
- Validate all API inputs
- Sanitize auction IDs
**Dependencies**: Joi already installed
**Timeline**: Week 2

## Low Priority (Score 5-9) 🟢

### 13. Duplicate Redis Clients
**Impact**: 1 (Confusion)
**Effort**: 1 (Few hours)
**Priority**: 5
**Description**: Both 'redis' and 'ioredis' packages installed
**Solution**:
- Remove unused 'redis' package
- Standardize on ioredis
**Dependencies**: None
**Timeline**: Week 4

### 14. No Structured Logging
**Impact**: 2 (Harder debugging)
**Effort**: 2 (1-2 days)
**Priority**: 8
**Description**: Console.log used everywhere
**Solution**:
- Implement Winston properly
- Add log levels
- Structure log output as JSON
**Dependencies**: Winston already installed
**Timeline**: Week 4

### 15. No Health Check Endpoint
**Impact**: 2 (Monitoring harder)
**Effort**: 1 (Few hours)
**Priority**: 8
**Description**: Load balancers can't check health properly
**Solution**:
```javascript
app.get('/health', async (req, res) => {
  const checks = await runHealthChecks();
  res.status(checks.healthy ? 200 : 503).json(checks);
});
```
**Dependencies**: None
**Timeline**: Week 3

### 16. Unused Dependencies
**Impact**: 1 (Bloat)
**Effort**: 1 (Few hours)
**Priority**: 5
**Description**: joi and node-cron installed but unused
**Solution**:
- Remove unused packages
- Or implement their intended features
**Dependencies**: None
**Timeline**: Week 4

## Technical Debt by Category

### Security Debt
1. Hardcoded auth token (Priority: 25)
2. Plain text cookies (Priority: 16)
3. No rate limiting (Priority: 20)
4. Missing input validation (Priority: 12)
**Total Security Debt Score**: 73

### Performance Debt
1. Individual polling timers (Priority: 12)
2. Synchronous broadcasts (Priority: 12)
3. No circuit breaker (Priority: 12)
4. Memory leaks (Priority: 20)
**Total Performance Debt Score**: 56

### Maintainability Debt
1. Singleton services (Priority: 8)
2. No state machine (Priority: 9)
3. No structured logging (Priority: 8)
4. Error swallowing (Priority: 12)
**Total Maintainability Debt Score**: 37

### Operational Debt
1. No health checks (Priority: 8)
2. No request correlation (Priority: 10)
3. Duplicate packages (Priority: 5)
4. Unused dependencies (Priority: 5)
**Total Operational Debt Score**: 28

## Implementation Roadmap

### Week 1 - Critical Security & Stability
- [ ] Remove hardcoded auth token
- [ ] Implement memory cleanup
- [ ] Add rate limiting
- [ ] Encrypt cookie storage

### Week 2 - Performance & Monitoring
- [ ] Add circuit breaker
- [ ] Fix synchronous broadcasts
- [ ] Add request correlation
- [ ] Implement input validation

### Week 3 - Architecture Improvements
- [ ] Start singleton refactoring
- [ ] Implement polling queue
- [ ] Add error boundaries
- [ ] Create health check endpoint

### Week 4 - Cleanup & Polish
- [ ] Complete service refactoring
- [ ] Implement state machine
- [ ] Structure logging
- [ ] Remove unused dependencies

## Metrics to Track

### Before Refactoring
- Memory usage growth rate
- CPU usage with N auctions
- Test execution time
- Test coverage %
- Error rates

### After Each Fix
- Performance improvement %
- Memory usage reduction
- Test coverage increase
- Error rate decrease
- Developer productivity

## Long-term Debt (Not Immediate)

### Event Sourcing Implementation
**Impact**: 2
**Effort**: 5
**Priority**: 2
**Description**: Would provide audit trail and replay capability
**Timeline**: Future phase

### Microservices Architecture
**Impact**: 2
**Effort**: 5
**Priority**: 2
**Description**: Would improve scalability but adds complexity
**Timeline**: When scale demands it

### GraphQL API
**Impact**: 1
**Effort**: 4
**Priority**: 2
**Description**: More flexible API but not critical
**Timeline**: Future enhancement

## Success Criteria

### Phase 1 Complete When:
- All critical security issues resolved
- Memory usage stable over time
- API protected from abuse
- System can run 24/7 without intervention

### Phase 2 Complete When:
- All services testable in isolation
- Performance meets benchmarks
- Error handling comprehensive
- Monitoring provides full visibility

### Phase 3 Complete When:
- Architecture supports horizontal scaling
- Code maintainable by new developers
- All technical debt documented
- System ready for 10x growth