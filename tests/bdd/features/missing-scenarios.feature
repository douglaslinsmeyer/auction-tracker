Feature: Missing Test Scenarios
  Additional scenarios discovered during deeper analysis
  These were not captured in the initial BDD documentation

  Background:
    Given all services are initialized
    And test environment is isolated

  # Concurrent Operation Scenarios
  
  Scenario: Concurrent bid collision
    Given two users are monitoring the same auction "12345"
    And both have auto-bid enabled with increment strategy
    When user A is outbid triggering auto-bid
    And user B is outbid at the exact same time
    Then only one bid should be placed first
    And the second bid should account for the first
    And no duplicate bid errors should occur
    
  Scenario: Simultaneous auction additions
    Given 10 users have the extension
    When all users try to monitor auction "12345" simultaneously
    Then only the first request should succeed
    And subsequent requests should receive "already monitoring"
    And no race conditions should corrupt state
    
  Scenario: WebSocket broadcast during connection surge
    Given 100 clients are connected
    When 50 new clients connect simultaneously
    And an auction update occurs during connection
    Then all 150 clients should receive the update
    And no messages should be lost
    And server should remain responsive

  # Edge Case Time Scenarios
  
  Scenario: Clock skew between server and Nellis
    Given server clock is 5 seconds behind Nellis
    And auction has 3 seconds remaining per Nellis
    When server calculates time remaining
    Then server shows -2 seconds (already ended)
    And monitoring should handle gracefully
    And not miss last-second bid opportunity
    
  Scenario: Daylight saving time transition
    Given auction ends at 2:00 AM on DST change day
    When clocks "spring forward" at 2:00 AM
    Then auction end time should adjust correctly
    And no auctions should end an hour early/late
    
  Scenario: Leap second handling
    Given auction ends at 23:59:60 (leap second)
    When calculating time remaining
    Then system should not crash
    And timing should remain accurate

  # Resource Exhaustion Scenarios
  
  Scenario: Memory pressure with many auctions
    Given system is monitoring 500 auctions
    And memory usage is at 80% capacity
    When garbage collection runs
    Then ended auctions should be cleaned up
    And memory should be reclaimed
    And active auctions should be unaffected
    
  Scenario: Redis memory limit reached
    Given Redis maxmemory is set to 100MB
    And storage is at 99MB used
    When saving a new auction
    Then eviction policy should activate
    And critical data should be preserved
    And system should remain functional
    
  Scenario: File descriptor exhaustion
    Given system has 1000 file descriptor limit
    And 990 WebSocket connections exist
    When making HTTP requests to Nellis API
    Then connections should be reused
    And no EMFILE errors should occur

  # Network Partition Scenarios
  
  Scenario: Split brain with Redis
    Given Redis connection is established
    And auction data is being saved
    When network partition occurs
    Then memory fallback should activate
    And writes should go to memory
    And reads should check both sources
    When partition heals
    Then data should reconcile correctly
    
  Scenario: Partial WebSocket message delivery
    Given large auction update (1MB) being sent
    When network interruption occurs mid-message
    Then partial message should be discarded
    And client should not crash
    And reconnection should restore state

  # Authentication Edge Cases
  
  Scenario: Cookie expiry during active bid
    Given user is monitoring auction with 1 minute left
    And auto-bid is about to trigger
    When authentication cookies expire
    Then bid should fail with auth error
    And user should be notified immediately
    And monitoring should pause not stop
    
  Scenario: Multiple authentication attempts
    Given client sends authenticate message
    When client sends another auth before response
    Then both requests should be processed
    And responses should include correct requestIds
    And final state should be consistent

  # Data Corruption Scenarios
  
  Scenario: Malformed auction data from Nellis
    Given Nellis API returns corrupted JSON
    When parsing auction data
    Then error should be logged with details
    And auction should mark as error state
    And monitoring should continue for others
    
  Scenario: Redis data corruption
    Given auction data in Redis is corrupted
    When loading auctions on startup
    Then corrupted entries should be skipped
    And valid auctions should load
    And corruption should be logged

  # Bid Strategy Edge Cases
  
  Scenario: Snipe bid at exact moment auction extends
    Given auction has 3 seconds remaining
    And snipe is configured for 5 seconds
    When bid is placed at 3 seconds
    And auction extends by 30 seconds
    Then strategy should recalculate
    And not bid again immediately
    
  Scenario: Maximum bid reached during increment
    Given max bid is $100
    And current bid is $95
    When auto-increment would bid $101
    Then bid should be capped at $100
    And user should be notified once
    And no repeated notifications

  # Recovery Scenarios
  
  Scenario: Recover from process crash
    Given 50 auctions are being monitored
    And various states and timers exist
    When process crashes and restarts
    Then all non-ended auctions should resume
    And polling intervals should be restored
    And WebSocket clients should reconnect
    And no duplicate monitoring should occur
    
  Scenario: Recover from Redis split-brain
    Given Redis cluster has split-brain
    And different data exists in each partition
    When split-brain is resolved
    Then data should merge correctly
    And no auction data should be lost
    And latest updates should win

  # Performance Degradation
  
  Scenario: API response time degradation
    Given Nellis API responds slowly (5s latency)
    And 100 auctions are being monitored
    When polling intervals trigger
    Then requests should not pile up
    And system should implement backpressure
    And critical auctions should be prioritized
    
  Scenario: WebSocket message queue overflow
    Given 1000 auction updates occur in 1 second
    When broadcasting to 100 clients
    Then message queue should not overflow
    And old messages should be dropped if needed
    And critical messages should be preserved

  # Business Logic Edge Cases
  
  Scenario: Bid increment changes mid-auction
    Given auction has $5 increment
    And auto-bid is configured
    When Nellis changes increment to $10
    Then next bid should use new increment
    And strategy should adapt
    
  Scenario: Reserve price not met
    Given auction has hidden reserve price
    And current bid is below reserve
    When placing bid above current but below reserve
    Then bid should be accepted
    But winning status should remain false
    And UI should indicate reserve not met

  # Integration Failure Scenarios
  
  Scenario: Chrome extension disconnects during bid
    Given extension is placing bid via WebSocket
    When connection drops before response
    Then bid result should be queried
    And duplicate bid should not be placed
    And result should be saved to history
    
  Scenario: Partial system degradation
    Given Redis is down
    And memory fallback is active
    When server needs to restart
    Then active auctions should be saved to disk
    And recovery should read from disk
    And monitoring should resume