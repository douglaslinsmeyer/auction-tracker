Feature: Integration Flows - End-to-End Behaviors
  As discovered during Phase 0 code analysis
  Complete user journeys through the system

  Background:
    Given all services are initialized
    And Redis is available
    And authentication cookies are valid

  # Complete Monitoring Flow
  Scenario: Full auction monitoring lifecycle
    # Start monitoring via API
    Given a user wants to monitor auction "12345"
    When POST /api/auctions/12345/monitor with maxBid: 100
    Then auction should be added to AuctionMonitor
    And auction should be saved to Redis storage
    And polling should start every 6 seconds
    And WebSocket clients should receive auction state
    
    # Update cycle
    When polling interval triggers
    Then NellisApi.getAuctionData should be called
    And auction data should be updated in memory
    And changes should be persisted to storage
    And WebSocket broadcast should occur
    
    # Bid detection and auto-bid
    When update shows user was outbid
    And auto-bid is enabled with increment strategy
    Then bid should be placed automatically
    And bid history should be saved
    And clients should receive bid result
    
    # Auction ending
    When auction has 30 seconds remaining
    Then polling should increase to 2-second intervals
    When auction ends
    Then monitoring should stop
    And auction should remain in memory for 60 seconds
    Then auction should be removed completely

  # WebSocket Real-time Flow
  Scenario: WebSocket client interaction
    # Connection and auth
    Given a WebSocket client connects
    Then client should receive welcome message with clientId
    When client sends authenticate with valid token
    Then client should be marked as authenticated
    And current monitored auctions should be sent
    
    # Start monitoring
    When client sends startMonitoring for auction "67890"
    Then auction should be added to monitor
    And client should be subscribed automatically
    And success response should include requestId
    
    # Receive updates
    When auction data changes
    Then client should receive auctionState message
    And With complete auction information
    
    # Configuration update
    When client sends updateConfig with new maxBid: 200
    Then auction config should be updated
    And all clients should receive updated state

  # Authentication Recovery Flow
  Scenario: Cookie persistence and recovery
    # Initial authentication
    When POST /api/auth with valid cookies
    Then cookies should be saved to Redis with 24hr TTL
    
    # Server restart
    When server restarts
    And NellisApi initializes
    Then cookies should be recovered from storage
    And API calls should use recovered cookies
    
    # Validation
    When POST /api/auth/validate
    Then test auction should be fetched successfully
    And user state should confirm authentication

  # Error Recovery Flow
  Scenario: Resilient operation during failures
    # Redis failure
    Given Redis connection is lost
    When storage operations are attempted
    Then operations should fallback to memory
    And service should continue functioning
    
    # API errors with retry
    When bid placement fails with CONNECTION_ERROR
    Then retry should occur with exponential backoff
    And Up to configured retry attempts
    
    # Partial auction fetch failure
    When fetching multiple auctions
    And one auction returns 404
    Then other auctions should still be returned
    And error should be logged but not propagated

  # Settings Application Flow
  Scenario: Global settings affect new auctions
    # Configure settings
    When POST /api/settings with:
      | Setting | Value |
      | defaultMaxBid | 250 |
      | defaultStrategy | sniping |
      | snipeTiming | 3 |
      | bidBuffer | 5 |
    
    # Add new auction
    When auction is added without explicit config
    Then auction should use defaultMaxBid of 250
    And strategy should be sniping
    
    # Sniping execution
    When auction has 4 seconds remaining
    Then no bid should be placed yet
    When auction has 2 seconds remaining
    Then bid should be placed with buffer of 5

  # Bulk Monitoring Flow
  Scenario: Handle multiple concurrent auctions
    # Add multiple auctions
    When 10 auctions are added for monitoring
    Then each should have independent polling interval
    And all should be persisted to storage
    
    # Concurrent updates
    When all auctions update simultaneously
    Then updates should be processed in parallel
    And no updates should be lost
    And broadcasts should be batched efficiently
    
    # Clear all
    When POST /api/auctions/clear
    Then all polling should stop
    And all auctions should be removed from storage
    And clients should be notified

  # Startup Recovery Flow
  Scenario: Recover complete state after crash
    # Setup state
    Given 5 auctions are being monitored
    And 2 have active bids
    And various polling intervals are set
    
    # Crash and restart
    When server crashes unexpectedly
    And server restarts
    Then storage should be initialized first
    And cookies should be recovered
    And all non-ended auctions should be recovered
    And polling should resume at correct intervals
    And WebSocket clients can reconnect

  # High-frequency Trading Flow
  Scenario: Handle rapid bid changes
    # Auction nearing end
    Given auction has 30 seconds remaining
    And polling is set to 2 seconds
    
    # Rapid bidding
    When 5 bids occur within 10 seconds
    Then each update should trigger auto-bid check
    And increment strategy should respond immediately
    But duplicate bids should be prevented
    And all bid attempts should be logged
    
    # Soft ending
    When bid placed at 29 seconds remaining
    Then auction should extend by 30 seconds
    And all clients should be notified of extension