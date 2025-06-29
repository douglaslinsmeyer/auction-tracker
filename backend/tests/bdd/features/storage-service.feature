Feature: Storage Service - Complete Behaviors
  As discovered during Phase 0 code analysis
  All behaviors found in storage.js

  Background:
    Given the StorageService is initialized

  # Redis Connection Management
  Scenario: Successfully connect to Redis
    Given Redis is available at configured URL
    When initialize is called
    Then connection should be established
    And connected flag should be true
    And "Redis connected" event should be emitted
    
  Scenario: Handle Redis connection with retry strategy
    Given Redis connection fails initially
    When initialize is called
    Then retry should occur with exponential backoff
    And maximum delay should be 2000ms
    And retry attempts should be logged
    
  Scenario: Fall back to memory when Redis unavailable
    Given Redis is not available
    When initialize is called
    Then connected flag should be false
    And memoryFallback Map should be used
    And error should be logged with "using in-memory fallback"

  # Event Emission
  Scenario: Emit connection lifecycle events
    Given Redis connection is established
    When connection state changes
    Then "connected" event on connect
    And "error" event on Redis errors
    And "disconnected" event on close

  # Key Management
  Scenario: Generate consistent key patterns
    When _key is called with type "auction" and id "123"
    Then key should be "nellis:auction:123"
    And keyPrefix should always be prepended

  # Auction Data Persistence
  Scenario: Save auction with TTL in Redis
    Given Redis is connected
    When saveAuction is called
    Then data should be JSON stringified
    And TTL should be set to 3600 seconds (1 hour)
    
  Scenario: Fallback auction save to memory
    Given Redis save fails
    When saveAuction is called
    Then data should be stored in memoryFallback Map
    And operation should still return true

  # Batch Operations
  Scenario: Get all auctions using Redis pipeline
    Given Redis contains 10 auction keys
    When getAllAuctions is called
    Then KEYS command should find all "nellis:auction:*"
    And pipeline should batch GET operations
    And results should be parsed from JSON
    
  Scenario: Get all auctions from memory fallback
    Given Redis is not connected
    And memoryFallback contains auction data
    When getAllAuctions is called
    Then all entries with auction prefix should be returned

  # Cookie Management
  Scenario: Save cookies with 24-hour TTL
    Given Redis is connected
    When saveCookies is called
    Then cookies should be stored at "nellis:auth:cookies"
    And TTL should be 86400 seconds (24 hours)
    
  Scenario: Retrieve cookies with fallback
    Given cookies are stored
    When getCookies is called
    Then attempt Redis first
    And fallback to memory if Redis fails

  # Bid History Management
  Scenario: Store bid history as sorted set
    Given a bid is placed at timestamp 1234567890
    When saveBidHistory is called
    Then bid should be added to sorted set with timestamp as score
    And only last 100 bids should be kept
    And TTL should be 7 days
    
  Scenario: Retrieve bid history in reverse order
    Given bid history exists
    When getBidHistory is called with limit 50
    Then bids should be returned newest first
    And maximum 50 entries should be returned

  # Settings Management
  Scenario: Return default settings when none exist
    Given no settings are stored
    When getSettings is called
    Then default settings should be returned
    And default settings should include defaultMaxBid: 100
    And defaultStrategy: "increment"
    And autoBidDefault: true
    
  Scenario: Persist settings to both Redis and memory
    When saveSettings is called
    Then settings should be JSON stringified
    And saved to Redis if connected
    And always saved to memoryFallback

  # System State Management
  Scenario: Save and retrieve system state
    Given system state includes monitoring status
    When saveSystemState is called
    Then state should be persisted
    And retrievable via getSystemState

  # Health Checks
  Scenario: Check Redis health with PING
    Given Redis is connected
    When isHealthy is called
    Then PING command should be sent
    And true returned if response is "PONG"
    
  Scenario: Report unhealthy when disconnected
    Given Redis is not connected
    When isHealthy is called
    Then false should be returned immediately

  # Cleanup Operations
  Scenario: Gracefully close Redis connection
    Given Redis connection is active
    When close is called
    Then redis.quit() should be invoked
    And connection should close cleanly

  # Data Removal
  Scenario: Remove auction from all storage
    When removeAuction is called
    Then key should be deleted from Redis
    And also removed from memoryFallback
    And operation should return true

  # Error Resilience
  Scenario: Continue operation on Redis errors
    Given Redis operations fail
    When any storage method is called
    Then error should be logged
    But operation should not throw
    And fallback behavior should activate

  # Configuration
  Scenario: Use environment variable for Redis URL
    Given REDIS_URL environment variable is set
    When initialize is called
    Then that URL should be used for connection
    And default to "redis://localhost:6379" otherwise