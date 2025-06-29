Feature: Automatic Bidding Strategies
  As a user
  I want the system to automatically bid based on my selected strategy
  So that I can win auctions without constant manual intervention

  Background:
    Given I am authenticated with a valid token
    And the external auction API is available

  @mock-api
  Scenario: Increment strategy places bid when outbid
    Given I am monitoring auction "12345" with config:
      | maxBid    | 100       |
      | strategy  | increment |
      | autoBid   | true      |
    When the auction data updates with:
      | currentBid | 50    |
      | isWinning  | false |
      | nextBid    | 55    |
    Then a bid should be placed for 55
    And the bid history should show the automatic bid

  @mock-api
  Scenario: Aggressive strategy immediately bids to maximum
    Given I am monitoring auction "12345" with config:
      | maxBid    | 200        |
      | strategy  | aggressive |
      | autoBid   | true       |
    When the auction data updates with:
      | currentBid | 50    |
      | isWinning  | false |
      | nextBid    | 55    |
    Then a bid should be placed for 200
    And the auction status should show maxBidReached as true

  @mock-api
  Scenario: Sniping strategy waits until last 30 seconds
    Given I am monitoring auction "12345" with config:
      | maxBid    | 150     |
      | strategy  | sniping |
      | autoBid   | true    |
    When the auction data updates with:
      | currentBid     | 50    |
      | isWinning      | false |
      | timeRemaining  | 120   |
    Then no bid should be placed
    When the auction data updates with:
      | currentBid     | 60    |
      | isWinning      | false |
      | timeRemaining  | 25    |
    Then a bid should be placed for 65

  @mock-api
  Scenario: Manual strategy never auto-bids
    Given I am monitoring auction "12345" with config:
      | maxBid    | 100    |
      | strategy  | manual |
      | autoBid   | true   |
    When the auction data updates with:
      | currentBid | 50    |
      | isWinning  | false |
    Then no bid should be placed

  @mock-api
  Scenario: Auto-bid respects maximum bid limit
    Given I am monitoring auction "12345" with config:
      | maxBid    | 100       |
      | strategy  | increment |
      | autoBid   | true      |
    When the auction data updates with:
      | currentBid | 95    |
      | isWinning  | false |
      | nextBid    | 105   |
    Then no bid should be placed
    And the auction status should show maxBidReached as true

  @mock-api @security
  Scenario: Auto-bid with SafeMath prevents overflow
    Given I am monitoring auction "12345" with config:
      | maxBid    | 999999    |
      | strategy  | increment |
      | autoBid   | true      |
    When the auction data updates with:
      | currentBid | 999995    |
      | isWinning  | false |
      | nextBid    | 1000000   |
    Then no bid should be placed
    And the system should log "exceeds max bid"