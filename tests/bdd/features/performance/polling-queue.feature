Feature: Polling Queue Performance
  As a system administrator
  I want a priority-based polling queue
  So that the system can handle many auctions efficiently

  Background:
    Given I am authenticated with a valid token
    And the external auction API is available

  @performance
  Scenario: Legacy polling continues when feature disabled
    Given the polling queue feature is disabled
    When I start monitoring 5 auctions
    Then each auction should have its own polling timer
    And the system should use individual setInterval calls

  @performance
  Scenario: Polling queue manages updates when enabled
    Given the polling queue feature is enabled
    When I start monitoring 5 auctions
    Then all auctions should be added to the polling queue
    And only one polling worker should be active
    And CPU usage should be lower than legacy polling

  @performance
  Scenario: Queue respects auction priority
    Given the polling queue feature is enabled
    And I am monitoring auction "A" ending in 5 minutes
    And I am monitoring auction "B" ending in 30 seconds
    When the polling queue processes updates
    Then auction "B" should be polled before auction "A"

  @performance
  Scenario: Queue handles auction removal
    Given the polling queue feature is enabled
    And I am monitoring 3 auctions in the queue
    When I stop monitoring one auction
    Then the auction should be removed from the queue
    And the queue should continue processing other auctions

  @performance @load
  Scenario: Queue handles high load efficiently
    Given the polling queue feature is enabled
    When I start monitoring 100 auctions for load testing
    Then the queue should handle all auctions
    And memory usage should remain stable
    And no more than 10 API requests per second should be made

  @performance
  Scenario: Queue recovers from API failures
    Given the polling queue feature is enabled
    And I am monitoring 5 auctions
    When the API becomes unavailable
    Then the queue should continue attempting polls
    And failed polls should be rescheduled
    When the API becomes available again
    Then polling should resume normally

  @performance
  Scenario: Feature flag can be toggled at runtime
    Given I am monitoring 5 auctions with legacy polling
    When I enable the polling queue feature
    Then the system should migrate to queue-based polling
    When I disable the polling queue feature
    Then the system should revert to legacy polling
    And no auctions should be lost during migration