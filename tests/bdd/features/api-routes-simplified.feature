Feature: API Routes - Complete Behaviors (Simplified)
  As discovered during Phase 0 code analysis
  All behaviors found in api.js using generic step definitions

  Background:
    Given the API server is running
    And required services are initialized

  # Auction Retrieval
  Scenario: Get all monitored auctions
    Given 5 auctions are being monitored
    When I make a GET request to "/api/auctions"
    Then the response should be successful
    And the response should include 5 auctions
    And success should be true
    
  Scenario: Get specific auction details
    When I make a GET request to "/api/auctions/12345"
    Then nellisApi.getAuctionData should be called with "12345"
    And response should include auction data
    And errors should return 500 status

  # Configuration Validation
  Scenario Outline: Validate auction configuration
    When config is validated with <field> = <value>
    Then validation should <result>
    And error should be "<error>"
    
    Examples:
      | field | value | result | error |
      | strategy | "invalid" | fail | Invalid strategy |
      | maxBid | 0 | fail | maxBid must be greater than 0 |
      | maxBid | 10001 | fail | maxBid cannot exceed $10,000 |
      | maxBid | "abc" | fail | maxBid must be a valid number |
      | dailyLimit | 50001 | fail | dailyLimit cannot exceed $50,000 |
      | totalLimit | 100001 | fail | totalLimit cannot exceed $100,000 |
      | increment | 1001 | fail | increment cannot exceed $1,000 |
      | enabled | "yes" | fail | enabled must be a boolean value |

  Scenario: Require maxBid for non-manual strategies
    Given strategy is "increment"
    When config has no maxBid
    Then validation should fail with "maxBid is required for increment strategy"

  # Monitoring Control
  Scenario: Start monitoring with validation
    When I send a POST to "/api/auctions/123/monitor" with invalid config
    Then the response should be a bad request
    And details should list validation errors
    
  Scenario: Prevent duplicate monitoring
    Given auction "123" is already monitored
    When I send a POST to "/api/auctions/123/monitor" with maxBid 100 and strategy "increment"
    Then the response should be a bad request
    And the response should include error "Auction already being monitored"

  # Stop Monitoring
  Scenario: Stop monitoring via DELETE
    Given auction "123" is being monitored
    When I make a DELETE request to "/api/auctions/123/monitor"
    Then monitoring should stop
    And success message should be returned
    
  Scenario: Stop monitoring via POST (UI compatibility)
    Given auction "123" is being monitored
    When I make a POST request to "/api/auctions/123/stop"
    Then monitoring should stop
    And endpoint should behave identically to DELETE

  # Bulk Operations
  Scenario: Clear all monitored auctions
    Given 10 auctions are being monitored
    When I make a POST request to "/api/auctions/clear"
    Then all auctions should be removed
    And response should show cleared count of 10

  # Configuration Updates
  Scenario: Update auction configuration with validation
    Given auction "123" is being monitored
    When I make a PUT request to "/api/auctions/123/config" with body:
      """
      {"maxBid": 200, "strategy": "sniping"}
      """
    Then config should be merged with existing
    And validation should run on merged config
    And auctionMonitor.updateAuctionConfig should be called
    
  Scenario: Reject config update for non-monitored auction
    Given auction "999" is not monitored
    When I make a PUT request to "/api/auctions/999/config" with body:
      """
      {"maxBid": 150}
      """
    Then the response should be not found
    And the response should include error "Auction not being monitored"

  # Bid History
  Scenario: Get bid history with limit
    When I make a GET request to "/api/auctions/123/bids" with query "?limit=50"
    Then storage.getBidHistory should be called with limit 50
    And response should include bidHistory array
    And count should be included
    
  Scenario: Enforce bid history limit
    When I make a GET request to "/api/auctions/123/bids" with query "?limit=200"
    Then the response should be a bad request
    And the response should include error "Limit cannot exceed 100"

  # Bid Placement
  Scenario: Validate bid amount
    When I send a POST to "/api/auctions/123/bid" with amount 0
    Then the response should be a bad request
    And the response should include error "Invalid bid amount"
    
  Scenario Outline: Map bid errors to HTTP status codes
    When bid fails with errorType "<error_type>"
    Then HTTP status should be <status>
    
    Examples:
      | error_type | status |
      | DUPLICATE_BID_AMOUNT | 409 |
      | BID_TOO_LOW | 400 |
      | AUCTION_ENDED | 410 |
      | AUTHENTICATION_ERROR | 401 |
      | CONNECTION_ERROR | 503 |
      | SERVER_ERROR | 502 |

  # Authentication
  Scenario: Set authentication cookies
    When I send a POST to "/api/auth" with cookies "session=abc123; auth=def456"
    Then nellisApi.authenticate should be called
    And success status should be returned
    
  Scenario: Log authentication requests
    When I send a POST to "/api/auth" with cookies "test=cookie"
    Then request body, headers, and content-type should be logged
    
  Scenario: Require cookies in auth request
    When I send a POST to "/api/auth" without cookies
    Then the response should be a bad request
    And the response should include error "Cookies required"

  # Authentication Validation
  Scenario: Validate authentication with auction fetch
    When I make a POST request to "/api/auth/validate"
    Then test auction should be fetched
    And user state should be checked
    And authenticated status should be determined
    
  Scenario: Test bid placement during validation
    Given testBidAmount is provided
    When I make a POST request to "/api/auth/validate"
    Then safe bid amount should be used (below current)
    And bid test result should be included

  # Authentication Status
  Scenario: Get current auth status
    When I make a GET request to "/api/auth/status"
    Then response should include authenticated boolean
    And cookieCount should be provided
    And appropriate message should be shown

  # System Status
  Scenario: Get comprehensive system status
    When I make a GET request to "/api/status"
    Then response should include:
      | Field | Description |
      | monitoredAuctions | Count of monitored auctions |
      | uptime | Process uptime |
      | memory | Memory usage statistics |
      | storage.type | "redis" or "memory" |
      | storage.healthy | Redis health check result |

  # Settings Management
  Scenario: Get global settings
    When I make a GET request to "/api/settings"
    Then storage.getSettings should be called
    And current settings should be returned

  Scenario: Validate settings structure
    When I make a POST request to "/api/settings" with body:
      """
      {
        "defaultMaxBid": 15000,
        "defaultStrategy": "invalid",
        "snipeTiming": 50,
        "bidBuffer": 150,
        "retryAttempts": 15
      }
      """
    Then validation should check:
      | Setting | Validation |
      | defaultMaxBid | Between 1 and 10000 |
      | defaultStrategy | Must be "increment" or "sniping" |
      | snipeTiming | Between 1 and 30 seconds |
      | bidBuffer | Between 0 and 100 |
      | retryAttempts | Between 1 and 10 |

  Scenario: Save valid settings
    Given settings pass validation
    When I make a POST request to "/api/settings" with body:
      """
      {
        "defaultMaxBid": 150,
        "defaultStrategy": "increment",
        "snipeTiming": 15,
        "bidBuffer": 25,
        "retryAttempts": 3
      }
      """
    Then storage.saveSettings should be called
    And updated settings should be returned

  # Error Handling
  Scenario: Log and return errors consistently
    When any endpoint throws an error
    Then error should be logged with context
    And 500 status should be returned
    And error message should be in response