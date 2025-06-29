# BDD Testing Plan - UPDATED Based on Phase 0 Discoveries

## Executive Summary of Changes

Phase 0 revealed critical issues requiring immediate attention before proceeding with the original plan:
- **3 Critical Security Vulnerabilities** requiring immediate fixes
- **Memory leak** that will crash the system
- **186 total test scenarios** (up from estimated 50)
- **Breaking Chrome Extension** is highest risk (25/25)
- **6-week timeline** remains but with adjusted priorities

## Revised Implementation Timeline

### Week 1: Critical Security & Stability Fixes
**Priority**: Prevent system failure and security breaches

#### Immediate Fixes (Days 1-2)
```javascript
// 1. Remove hardcoded auth token (Priority: 25)
if (!process.env.AUTH_TOKEN) {
  throw new Error('AUTH_TOKEN required');
}

// 2. Add rate limiting (Priority: 20)
const rateLimit = require('express-rate-limit');
app.use('/api', rateLimit({ windowMs: 60000, max: 100 }));

// 3. Fix memory leak (Priority: 20)
// Add cleanup timer in auctionMonitor.js
setInterval(() => {
  for (const [id, auction] of this.monitoredAuctions) {
    if (auction.status === 'ended' && 
        Date.now() - auction.endedAt > 60000) {
      this.monitoredAuctions.delete(id);
    }
  }
}, 30000);
```

#### Security Hardening (Days 3-5)
- Encrypt cookies before storage
- Add input validation for all endpoints
- Implement proper error messages (no stack traces)
- Add security headers with helmet

#### BDD Test Framework Setup (Days 4-5)
- Install jest-cucumber, chai, sinon
- Create initial test structure
- Set up test database/Redis
- Configure test environments

**Deliverables**: System stable and secure enough to refactor

### Week 2: Foundation with Backward Compatibility ✅ COMPLETED
**Priority**: Enable testing without breaking existing functionality

#### What We Achieved:
1. **Service Interfaces** - Created comprehensive interfaces for all services
2. **Class Wrappers** - Wrapped singletons maintaining 100% compatibility  
3. **Dependency Injection** - Flexible ServiceContainer with factory support
4. **Zero Breaking Changes** - Chrome extension continued working

#### Key Learning:
The wrapper pattern proved highly effective. Instead of rewriting services, we wrapped existing singletons with classes that delegate to them. This approach should guide future phases.

**Deliverables**: ✅ DI ready, ✅ zero breaking changes, ✅ all tests passing

### Week 3: Core Refactoring & High-Priority Debt (REVISED)
**Priority**: Fix architectural issues blocking scalability

#### Updated Approach - Wrapper Pattern:
Based on Phase 2 success, use wrappers and feature flags instead of rewrites.

#### Replace Polling Mechanism (Days 1-2)
```javascript
// Wrapper approach with feature flag
class PollingQueueWrapper {
  constructor(auctionMonitor) {
    this._auctionMonitor = auctionMonitor;
    this._queue = new PriorityQueue();
    this._enabled = process.env.USE_POLLING_QUEUE === 'true';
  }
  
  schedulePoll(auctionId, interval) {
    if (this._enabled) {
      this._queue.add(auctionId, interval);
    } else {
      this._auctionMonitor._startLegacyPolling(auctionId);
    }
  }
}
```

#### Add Circuit Breaker (Day 3)
```javascript
const CircuitBreaker = require('opossum');
const nellisBreaker = new CircuitBreaker(nellisApiCall, {
  timeout: 3000,
  errorThresholdPercentage: 50
});
```

#### Implement State Machine (Days 4-5)
For discovered state transitions:
```javascript
const auctionStates = {
  ADDED: ['MONITORING'],
  MONITORING: ['BIDDING', 'ENDING', 'ERROR'],
  BIDDING: ['MONITORING', 'ENDING'],
  ENDING: ['ENDED'],
  ENDED: []
};
```

**Deliverables**: Core architecture issues resolved

### Week 4: BDD Test Implementation
**Priority**: Implement all 186 discovered test scenarios

#### Feature Implementation Priority:
1. **Critical Business Flows** (Days 1-2)
   - Auction monitoring lifecycle
   - Bidding strategies (increment, sniping)
   - WebSocket real-time updates
   
2. **Edge Cases from Phase 0** (Days 3-4)
   - Concurrent bid collision
   - Clock skew handling
   - Memory pressure scenarios
   - Authentication expiry
   
3. **Integration Flows** (Day 5)
   - End-to-end user journeys
   - Chrome extension integration
   - Recovery scenarios

