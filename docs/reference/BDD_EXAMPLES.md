# BDD Discovery Phase Example

## Example: Discovering AuctionMonitor Behaviors

This document demonstrates how to conduct the Phase 0 discovery process for the AuctionMonitor service.

### Step 1: Code Analysis

```javascript
// From src/services/auctionMonitor.js analysis:

// DISCOVERED BEHAVIOR 1: Adaptive polling intervals
if (timeSinceLastBid > 600000) { // 10 minutes
    this.pollingIntervals.set(auctionId, 10000); // Slow down polling
}

// DISCOVERED BEHAVIOR 2: Automatic cleanup on errors
if (error.response?.status === 404) {
    this.stopMonitoring(auctionId);
    this.emit('auction-not-found', { auctionId });
}

// DISCOVERED BEHAVIOR 3: Bid validation before placement
if (newBidAmount <= currentBid) {
    throw new Error('Bid must be higher than current bid');
}

// DISCOVERED BEHAVIOR 4: Soft ending logic
if (timeRemaining <= 30 && bidPlaced) {
    extendAuctionTime(30); // Extends by 30 seconds
}

// DISCOVERED BEHAVIOR 5: Connection recovery
this.ws.on('close', () => {
    setTimeout(() => this.reconnect(), 5000);
    this.preserveMonitoringState();
});
```

### Step 2: Initial BDD Test Generation

```gherkin
# tests/features/discovered/auction-monitor-behaviors.feature
Feature: Auction Monitor - Discovered Behaviors
  Documentation of all behaviors found during code analysis

  # BEHAVIOR 1: Adaptive Polling
  Scenario: Reduce polling frequency for inactive auctions
    Given an auction "12345" is being monitored
    And no bids have been placed for 10 minutes
    When the next polling cycle occurs
    Then the polling interval should increase to 10 seconds
    And the system should log "Reduced polling for inactive auction 12345"

  # BEHAVIOR 2: Automatic Cleanup
  Scenario: Remove non-existent auctions from monitoring
    Given I am monitoring auction "99999"
    When the API returns 404 for auction "99999"
    Then monitoring should stop for auction "99999"
    And an "auction-not-found" event should be emitted
    And the auction should be removed from storage

  # BEHAVIOR 3: Bid Validation
  Scenario Outline: Validate bid amounts before submission
    Given an auction with current bid of $<current>
    And minimum increment of $<increment>
    When I attempt to bid $<bid_amount>
    Then the bid should be <result>
    And I should see message "<message>"

    Examples:
      | current | increment | bid_amount | result   | message                           |
      | 100     | 5         | 100        | rejected | Bid must be higher than $100      |
      | 100     | 5         | 103        | rejected | Bid must be at least $105         |
      | 100     | 5         | 105        | accepted | Bid placed successfully           |
      | 100     | 5         | 110        | accepted | Bid placed successfully           |

  # BEHAVIOR 4: Soft Ending Extension
  Scenario: Extend auction time on last-second bids
    Given an auction ending at "14:00:00"
    And the current time is "13:59:40"
    When a bid is placed
    Then the auction end time should change to "14:00:30"
    And all connected clients should receive an "auction-extended" event
    And the extension should be logged

  # BEHAVIOR 5: Connection Recovery
  Scenario: Preserve monitoring state during disconnection
    Given I am monitoring auctions ["123", "456", "789"]
    And each auction has specific settings
    When the WebSocket connection drops
    Then monitoring state should be preserved in memory
    And reconnection should be attempted after 5 seconds
    And monitoring should resume with the same settings
```

### Step 3: Review for Effectiveness

```markdown
## Effectiveness Review Checklist

### Scenario: "Reduce polling frequency for inactive auctions"
- [x] **Business Value Clear**: Yes - Resource optimization
- [x] **Behavior Accurate**: Matches code logic exactly
- [ ] **Edge Cases**: Missing - What if bid comes during slow polling?
- [x] **Stakeholder Language**: Clear and non-technical
- [ ] **Atomic**: Could be split into detection and action

### Improvements Needed:
1. Add edge case for bid during slow polling
2. Split into two scenarios: detection and action
3. Add performance metrics validation
```

### Step 4: Review for Efficiency

```markdown
## Efficiency Review Checklist

### Overall Feature File
- [ ] **DRY Principle**: Repeated "Given I am monitoring" - use Background
- [x] **Data Tables**: Good use in bid validation
- [ ] **Parallel Execution**: Scenarios share state - need isolation
- [ ] **Execution Time**: Connection recovery takes 5+ seconds

### Refactored Version:
```

```gherkin
# Improved version after efficiency review
Feature: Auction Monitor - Discovered Behaviors

  Background:
    Given the auction service is available
    And I am authenticated

  # More efficient with shared background
  Scenario: Reduce polling frequency for inactive auctions
    Given auction "12345" has been inactive for 10 minutes
    When the monitor evaluates polling frequency
    Then polling interval should increase to 10 seconds

  # Consolidated connection scenarios
  Scenario Outline: Handle connection failures
    Given monitoring state includes <auction_count> auctions
    When the <connection_type> connection fails
    Then state should be preserved
    And reconnection should occur within <timeout> seconds

    Examples:
      | connection_type | auction_count | timeout |
      | WebSocket      | 3             | 5       |
      | API            | 5             | 10      |
```

### Step 5: Architecture Questions Raised

```markdown
## Architecture Concerns Discovered

1. **Polling Inefficiency**
   - Current: Individual timers per auction
   - Issue: 100 auctions = 100 timers
   - Question: Should we use a single polling queue?

2. **State Management**
   - Current: In-memory Map with no persistence
   - Issue: State lost on restart
   - Question: Should monitoring state be in Redis?

3. **Error Recovery**
   - Current: Simple retry with fixed delay
   - Issue: No backoff, no circuit breaker
   - Question: Implement exponential backoff?

4. **Event Handling**
   - Current: EventEmitter with no guarantees
   - Issue: Events can be lost
   - Question: Use message queue for reliability?
```

### Step 6: Final BDD Test Output

```gherkin
# tests/features/auction-monitoring-final.feature
Feature: Auction Monitoring
  As a user, I want reliable auction monitoring
  to track auctions and place bids effectively

  Background:
    Given the auction service is available
    And I am authenticated with valid session

  # Critical Business Behavior
  @critical @monitoring
  Scenario: Monitor active auction with real-time updates
    When I start monitoring auction "12345"
    Then I should receive initial auction state
    And I should receive updates when auction changes
    And monitoring should continue until auction ends

  # Resource Optimization
  @performance
  Scenario: Optimize resources for inactive auctions
    Given auction "12345" has no activity for 10 minutes
    When the monitor evaluates resource usage
    Then polling should slow to conserve resources
    But critical updates should not be missed

  # Error Handling
  @error-handling
  Scenario: Recover from temporary failures
    Given I am monitoring 3 auctions
    When the connection temporarily fails
    Then monitoring state should be preserved
    And automatic recovery should restore monitoring
    And no auction updates should be lost

  # Business Rules
  @business-rule @critical
  Scenario: Enforce soft ending rules
    Given an auction with soft-ending enabled
    When a bid arrives in the final 30 seconds
    Then auction time should extend by 30 seconds
    And all participants should be notified
```

## Summary

This example demonstrates:
1. How to analyze code for hidden behaviors
2. How to document behaviors as BDD tests
3. How to review tests for effectiveness and efficiency
4. How to identify architecture concerns
5. How to produce clean, business-focused BDD tests

The key is to:
- Start with thorough code analysis
- Document everything you find
- Review and refine multiple times
- Question existing architecture
- Focus on business value in final tests