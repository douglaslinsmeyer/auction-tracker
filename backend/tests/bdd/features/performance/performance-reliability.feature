Feature: Performance and Reliability
  As a system administrator
  I want the auction system to perform reliably under load
  So that users have a consistent experience

  Background:
    Given the auction service is running
    And performance monitoring is enabled

  # Rate Limiting Scenarios
  
  Scenario: API rate limiting per user
    Given I am authenticated as "user1"
    When I make 100 API requests within 60 seconds
    Then the first 60 requests should succeed
    And subsequent requests should return 429 "Too Many Requests"
    And the response should include a "Retry-After" header
    And the rate limit should reset after the window

  Scenario: WebSocket message rate limiting
    Given I have an authenticated WebSocket connection
    When I send 50 messages within 10 seconds
    Then the first 30 messages should be processed
    And subsequent messages should be dropped
    And I should receive a rate limit warning
    But my connection should remain open

  Scenario: Different rate limits for different operations
    Given I am authenticated
    When I make 10 monitoring requests within 60 seconds
    And I make 50 status check requests within 60 seconds
    Then all monitoring requests should succeed
    And all status check requests should succeed
    Because they have different rate limit buckets

  # Circuit Breaker Scenarios

  Scenario: Circuit breaker opens on repeated failures
    Given the Nellis API is experiencing issues
    When 5 consecutive API calls fail within 30 seconds
    Then the circuit breaker should open
    And subsequent calls should fail immediately
    And an alert should be logged
    And clients should receive a "service temporarily unavailable" message

  Scenario: Circuit breaker half-open state
    Given the circuit breaker is open
    When 60 seconds have passed
    Then the circuit breaker should enter half-open state
    And allow 1 test request through
    If the test request succeeds
    Then the circuit breaker should close
    Otherwise it should remain open

  Scenario: Circuit breaker recovery
    Given the circuit breaker has been open for 5 minutes
    And the Nellis API has recovered
    When the circuit breaker tests the connection
    Then it should detect the recovery
    And gradually allow more requests through
    And return to normal operation within 2 minutes

  # Queue Management Scenarios

  Scenario: Polling queue prioritization
    Given I am monitoring 10 auctions
    And auction "HIGH1" has 30 seconds remaining
    And auction "LOW1" has 300 seconds remaining
    When the polling queue processes updates
    Then auction "HIGH1" should be updated first
    And high-priority auctions should be checked every 5 seconds
    And low-priority auctions should be checked every 30 seconds

  Scenario: Queue handles auction removal efficiently
    Given the polling queue contains 100 auctions
    When I stop monitoring 50 auctions
    Then those auctions should be removed from the queue immediately
    And queue performance should not degrade
    And remaining auctions should continue updating normally

  Scenario: Queue prevents duplicate entries
    Given auction "12345" is in the polling queue
    When multiple services try to add auction "12345" again
    Then the auction should only appear once in the queue
    And its priority should be updated to the highest requested
    And no duplicate polling should occur

  # Resource Optimization Scenarios

  Scenario: Memory usage stays within limits
    Given I am monitoring 100 auctions
    When the system runs for 1 hour
    Then memory usage should stay below 200MB
    And there should be no memory leaks
    And old auction data should be garbage collected

  Scenario: CPU usage optimization
    Given 50 auctions are being actively monitored
    When all auctions update simultaneously
    Then CPU usage should not exceed 50%
    And response times should remain under 200ms
    And no requests should timeout

  Scenario: Database connection pooling
    Given the system is under heavy load
    When 100 concurrent requests access the database
    Then connections should be pooled efficiently
    And no connection exhaustion should occur
    And connection wait time should be under 100ms

  # Load Handling Scenarios

  Scenario: Handle sudden traffic spike
    Given normal load of 10 requests per second
    When traffic suddenly increases to 100 requests per second
    Then the system should remain responsive
    And critical operations should be prioritized
    And non-critical operations should be queued
    And no data should be lost

  Scenario: Gradual degradation under extreme load
    Given the system is receiving 200 requests per second
    When load continues to increase
    Then the system should degrade gracefully
    And maintain core functionality
    And shed non-essential load
    And recover quickly when load decreases

  Scenario: Concurrent auction monitoring limit
    Given the system limit is 1000 concurrent auctions
    When I try to monitor auction 1001
    Then I should receive a "limit exceeded" error
    And be prompted to stop monitoring other auctions
    And the system should suggest less active auctions to remove

  # Failure Recovery Scenarios

  Scenario: Recover from Redis connection loss
    Given Redis connection is lost
    When the system detects the disconnection
    Then it should switch to in-memory fallback
    And continue serving requests
    And attempt to reconnect every 30 seconds
    And sync data when connection is restored

  Scenario: Handle partial service failures
    Given the bid service is down
    But monitoring service is operational
    When users access the system
    Then monitoring should continue normally
    And bid attempts should fail gracefully
    And users should be notified of limited functionality
    And full service should resume when bid service recovers

  Scenario: Automatic cleanup of stale data
    Given there are 50 ended auctions in memory
    And they have been ended for over 1 hour
    When the cleanup process runs
    Then ended auctions should be archived
    And memory should be freed
    And historical data should remain accessible
    And active auctions should be unaffected

  # Performance Monitoring Scenarios

  Scenario: Real-time performance metrics
    Given performance monitoring is active
    When I request system metrics
    Then I should see current response times
    And request throughput per second
    And error rates by category
    And resource utilization percentages

  Scenario: Performance degradation alerts
    Given response times are normally under 100ms
    When average response time exceeds 500ms for 1 minute
    Then a performance alert should be triggered
    And diagnostic information should be collected
    And recent changes should be identified
    And remediation suggestions should be provided

  Scenario: Capacity planning metrics
    Given the system has been running for 7 days
    When I request capacity metrics
    Then I should see peak concurrent users
    And maximum auction monitoring count
    And resource utilization trends
    And projected capacity limits