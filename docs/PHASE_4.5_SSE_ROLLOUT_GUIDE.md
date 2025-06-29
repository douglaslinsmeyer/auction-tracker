# Phase 4.5: SSE Production Rollout Guide

## Overview
This guide outlines the production rollout strategy for Server-Sent Events (SSE) integration with Nellis Auction's real-time update system.

## Pre-Rollout Checklist

### Code Readiness
- [x] SSE Client implementation complete (`src/services/sseClient.js`)
- [x] ISSEClient interface implemented for dependency injection
- [x] Integration with AuctionMonitor service
- [x] WebSocket relay for Chrome extension compatibility
- [x] Comprehensive unit and integration tests
- [x] Performance tests validating <50ms event processing
- [x] BDD test coverage for edge cases
- [x] Metrics collection and monitoring

### Infrastructure Requirements
- [ ] Redis available for session and state management
- [ ] Network allows outbound HTTPS to `sse.nellisauction.com`
- [ ] Monitoring infrastructure can receive metrics
- [ ] Log aggregation configured for SSE events

## Rollout Strategy

### Phase 1: Canary Deployment (Day 1-3)
1. **Enable SSE for 5% of traffic**
   ```bash
   # Set environment variable
   USE_SSE=true
   SSE_CANARY_PERCENTAGE=5
   ```

2. **Monitor Key Metrics**
   - SSE connection success rate (target: >95%)
   - Event processing latency (target: <50ms p95)
   - Fallback activation rate (target: <5%)
   - Memory usage (should not increase >10%)

3. **Success Criteria**
   - No increase in error rates
   - Auction updates arriving faster than polling
   - Chrome extension continues working normally

### Phase 2: Gradual Rollout (Day 4-7)
1. **Increase SSE adoption**
   ```bash
   # Day 4: 25%
   SSE_CANARY_PERCENTAGE=25
   
   # Day 5: 50%
   SSE_CANARY_PERCENTAGE=50
   
   # Day 6: 75%
   SSE_CANARY_PERCENTAGE=75
   ```

2. **Monitor Stability**
   - Check `/metrics/sse` endpoint regularly
   - Watch for reconnection patterns
   - Monitor Nellis API rate limits

### Phase 3: Full Deployment (Day 8)
1. **Enable for all users**
   ```bash
   USE_SSE=true
   # Remove canary percentage
   unset SSE_CANARY_PERCENTAGE
   ```

2. **Keep polling as fallback**
   - Polling automatically activates on SSE failure
   - Monitor fallback activation metrics

## Configuration Options

### Environment Variables
```bash
# Core SSE Configuration
USE_SSE=true                          # Enable SSE feature
SSE_ENDPOINT=https://sse.nellisauction.com  # SSE server endpoint
SSE_RECONNECT_INTERVAL=5000           # Initial reconnect delay (ms)
SSE_MAX_RECONNECT_ATTEMPTS=3          # Max reconnection attempts

# Monitoring
ENABLE_SSE_METRICS=true               # Enable detailed metrics
SSE_METRICS_INTERVAL=60000            # Metrics logging interval

# Feature Flags (via Redis)
USE_MINIMAL_POLLING=true              # Use efficient polling as fallback
```

### Redis Feature Flags
```bash
# Enable SSE via Redis (for live toggling)
redis-cli SET feature:use_sse true

# Check current state
redis-cli GET feature:use_sse
```

## Monitoring

### Key Metrics Endpoints
- **Health Check**: `GET /health`
- **All Metrics**: `GET /metrics`
- **SSE Metrics**: `GET /metrics/sse`

### Metric Thresholds
| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| SSE Success Rate | <95% | <90% | Check network/Nellis status |
| Active Connections | >1000 | >2000 | Scale backend instances |
| Event Processing p95 | >100ms | >500ms | Optimize event handlers |
| Fallback Rate | >10% | >20% | Investigate SSE failures |
| Memory Usage | +20% | +50% | Check for memory leaks |

### Monitoring Script
```bash
# Use the provided monitoring script
node scripts/monitor-metrics.js
```

## Rollback Procedures

### Immediate Rollback
```bash
# Via environment variable
USE_SSE=false
# Restart service
```

### Gradual Rollback
```bash
# Reduce percentage gradually
SSE_CANARY_PERCENTAGE=50  # Then 25, 10, 5, 0
```

### Emergency Rollback
```bash
# Via Redis (no restart needed)
redis-cli SET feature:use_sse false
```

## Troubleshooting

### Common Issues

1. **High Connection Failure Rate**
   - Check network connectivity to sse.nellisauction.com
   - Verify no firewall/proxy blocking
   - Check Nellis service status

2. **Memory Usage Increase**
   - Review active connection count
   - Check for event handler memory leaks
   - Verify cleanup on disconnection

3. **Events Not Processing**
   - Check product ID extraction
   - Verify event channel names match
   - Review SSE client logs

### Debug Commands
```bash
# Check SSE connection status
curl http://localhost:3000/api/auctions/debug

# Force SSE reconnection
curl -X POST http://localhost:3000/api/auctions/{id}/reconnect

# View detailed logs
docker logs nellis-auction-backend --tail 1000 | grep SSE
```

## Post-Rollout

### Week 1-2
- Monitor metrics daily
- Address any edge cases
- Optimize based on real usage patterns

### Week 3-4
- Consider disabling polling for SSE-connected auctions
- Implement advanced SSE features (batch updates, compression)
- Plan for scaling SSE connections

### Long-term
- Evaluate WebSocket replacement with SSE
- Implement SSE for browse page updates
- Consider SSE for other real-time features

## Success Metrics

### Technical
- ✅ 90%+ reduction in API calls to Nellis
- ✅ <1 second update latency (vs 2-5 seconds polling)
- ✅ 99%+ SSE connection reliability
- ✅ Zero increase in error rates

### Business
- ✅ Improved bid timing accuracy
- ✅ Reduced server load and costs
- ✅ Better user experience with real-time updates
- ✅ Competitive advantage in auction bidding

## Contact

For issues during rollout:
1. Check metrics endpoints
2. Review logs for SSE-related errors
3. Use rollback procedures if needed
4. Document any issues for post-mortem