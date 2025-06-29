Feature: Authentication Management
  As a user of the auction system
  I want to securely authenticate with Nellis Auction
  So that I can monitor and bid on auctions

  Background:
    Given the auction service is running

  # Token Authentication Scenarios
  
  Scenario: Authenticate with valid token
    When I authenticate with a valid auth token
    Then I should receive a success response
    And I should be able to access protected endpoints
    And my session should be established

  Scenario: Reject invalid authentication token
    When I authenticate with an invalid token "bad-token-123"
    Then I should receive a 401 unauthorized error
    And I should not be able to access protected endpoints

  Scenario: Reject missing authentication token
    When I make a request without an auth token
    Then I should receive a 401 unauthorized error
    And the error should say "Authentication required"

  # Cookie Management Scenarios

  Scenario: Save Nellis cookies after authentication
    Given I have valid Nellis auction cookies
    When I authenticate with the system
    Then the cookies should be encrypted and stored
    And the cookies should be available for API requests
    And cookie expiration should be tracked

  Scenario: Update cookies when they change
    Given I am authenticated with saved cookies
    When Nellis returns updated cookies in a response
    Then the new cookies should replace the old ones
    And the cookie update timestamp should be recorded

  Scenario: Handle expired cookies gracefully
    Given I am authenticated with cookies that expired
    When I try to access an auction
    Then I should receive a "cookies expired" error
    And the system should prompt for re-authentication
    And monitoring should pause until re-authenticated

  # Session Management Scenarios

  Scenario: Maintain session across requests
    Given I am authenticated
    When I make multiple API requests
    Then each request should include my session
    And I should not need to re-authenticate
    And my session should remain active

  Scenario: Session timeout after inactivity
    Given I am authenticated
    When I am inactive for 30 minutes
    Then my session should expire
    And I should need to authenticate again
    And my monitored auctions should be paused

  Scenario: Concurrent session handling
    Given I authenticate from one client
    When I authenticate from another client
    Then both sessions should be valid
    And auction updates should go to both clients
    And each session should track separately

  # WebSocket Authentication Scenarios

  Scenario: WebSocket requires authentication
    When I connect to WebSocket without authentication
    Then the connection should be refused
    And I should receive an authentication required message

  Scenario: WebSocket authentication with token
    Given I have a valid auth token
    When I connect to WebSocket
    And I send authentication message with my token
    Then I should receive an authenticated confirmation
    And I should receive auction updates

  Scenario: WebSocket re-authentication on disconnect
    Given I have an authenticated WebSocket connection
    When the connection is lost and restored
    Then I should be prompted to re-authenticate
    And my auction subscriptions should be restored
    And I should not miss any critical updates

  # Error Handling Scenarios

  Scenario: Handle authentication service unavailable
    When the authentication service is down
    And I try to authenticate
    Then I should receive a service unavailable error
    And the error should be logged
    But existing authenticated sessions should continue

  Scenario: Recover from temporary auth failures
    Given authentication fails temporarily
    When I retry authentication after 5 seconds
    Then authentication should succeed
    And normal operation should resume
    And the temporary failure should be logged

  # Security Scenarios

  Scenario: Prevent authentication token reuse
    Given I have used an auth token once
    When I try to use the same token again after logout
    Then the authentication should fail
    And I should receive a "token expired" error

  Scenario: Rate limit authentication attempts
    When I make 10 failed authentication attempts
    Then further attempts should be rate limited
    And I should receive a "too many attempts" error
    And I should need to wait before trying again