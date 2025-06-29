Feature: API Routes - Complete Behaviors
  As discovered during Phase 0 code analysis
  All behaviors found in api.js

  Background:
    Given the API server is running
    And required services are initialized

  # Auction Retrieval
  Scenario: Get all monitored auctions
    Given 5 auctions are being monitored
    When GET /api/auctions is called
    Then response should include all 5 auctions
    And success should be true
    
  Scenario: Get specific auction details
    When GET /api/auctions/12345 is called
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
    When POST /api/auctions/123/monitor with invalid config
    Then response should be 400 Bad Request
    And details should list validation errors
    
  Scenario: Prevent duplicate monitoring
    Given auction "123" is already monitored
    When POST /api/auctions/123/monitor is called
    Then response should be 400 with "Auction already being monitored"

  # Stop Monitoring
  Scenario: Stop monitoring via DELETE
    Given auction "123" is being monitored
    When DELETE /api/auctions/123/monitor is called
    Then monitoring should stop
    And success message should be returned
    
  Scenario: Stop monitoring via POST (UI compatibility)
    Given auction "123" is being monitored
    When POST /api/auctions/123/stop is called
    Then monitoring should stop
    And endpoint should behave identically to DELETE

  # Bulk Operations
  Scenario: Clear all monitored auctions
    Given 10 auctions are being monitored
    When POST /api/auctions/clear is called
    Then all auctions should be removed
    And response should show cleared count of 10

  # Configuration Updates
  Scenario: Update auction configuration with validation
    Given auction "123" is being monitored
    When PUT /api/auctions/123/config with new settings
    Then config should be merged with existing
    And validation should run on merged config
    And auctionMonitor.updateAuctionConfig should be called
    
  Scenario: Reject config update for non-monitored auction
    Given auction "999" is not monitored
    When PUT /api/auctions/999/config is called
    Then response should be 404 "Auction not being monitored"

  # Bid History
  Scenario: Get bid history with limit
    When GET /api/auctions/123/bids?limit=50 is called
    Then storage.getBidHistory should be called with limit 50
    And response should include bidHistory array
    And count should be included
    
  Scenario: Enforce bid history limit
    When GET /api/auctions/123/bids?limit=200 is called
    Then response should be 400 "Limit cannot exceed 100"

  # Bid Placement
  Scenario: Validate bid amount
    When POST /api/auctions/123/bid with amount 0
    Then response should be 400 "Invalid bid amount"
    
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
    When POST /api/auth with cookies
    Then nellisApi.authenticate should be called
    And success status should be returned
    
  Scenario: Log authentication requests
    When POST /api/auth is called
    Then request body, headers, and content-type should be logged
    
  Scenario: Require cookies in auth request
    When POST /api/auth without cookies
    Then response should be 400 "Cookies required"

  # Authentication Validation
  Scenario: Validate authentication with auction fetch
    When POST /api/auth/validate is called
    Then test auction should be fetched
    And user state should be checked
    And authenticated status should be determined
    
  Scenario: Test bid placement during validation
    Given testBidAmount is provided
    When POST /api/auth/validate is called
    Then safe bid amount should be used (below current)
    And bid test result should be included

  # Authentication Status
  Scenario: Get current auth status
    When GET /api/auth/status is called
    Then response should include authenticated boolean
    And cookieCount should be provided
    And appropriate message should be shown

  # System Status
  Scenario: Get comprehensive system status
    When GET /api/status is called
    Then response should include:
      | Field | Description |
      | monitoredAuctions | Count of monitored auctions |
      | uptime | Process uptime |
      | memory | Memory usage statistics |
      | storage.type | "redis" or "memory" |
      | storage.healthy | Redis health check result |

  # Settings Management
  Scenario: Get global settings
    When GET /api/settings is called
    Then storage.getSettings should be called
    And current settings should be returned

  Scenario: Validate settings structure
    When POST /api/settings with invalid data
    Then validation should check:
      | Setting | Validation |
      | defaultMaxBid | Between 1 and 10000 |
      | defaultStrategy | Must be "increment" or "sniping" |
      | snipeTiming | Between 1 and 30 seconds |
      | bidBuffer | Between 0 and 100 |
      | retryAttempts | Between 1 and 10 |

  Scenario: Save valid settings
    Given settings pass validation
    When POST /api/settings is called
    Then storage.saveSettings should be called
    And updated settings should be returned

  # Error Handling
  Scenario: Log and return errors consistently
    When any endpoint throws an error
    Then error should be logged with context
    And 500 status should be returned
    And error message should be in response