#### Test Implementation Strategy:
```javascript
// Use discovered acceptance criteria
describe('Auction Monitoring', () => {
  it('should complete setup within 2 seconds'); // Performance
  it('should persist state correctly'); // Data integrity
  it('should handle errors gracefully'); // Error handling
  it('should not leak memory'); // Resource management
});
```

**Deliverables**: All behaviors have executable tests

### Week 5: Integration, Missing Scenarios & Chrome Extension
**Priority**: Ensure nothing breaks, especially Chrome extension

#### Chrome Extension Compatibility (Days 1-2)
- Test all WebSocket message formats
- Verify REST API contracts
- Add versioning for future changes
- Create migration guide

#### Missing Scenario Implementation (Days 3-4)
From Phase 0 missing-scenarios.feature:
- Resource exhaustion tests
- Network partition handling
- Partial system degradation
- Data corruption recovery

#### Performance Testing (Day 5)
- Load test with 1000 auctions
- Memory growth analysis
- WebSocket connection limits
- API response times

**Deliverables**: Full test coverage, extension verified

### Week 6: Production Readiness & Documentation
**Priority**: Meet production checklist requirements

#### Monitoring & Observability (Days 1-2)
- Add Prometheus metrics
- Create Grafana dashboards
- Set up alerts (PagerDuty)
- Implement distributed tracing

#### Operational Readiness (Days 3-4)
- Create runbooks for all alerts
- Document emergency procedures
- Set up backup/recovery
- Configure auto-scaling

#### Final Testing & Signoff (Day 5)
- Run full test suite
- Performance benchmarks
- Security scan
- Get stakeholder signoffs

**Deliverables**: Production-ready system

## Key Changes from Original Plan

### 1. Security First
- Week 1 now focuses on critical security fixes
- Can't refactor insecure code

### 2. Backward Compatibility Emphasis
- All changes must not break Chrome extension
- Parallel old/new implementations
- Feature flags for everything

### 3. More Comprehensive Testing
- 186 scenarios vs original 50 estimate
- Include all edge cases discovered
- Performance criteria for each test

### 4. Gradual Migration
- No "big bang" refactoring
- Each phase independently valuable
- Can stop at any phase if needed

### 5. Production Focus
- Week 6 entirely for production readiness
- Monitoring before deployment
- Clear rollback procedures

## Risk Mitigation Updates

### Highest Risks from Phase 0:
1. **Breaking Chrome Extension** (25/25)
   - Mitigation: Test with actual extension weekly
   - Maintain API version compatibility
   - Document all changes

2. **Data Loss** (20/25)
   - Mitigation: Implement state export/import
   - Test recovery procedures
   - Dual-write during migration

3. **Performance Degradation** (16/25)
   - Mitigation: Benchmark every change
   - Keep old code paths available
   - Load test continuously

## Success Criteria (Updated)

### Phase Gates - Must Pass Before Proceeding:
1. **Week 1**: No critical security vulnerabilities, no memory leaks
2. **Week 2**: All tests pass with both old and new code
3. **Week 3**: Performance equal or better than current
4. **Week 4**: 90%+ test coverage achieved
5. **Week 5**: Chrome extension fully functional
6. **Week 6**: All production checklist items complete

### Overall Success Metrics:
- **Security**: 0 critical vulnerabilities
- **Stability**: 24/7 operation without intervention
- **Performance**: <200ms API response (p95)
- **Scalability**: 1000+ concurrent auctions
- **Quality**: <1% test flakiness
- **Coverage**: >90% code coverage

## Implementation Priorities (Revised)

### Must Have (Week 1-3):
- Security vulnerabilities fixed
- Memory leaks resolved
- Basic monitoring implemented
- Backward compatibility maintained

### Should Have (Week 4-5):
- All BDD tests implemented
- Performance optimizations
- Chrome extension verified
- Documentation complete

### Nice to Have (Week 6+):
- Advanced monitoring dashboards
- Automated scaling
- Performance profiling
- Additional integrations

## Next Steps

1. **Immediate Actions** (Today):
   - Fix hardcoded auth token
   - Deploy rate limiting
   - Start memory leak fix

2. **Week 1 Planning**:
   - Assign security fixes
   - Set up test environment
   - Begin framework installation

3. **Communication**:
   - Notify team of timeline
   - Warn about auth token change
   - Schedule extension testing

## Conclusion

The Phase 0 discoveries significantly impact our approach. We must fix critical issues before refactoring for testability. The 6-week timeline remains achievable but requires disciplined focus on priorities. Security and stability come first, then testability, then features.