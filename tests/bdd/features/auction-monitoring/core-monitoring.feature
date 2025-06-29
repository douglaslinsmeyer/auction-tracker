Feature: Core Auction Monitoring
  As a user of the auction system
  I want to monitor auctions in real-time
  So that I can track prices and place timely bids

  Background:
    Given I am authenticated with the auction system
    And the auction service is running

  # Happy Path Scenarios
  
  Scenario: Successfully start monitoring an auction
    Given auction "12345" exists with current bid of $50
    When I start monitoring auction "12345" with max bid of $100
    Then auction "12345" should be actively monitored
    And I should receive real-time updates for auction "12345"
    And the auction data should be persisted in storage

  Scenario: Monitor multiple auctions simultaneously  
    Given auction "12345" exists with current bid of $50
    And auction "67890" exists with current bid of $75
    When I start monitoring auction "12345" with max bid of $100
    And I start monitoring auction "67890" with max bid of $150
    Then I should be monitoring 2 auctions
    And each auction should update independently

  Scenario: Stop monitoring an auction
    Given I am monitoring auction "12345"
    When I stop monitoring auction "12345"
    Then auction "12345" should not be monitored
    And I should not receive updates for auction "12345"
    And the auction should be removed from storage

  # Validation Scenarios

  Scenario: Cannot monitor the same auction twice
    Given I am monitoring auction "12345"
    When I try to start monitoring auction "12345" again
    Then I should receive an error "Already monitoring this auction"
    And auction "12345" should remain monitored with original settings

  Scenario: Validate auction configuration
    When I try to start monitoring auction "12345" with invalid max bid of -50
    Then I should receive a validation error "Max bid must be positive"
    And auction "12345" should not be monitored

  # State Management Scenarios

  Scenario: Recover monitored auctions after restart
    Given I am monitoring auction "12345" with max bid of $100
    And I am monitoring auction "67890" with max bid of $150
    When the auction service restarts
    Then auction "12345" should still be monitored
    And auction "67890" should still be monitored
    And all settings should be preserved

  Scenario: Handle auction state transitions
    Given I am monitoring auction "12345" in "active" state
    When auction "12345" transitions to "ending" state
    Then the auction state should be updated to "ending"
    And the appropriate bidding strategy should activate
    When auction "12345" transitions to "ended" state
    Then monitoring should stop automatically
    And final results should be recorded

  # Error Handling Scenarios

  Scenario: Handle API errors gracefully
    Given I am monitoring auction "12345"
    When the auction API becomes unavailable
    Then auction "12345" should remain in monitored list
    And an error state should be recorded
    When the auction API becomes available again
    Then monitoring should resume automatically

  Scenario: Handle invalid auction IDs
    When I try to start monitoring auction "invalid-id"
    Then I should receive an error "Invalid auction ID format"
    And no monitoring should be started