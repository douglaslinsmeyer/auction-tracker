Feature: Auction Monitoring - Complete Behaviors
  As discovered during Phase 0 code analysis
  All behaviors found in auctionMonitor.js
  
  Background:
    Given the storage service is initialized
    And the WebSocket server is running
    And I have valid authentication cookies

  # Core Monitoring Behaviors
  Scenario: Add new auction to monitoring
    Given auction "12345" is not currently monitored
    When I add auction "12345" with default config
    Then auction "12345" should be added to monitoredAuctions Map
    And auction should be persisted to storage
    And polling should start with 6 second interval
    And initial update should be triggered immediately
    
  Scenario: Prevent duplicate auction monitoring
    Given auction "12345" is already being monitored
    When I attempt to add auction "12345" again
    Then the add operation should return false
    And a warning should be logged "Auction 12345 is already being monitored"
    
  Scenario: Apply global settings to new auctions
    Given global settings have defaultMaxBid of 200
    And global settings have defaultStrategy of "sniping"
    When I add auction "12345" without specifying config
    Then auction should have maxBid of 200
    And auction should have strategy of "sniping"

  # State Recovery Behaviors
  Scenario: Recover persisted auctions on startup
    Given storage contains 5 persisted auctions
    And 3 auctions have status "monitoring"
    And 2 auctions have status "ended"
    When the auction monitor initializes
    Then only the 3 "monitoring" auctions should be recovered
    And polling should restart for recovered auctions
    And ended auctions should not start polling

  # Polling Behaviors
  Scenario: Adaptive polling near auction end
    Given auction "12345" is being monitored
    And auction has 25 seconds remaining
    When the monitor checks time remaining
    Then polling interval should change to 2 seconds
    And the adjustPollingRate method should be called
    
  Scenario: Clear existing interval when adjusting polling rate
    Given auction "12345" has polling interval of 6 seconds
    When polling rate is adjusted to 2 seconds
    Then the old interval should be cleared first
    And new interval should be set
    
  # Update Processing Behaviors
  Scenario: Handle auction ending during update
    Given auction "12345" is being monitored
    When update shows isClosed is true
    Then auction status should change to "ended"
    And handleAuctionEnd should be called
    And polling should stop
    
  Scenario: Detect bid changes during update
    Given auction "12345" has currentBid of $50
    When update shows currentBid of $75
    Then handleBidUpdate should be called
    And previous and new bid data should be passed
    
  Scenario: Persist auction state after each update
    Given auction "12345" is being monitored
    When any update is processed
    Then updated auction data should be saved to storage
    And lastUpdate timestamp should be updated
    
  # Auto-Bidding Behaviors
  Scenario: Skip auto-bid when already winning
    Given auction "12345" shows user is winning
    And auto-bid is enabled
    When executeAutoBid is called
    Then no bid should be placed
    And function should return early
    
  Scenario: Execute incremental strategy auto-bid
    Given auction config has strategy "increment"
    And user is not winning
    And currentBid is $50 with nextBid of $55
    And maxBid is set to $100
    When executeAutoBid is triggered
    Then bid should be placed for $55 plus bidBuffer
    
  Scenario: Execute sniping strategy with timing check
    Given auction config has strategy "sniping"
    And global snipeTiming is 5 seconds
    And auction has 10 seconds remaining
    When executeAutoBid is triggered
    Then no bid should be placed yet
    
  Scenario: Execute sniping bid at correct time
    Given auction config has strategy "sniping"
    And global snipeTiming is 5 seconds
    And auction has 4 seconds remaining
    When executeAutoBid is triggered
    Then bid should be placed immediately
    
  Scenario: Handle maximum bid reached
    Given maxBid is $100
    And nextBid would be $105
    When executeAutoBid is triggered
    Then no bid should be placed
    And maxBidReached flag should be set to true
    And warning should be logged

  # Bid Response Handling
  Scenario: Handle successful bid with immediate outbid
    Given a bid is placed successfully
    When response indicates "another user has a higher maximum bid"
    Then auction data should be updated with new values
    And for increment strategy, retry bid after 2 seconds
    And bid history should record the attempt
    
  Scenario: Save bid history for all attempts
    Given any bid attempt is made
    When bid succeeds or fails
    Then bid details should be saved to storage
    Including amount, strategy, success status, and timestamp

  # Event Broadcasting
  Scenario: Broadcast auction state after updates
    Given WebSocket clients are connected
    When auction state changes
    Then broadcastAuctionState should be called
    And all authenticated clients should receive update
    
  Scenario: Emit events for auction lifecycle
    Given auction "12345" is being monitored
    When auction ends
    Then "auctionEnded" event should be emitted
    With auctionId, finalPrice, and won status

  # Error Handling
  Scenario: Handle API errors during update
    Given auction "12345" is being monitored
    When nellisApi.getAuctionData throws error
    Then auction status should change to "error"
    And error should be logged
    And auction should be persisted with error status

  # Cleanup Behaviors  
  Scenario: Remove ended auctions after delay
    Given auction "12345" has ended
    When handleAuctionEnd is called
    Then auction should remain in memory for 60 seconds
    And then be automatically removed
    
  Scenario: Complete shutdown sequence
    When shutdown is called
    Then all polling intervals should be cleared
    And pollingIntervals Map should be empty
    And monitoredAuctions Map should be empty

  # Configuration Updates
  Scenario: Update auction configuration
    Given auction "12345" is being monitored
    When config is updated with new maxBid
    Then config should be merged with existing
    And changes should be persisted to storage
    And auction state should be broadcast