Feature: Bidding Strategies
  As a user of the auction system
  I want to use different bidding strategies
  So that I can optimize my chances of winning auctions

  Background:
    Given I am authenticated with the auction system
    And the auction service is running
    And the following auctions exist:
      | id    | currentBid | timeLeft | status |
      | AUC1  | 50        | 300      | active |
      | AUC2  | 100       | 45       | active |
      | AUC3  | 75        | 25       | active |

  # Manual Strategy Scenarios
  
  Scenario: Manual strategy never places automatic bids
    Given I am monitoring auction "AUC1" with strategy "manual" and max bid of $200
    When auction "AUC1" is updated with a higher bid of $60
    Then no automatic bid should be placed
    And the auction should remain monitored
    And I should receive a notification about being outbid

  Scenario: Manual bid placement respects max bid limit
    Given I am monitoring auction "AUC1" with strategy "manual" and max bid of $100
    When I manually place a bid of $120
    Then the bid should be rejected with error "Bid exceeds max bid limit"
    And no bid should be placed on the auction

  Scenario: Manual bid succeeds within limits
    Given I am monitoring auction "AUC1" with strategy "manual" and max bid of $100
    When I manually place a bid of $55
    Then the bid should be placed successfully
    And the auction should show my bid of $55
    And bid history should record the manual bid

  # Aggressive Strategy Scenarios

  Scenario: Aggressive strategy bids immediately when outbid
    Given I am monitoring auction "AUC1" with strategy "aggressive" and max bid of $100
    When auction "AUC1" is updated with a higher bid of $55
    Then an automatic bid of $60 should be placed immediately
    And the bid should be marked as "auto-aggressive"

  Scenario: Aggressive strategy respects max bid limit
    Given I am monitoring auction "AUC1" with strategy "aggressive" and max bid of $60
    When auction "AUC1" is updated with a higher bid of $58
    Then an automatic bid of $60 should be placed
    When auction "AUC1" is updated with a higher bid of $65
    Then no automatic bid should be placed
    And I should receive a max bid exceeded notification

  Scenario: Aggressive strategy with custom increment
    Given I am monitoring auction "AUC1" with strategy "aggressive" and max bid of $100
    And I set a custom increment of $10
    When auction "AUC1" is updated with a higher bid of $52
    Then an automatic bid of $62 should be placed

  # Last-Second (Sniping) Strategy Scenarios

  Scenario: Sniping strategy waits until final seconds
    Given I am monitoring auction "AUC2" with strategy "last-second" and max bid of $150
    When auction "AUC2" is updated with a higher bid of $110
    Then no automatic bid should be placed yet
    When auction "AUC2" time remaining drops to 30 seconds
    Then an automatic bid of $115 should be placed
    And the bid should be marked as "auto-snipe"

  Scenario: Sniping strategy with custom timing
    Given I am monitoring auction "AUC3" with strategy "sniping" and max bid of $100
    And I set snipe timing to 15 seconds
    When auction "AUC3" time remaining drops to 20 seconds
    Then no automatic bid should be placed yet
    When auction "AUC3" time remaining drops to 15 seconds
    Then an automatic bid should be placed

  Scenario: Sniping strategy handles rapid ending
    Given I am monitoring auction "AUC3" with strategy "last-second" and max bid of $100
    When auction "AUC3" suddenly jumps to 10 seconds remaining
    Then an automatic bid should be placed immediately
    And the system should log "Emergency snipe bid due to rapid time change"

  # Strategy Switching Scenarios

  Scenario: Switch from manual to aggressive mid-auction
    Given I am monitoring auction "AUC1" with strategy "manual" and max bid of $100
    When I change the strategy to "aggressive"
    Then the strategy should be updated successfully
    When auction "AUC1" is updated with a higher bid of $55
    Then an automatic bid should be placed immediately

  Scenario: Switch from aggressive to manual stops auto-bidding
    Given I am monitoring auction "AUC1" with strategy "aggressive" and max bid of $100
    And an automatic bid was placed at $55
    When I change the strategy to "manual"
    Then the strategy should be updated successfully
    When auction "AUC1" is updated with a higher bid of $60
    Then no automatic bid should be placed

  # Edge Cases and Combined Scenarios

  Scenario: Multiple strategy auctions run independently
    Given I am monitoring auction "AUC1" with strategy "manual" and max bid of $100
    And I am monitoring auction "AUC2" with strategy "aggressive" and max bid of $150
    And I am monitoring auction "AUC3" with strategy "last-second" and max bid of $100
    When auction "AUC1" is updated with a higher bid of $55
    Then no automatic bid should be placed on "AUC1"
    When auction "AUC2" is updated with a higher bid of $105
    Then an automatic bid should be placed on "AUC2"
    When auction "AUC3" time remaining drops to 25 seconds
    Then an automatic bid should be placed on "AUC3"

  Scenario: Strategy respects auction minimum increment
    Given auction "AUC1" has a minimum bid increment of $5
    And I am monitoring auction "AUC1" with strategy "aggressive" and max bid of $100
    When auction "AUC1" is updated with a higher bid of $52
    Then an automatic bid of $57 should be placed
    And not $53 as would be the default increment

  Scenario: Handle strategy errors gracefully
    Given I am monitoring auction "AUC1" with strategy "aggressive" and max bid of $100
    When the bid placement fails with "Network error"
    Then the auction should remain monitored
    And the error should be logged
    And a retry should be attempted after 2 seconds
    And I should receive an error notification