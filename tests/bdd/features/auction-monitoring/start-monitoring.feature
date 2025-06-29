Feature: Start Auction Monitoring
  As a user of the auction system
  I want to start monitoring auctions
  So that I can track their status and place bids automatically

  Background:
    Given I am authenticated with a valid token
    And the external auction API is available

  @websocket @mock-api
  Scenario: Successfully start monitoring an auction via WebSocket
    Given I have a WebSocket connection
    When I send a startMonitoring message for auction "12345" with config:
      | maxBid    | 100        |
      | strategy  | increment  |
      | autoBid   | true       |
    Then I should receive a "monitoringStarted" message
    And the auction "12345" should be in the monitored list
    And the auction should have the correct configuration

  @api @mock-api
  Scenario: Successfully start monitoring an auction via REST API
    When I make a POST request to "/api/auctions/12345/monitor" with body:
      """
      {
        "maxBid": 150,
        "strategy": "aggressive",
        "autoBid": false
      }
      """
    Then the response status should be 200
    And the response should contain:
      | success | true |
    And the auction "12345" should be in the monitored list

  @websocket @mock-api
  Scenario: Cannot monitor the same auction twice
    Given I am already monitoring auction "12345"
    When I send a startMonitoring message for auction "12345" with config:
      | maxBid    | 200        |
      | strategy  | sniping    |
    Then I should receive an error message "ALREADY_MONITORING"
    And the auction "12345" should still have its original configuration

  @api @validation
  Scenario: Reject invalid auction configuration
    When I make a POST request to "/api/auctions/12345/monitor" with body:
      """
      {
        "maxBid": -50,
        "strategy": "invalid-strategy",
        "autoBid": "not-a-boolean"
      }
      """
    Then the response status should be 400
    And the response should contain validation errors for:
      | field    | error                           |
      | maxBid   | must be a positive number       |
      | strategy | must be one of [manual, increment, aggressive, sniping] |
      | autoBid  | must be a boolean               |

  @websocket @redis
  Scenario: Monitoring state persists in Redis
    When I send a startMonitoring message for auction "12345" with config:
      | maxBid    | 100        |
      | strategy  | increment  |
    Then the auction "12345" should be saved in Redis
    And the Redis data should include:
      | id       | 12345      |
      | maxBid   | 100        |
      | strategy | increment  |

  @security
  Scenario: Require authentication to start monitoring
    Given I am not authenticated
    When I make a POST request to "/api/auctions/12345/monitor" without auth token
    Then the response status should be 401
    And the response should contain:
      | error | Unauthorized |

  @rate-limit
  Scenario: Rate limiting prevents monitoring spam
    Given I have already monitored 10 auctions in the last minute
    When I try to monitor another auction "99999"
    Then the response status should be 429
    And the response should contain:
      | error | Too many requests |