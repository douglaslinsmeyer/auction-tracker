Feature: Edge Cases and Error Handling
  As a developer
  I want the system to handle edge cases gracefully
  So that users have a reliable experience even in unusual situations

  Background:
    Given the auction service is running
    And I am authenticated

  # Network Failure Scenarios
  
  Scenario: Handle network timeout during auction update
    Given I am monitoring auction "12345"
    When the network connection times out during an update
    Then the auction should remain in monitoring state
    And a timeout error should be logged
    And the next update should be attempted
    And the user should be notified of connection issues

  Scenario: Recover from intermittent network failures
    Given I am monitoring 5 auctions
    When network failures occur 3 times within 1 minute
    Then all auctions should remain monitored
    And failed updates should be retried
    And successful updates between failures should be processed
    And connection stability should be tracked

  Scenario: Handle DNS resolution failures
    Given the Nellis API domain cannot be resolved
    When I try to monitor an auction
    Then I should receive a clear error message
    And the system should not crash
    And DNS resolution should be retried periodically
    And alternative connection methods should be attempted

  # Concurrent Operation Scenarios

  Scenario: Handle simultaneous bid attempts on same auction
    Given I am monitoring auction "12345" with max bid $100
    And another user is monitoring the same auction
    When we both attempt to bid at exactly the same time
    Then only one bid should be accepted
    And the other should receive an appropriate error
    And both users should see the updated price
    And bid history should be consistent

  Scenario: Race condition in auction ending
    Given auction "12345" has 2 seconds remaining
    When I place a bid at the last millisecond
    And the auction ends simultaneously
    Then either the bid is accepted or rejected cleanly
    And no inconsistent state should occur
    And the final result should be deterministic

  Scenario: Multiple clients modifying same auction config
    Given I am monitoring auction "12345" from two devices
    When I update the max bid from device 1 to $150
    And I update the strategy from device 2 to "aggressive"
    Then both changes should be applied
    And the latest timestamp should win for conflicts
    And both devices should sync to final state

  # Invalid Data Handling Scenarios

  Scenario: Handle corrupted auction data from API
    Given the Nellis API returns malformed JSON
    When I request auction "12345" details
    Then the error should be caught gracefully
    And the previous valid data should be retained
    And an error report should be generated
    And monitoring should continue with cached data

  Scenario: Process auction with missing required fields
    Given an auction response missing the "currentBid" field
    When the auction is processed
    Then default values should be used safely
    And a warning should be logged
    And the auction should still be monitorable
    And the UI should indicate incomplete data

  Scenario: Handle extremely large numbers
    Given auction "12345" has a current bid of $999999999
    When I try to place a bid
    Then number overflow should be prevented
    And calculations should remain accurate
    And the UI should format the number correctly
    And database storage should handle the value

  # Timeout Scenarios

  Scenario: API request timeout handling
    Given the API response time is set to 30 seconds
    When I make a request that doesn't respond
    Then the request should timeout after 10 seconds
    And resources should be cleaned up
    And the connection should be reusable
    And appropriate error should be returned

  Scenario: WebSocket connection timeout
    Given I have a WebSocket connection
    When no messages are received for 60 seconds
    Then a ping should be sent automatically
    And if no pong is received within 10 seconds
    Then the connection should be reopened
    And subscriptions should be restored

  Scenario: Long-running operation timeout
    Given I start monitoring 100 auctions at once
    When the operation takes longer than 30 seconds
    Then partial results should be saved
    And remaining operations should continue
    And progress should be reported
    And the operation should be resumable

  # Data Corruption Scenarios

  Scenario: Detect and handle storage corruption
    Given Redis contains corrupted auction data
    When I try to load the auction
    Then corruption should be detected
    And the corrupted entry should be quarantined
    And fresh data should be fetched from API
    And an integrity check should be scheduled

  Scenario: Handle partial write failures
    Given I am saving auction state
    When the write operation fails halfway
    Then the previous state should be preserved
    And the partial write should be rolled back
    And the operation should be retried
    And data integrity should be maintained

  Scenario: Recover from database inconsistencies
    Given the auction state in memory differs from database
    When inconsistency is detected
    Then the system should determine source of truth
    And synchronize to the correct state
    And log the discrepancy for investigation
    And prevent the issue from cascading

  # Resource Exhaustion Scenarios

  Scenario: Handle memory pressure gracefully
    Given system memory usage is at 90%
    When I try to monitor additional auctions
    Then less critical data should be evicted
    And essential operations should continue
    And memory usage should be reported
    And user should be warned of limitations

  Scenario: Manage file descriptor exhaustion
    Given 900 WebSocket connections are active
    When connection limit is approached
    Then new connections should be queued
    And idle connections should be closed
    And critical connections should be prioritized
    And clear error messages should be provided

  Scenario: Handle thread pool exhaustion
    Given all worker threads are busy
    When new async operations are requested
    Then operations should be queued appropriately
    And timeouts should be adjusted
    And system should remain responsive
    And queue depth should be monitored

  # Clock and Time Scenarios

  Scenario: Handle system clock changes
    Given I am monitoring auctions with specific end times
    When the system clock jumps forward 1 hour
    Then auction timers should be recalibrated
    And no auctions should end prematurely
    And time-based strategies should adjust
    And clock change should be logged

  Scenario: Manage timezone differences
    Given the server is in UTC
    And the client is in PST
    When auction times are displayed
    Then conversions should be accurate
    And daylight saving changes should be handled
    And auction endings should be unambiguous

  Scenario: Handle negative time remaining
    Given an auction shows -5 seconds remaining
    When the auction is processed
    Then it should be marked as ended immediately
    And no negative times should be displayed
    And historical data should be preserved
    And the anomaly should be investigated

  # Authentication Edge Cases

  Scenario: Token expiry during active session
    Given I have been authenticated for 23 hours
    When my token expires while monitoring auctions
    Then I should be prompted to re-authenticate
    And my monitoring should pause not stop
    And auction states should be preserved
    And seamless resumption should be possible

  Scenario: Handle authentication service migration
    Given authentication endpoint changes mid-session
    When I make an authenticated request
    Then the new endpoint should be discovered
    And authentication should succeed
    And no manual intervention should be needed
    And the transition should be logged

  # Unusual User Behavior

  Scenario: Rapid strategy switching
    Given I am monitoring auction "12345"
    When I change strategies 10 times in 10 seconds
    Then each change should be processed
    And no race conditions should occur
    And the final strategy should be active
    And rate limiting should be considered

  Scenario: Monitoring non-existent auction
    Given auction "FAKE123" does not exist
    When I try to monitor it persistently
    Then appropriate errors should be returned
    And no resources should be leaked
    And retry logic should eventually give up
    And the user should be clearly informed

  Scenario: Submitting impossibly high bids
    Given auction "12345" has current bid $50
    When I submit a bid of $1000000000
    Then the bid should be validated
    And reasonable limits should be enforced
    And clear error messages should be provided
    And the attempt should be logged