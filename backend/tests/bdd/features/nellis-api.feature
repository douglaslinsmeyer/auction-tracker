Feature: Nellis API Service - Complete Behaviors
  As discovered during Phase 0 code analysis
  All behaviors found in nellisApi.js

  Background:
    Given the NellisApi service is initialized
    And base URLs are configured correctly

  # Initialization and Cookie Management
  Scenario: Recover cookies from storage on initialization
    Given storage contains saved cookies "session=abc123"
    When NellisApi initializes
    Then cookies should be loaded from storage
    And "Recovered authentication cookies from storage" should be logged
    
  Scenario: Handle initialization without saved cookies
    Given storage has no saved cookies
    When NellisApi initializes
    Then cookies should remain empty
    And service should still initialize successfully

  # Auction Data Fetching
  Scenario: Fetch auction data with proper transformation
    Given valid cookies are set
    When getAuctionData is called for auction "12345"
    Then request should use _data parameter for JSON response
    And response should transform closeTime to timeRemaining in seconds
    And isClosed should be true if timeRemaining <= 0
    
  Scenario: Calculate time remaining correctly
    Given auction closeTime is "2024-12-31T23:59:59Z"
    And current time is "2024-12-31T23:59:29Z"
    When calculateTimeRemaining is called
    Then result should be 30 seconds
    
  Scenario: Handle past close times
    Given auction closeTime is in the past
    When calculateTimeRemaining is called
    Then result should be 0
    And auction should be marked as closed

  # Authentication Behaviors
  Scenario: Save cookies to storage after authentication
    When authenticate is called with cookies "new-session=xyz789"
    Then cookies should be saved to storage
    And "Saved authentication cookies to storage" should be logged
    
  Scenario: Check authentication status
    Given cookies are "session1=abc; session2=def"
    When checkAuth is called
    Then authenticated should be true
    And cookieCount should be 2

  # Bid Placement Behaviors
  Scenario: Ensure bid amounts are whole numbers
    When placeBid is called with amount 99.99
    Then bid should be placed with amount 99
    And response should show bidAmount as 99
    
  Scenario: Include proper headers for bid requests
    When placeBid is called
    Then request should include Cookie header
    And Content-Type should be "text/plain;charset=UTF-8"
    And Referer should point to auction page
    And timeout should be 10 seconds

  # Error Categorization
  Scenario Outline: Categorize bid placement errors
    When placeBid fails with message "<error_message>"
    Then errorType should be "<error_type>"
    And retryable should be <retryable>
    
    Examples:
      | error_message | error_type | retryable |
      | already placed a bid with the same price | DUPLICATE_BID_AMOUNT | false |
      | bid is too low | BID_TOO_LOW | false |
      | auction has ended | AUCTION_ENDED | false |
      | authentication required | AUTHENTICATION_ERROR | false |
      | higher bid exists | OUTBID | false |
      | ECONNREFUSED | CONNECTION_ERROR | true |
      | 500 Internal Server Error | SERVER_ERROR | true |

  # Retry Logic
  Scenario: Retry failed bids with exponential backoff
    Given global settings have retryAttempts of 3
    And bid fails with CONNECTION_ERROR
    When placeBid is called
    Then bid should be retried up to 2 more times
    And delay should increase exponentially (1s, 2s, 3s)
    
  Scenario: Do not retry non-retryable errors
    Given bid fails with BID_TOO_LOW error
    When placeBid is called
    Then no retry should be attempted
    And error should be returned immediately

  # Multiple Auction Handling
  Scenario: Fetch multiple auctions with error resilience
    Given a list of auction IDs [123, 456, 789]
    And auction 456 returns an error
    When getMultipleAuctions is called
    Then results should contain data for auctions 123 and 789
    And null values should be filtered out
    And error for auction 456 should be logged

  # Request Configuration
  Scenario: Use consistent headers for all requests
    When any API request is made
    Then User-Agent should be Mozilla/5.0
    And Accept should be application/json
    And Cache-Control should be no-cache
    And Pragma should be no-cache

  # Cookie String Handling
  Scenario: Handle setCookies alias method
    When setCookies is called with "session=new"
    Then cookies should be updated
    And cookies should be saved to storage
    And method should return true

  # Response Parsing
  Scenario: Handle malformed API responses
    Given API returns response without product data
    When getAuctionData is called
    Then error "Invalid response structure" should be thrown
    
  Scenario: Transform API response fields correctly
    Given API returns valid product data
    When getAuctionData is processed
    Then nextBid should be aliased as minimumBid
    And userState.isWinning should map to isWinning
    And all required fields should be present