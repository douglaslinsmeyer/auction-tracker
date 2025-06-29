# Minimal Polling Strategy (SSE Fallback)

## Overview

This document outlines the minimal polling strategy that serves as a **fallback mechanism** when Server-Sent Events (SSE) are unavailable. With SSE as the primary update mechanism (Phase 4.5), polling is only used:
1. As a safety net when SSE connections fail
2. For auctions where SSE endpoints are not available
3. During the SSE rollout transition period

## Context: SSE-First Architecture

As of Phase 4.5, the system primarily uses Server-Sent Events (SSE) for real-time auction updates:
- **Primary**: SSE provides instant updates with < 1 second latency
- **Fallback**: This minimal polling strategy activates when SSE is unavailable
- **Hybrid Mode**: Both can run simultaneously during transition

## Original Problem (Now Mostly Solved by SSE)

The original polling-only implementation made ~14,400 API calls per 24-hour auction. This is now reduced by:
- **With SSE**: ~99.9% reduction (only occasional health checks)
- **Without SSE**: ~98.6% reduction using this minimal polling strategy

## Solution: Time-Based Intelligent Polling

### Polling Schedule

```javascript
const getPollingInterval = (timeRemaining) => {
  if (timeRemaining <= 30) return 1;      // Final 30s: every 1s
  if (timeRemaining <= 120) return 2;     // Final 2m: every 2s
  if (timeRemaining <= 300) return 5;     // Final 5m: every 5s
  if (timeRemaining <= 1800) return 60;   // 5-30m: every 1m
  if (timeRemaining <= 7200) return 300;  // 30m-2h: every 5m
  return 600;                              // 2h+: every 10m
};
```

### Impact Analysis

For a 24-hour auction:
- **Current**: ~14,400 polls
- **New**: ~200 polls
- **Reduction**: 98.6%

Breakdown:
- First 23h 55m: 143 polls (every 10 min)
- Final 5m: 60 polls (every 5 sec)
- Final 2m: 60 polls (every 2 sec)  
- Final 30s: 30 polls (every 1 sec)

## Implementation Details

### 1. Feature Flags

```javascript
// Environment variables
ENABLE_SSE=true                        // Primary: Use SSE for real-time updates
USE_MINIMAL_POLLING=true               // Fallback: Enable minimal polling
SSE_FALLBACK_POLLING=true              // Use polling when SSE fails
MINIMAL_POLLING_THRESHOLD=300          // When to start intensive polling (seconds)
MINIMAL_POLLING_WAKE_JITTER=5          // Random jitter for wake-ups (seconds)
POLLING_VARIATION_PERCENT=0.2          // ±20% organic variation
ENABLE_TIME_OF_DAY_VARIATION=true      // Simulate human patterns
```

### 2. Organic Variation

Add natural-looking variation to polling intervals to appear more human-like:

```javascript
// Gaussian distribution for natural variation
const getOrganicJitter = (baseInterval, variationPercent = 0.2) => {
  // Box-Muller transform for normal distribution
  const u1 = Math.random();
  const u2 = Math.random();
  const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  
  // Scale and clamp variation
  const variation = gaussian * variationPercent * baseInterval;
  const maxVariation = baseInterval * 0.4;
  
  return baseInterval + Math.max(-maxVariation, Math.min(maxVariation, variation));
};

// Time-of-day patterns
const getTimeOfDayMultiplier = () => {
  const hour = new Date().getHours();
  
  if (hour >= 2 && hour < 6) return 1.1 + Math.random() * 0.2;  // Night: slower
  if (hour >= 19 && hour < 23) return 0.9 + Math.random() * 0.1; // Evening: faster
  return 0.95 + Math.random() * 0.1; // Day: normal
};

// Apply organic variation to base interval
const getOrganicInterval = (baseInterval) => {
  const timeAdjusted = baseInterval * getTimeOfDayMultiplier();
  return getOrganicJitter(timeAdjusted);
};
```

### 3. Wake-Up Scheduling

Pre-schedule polls before critical transitions with organic variation:

```javascript
const transitions = [300, 120, 30]; // 5 minutes, 2 minutes, 30 seconds

// Schedule with jitter to avoid synchronized polling
transitions.forEach(threshold => {
  if (auction.timeRemaining > threshold) {
    const baseWakeUpTime = auction.timeRemaining - threshold - 5;
    const jitter = Math.random() * 10 - 5; // ±5 seconds
    const wakeUpTime = baseWakeUpTime + jitter;
    schedulePolling(auctionId, wakeUpTime);
  }
});
```

### 4. Force Update Capability

Allow immediate updates for user actions:

```javascript
// API endpoint: POST /api/auctions/:id/refresh
// Rate limited: 1 request per 5 seconds per auction

const forceUpdate = async (auctionId) => {
  const lastUpdate = forceUpdateTimestamps.get(auctionId) || 0;
  const timeSinceLastUpdate = Date.now() - lastUpdate;
  
  if (timeSinceLastUpdate < 5000) {
    throw new Error('Rate limit exceeded');
  }
  
  const data = await pollAuction(auctionId);
  forceUpdateTimestamps.set(auctionId, Date.now());
  return data;
};
```

### 4. Special Cases

#### Active Bidding
If we're actively bidding on an auction, maintain minimum polling frequency:

```javascript
if (auction.isWinning === false && auction.maxBid > auction.currentBid) {
  // We're being outbid but have room to bid
  return Math.min(baseInterval, 10); // At least every 10 seconds
}
```

#### User Watching
Poll more frequently for auctions the user is actively viewing:

```javascript
if (activeViewers.has(auctionId)) {
  return Math.min(baseInterval, 30); // At least every 30 seconds
}
```

## Testing Strategy

### Unit Tests
- Interval calculation for various timeRemaining values
- Wake-up scheduling logic
- Force update rate limiting
- Transition between intervals

### Integration Tests
- Full auction lifecycle monitoring
- Metrics validation (polls saved, efficiency)
- Bid detection in final minutes
- Feature flag on/off behavior

### Performance Tests
- Memory usage with fewer timers
- API call reduction measurement
- Response time for force updates
- WebSocket message volume

## Rollout Plan

### Phase 1: Testing (Week 1)
- Enable for 10% of auctions
- Monitor metrics closely
- Gather user feedback

### Phase 2: Gradual Rollout (Week 2)
- Increase to 50% if metrics are good
- A/B test performance impact
- Fine-tune intervals if needed

### Phase 3: Full Deployment (Week 3)
- Enable for all auctions
- Keep feature flag for emergency rollback
- Document any edge cases

## Benefits of Organic Variation

### Why Add Variation?

1. **Avoid Detection**: Prevents bot-like patterns that could trigger rate limiting
2. **Natural Behavior**: Mimics human browsing patterns
3. **Load Distribution**: Spreads requests over time, avoiding synchronized spikes
4. **Defensive Measure**: Future-proofs against potential anti-bot measures

### Variation Patterns

- **Gaussian Distribution**: Most polls cluster around base interval with natural tail-off
- **Time-of-Day**: Slower at night, faster during peak hours
- **Session Personality**: Each auction gets slight unique timing
- **Occasional Bursts**: Simulates human "checking repeatedly" behavior

## Monitoring & Metrics

### Key Metrics to Track

```javascript
// Prometheus metrics
auction_polls_total                    // Total polls
auction_polls_by_interval{interval}    // Polls per interval type
auction_api_calls_saved               // Calls avoided
auction_polling_efficiency            // Percentage saved
auction_forced_updates_total          // Manual refreshes
auction_bid_detection_latency         // Time to detect new bids
```

### Success Criteria
- 95%+ reduction in API calls for auctions > 5 minutes
- < 2 second bid detection in final 5 minutes
- No increase in missed bids
- Positive user feedback

## Risk Mitigation

### Risks
1. **Missed bids**: Longer intervals might miss activity
   - **Mitigation**: Force update on user actions
   
2. **Transition issues**: Jumpy behavior at interval boundaries
   - **Mitigation**: Wake-up scheduling with jitter

3. **User confusion**: Expecting real-time updates
   - **Mitigation**: UI indicators showing next update time

### Rollback Plan
- Feature flag allows instant rollback
- All changes are backward compatible
- Original polling logic remains intact

## Future Enhancements

1. **Machine Learning**: Predict auction activity patterns
2. **Batch Polling**: Combine multiple auctions in single request
3. **Push Notifications**: If Nellis adds WebSocket support
4. **Adaptive Intervals**: Learn from individual auction behavior

## Conclusion

The minimal polling strategy provides massive efficiency gains with minimal implementation complexity. By focusing polling efforts on the critical final minutes, we maintain bid accuracy while reducing system load by 98%.