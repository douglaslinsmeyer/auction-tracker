Feature: WebSocket Real-time Communication
  As a user of the auction system
  I want to receive real-time updates via WebSocket
  So that I can track auctions without polling

  Background:
    Given the auction service is running
    And I have a valid auth token

  # Connection Management Scenarios
  
  Scenario: Establish WebSocket connection with authentication
    When I connect to the WebSocket endpoint
    And I send an authentication message
    Then I should receive an "authenticated" message
    And my connection should be established
    And I should be subscribed to system events

  Scenario: Reject unauthenticated WebSocket connections
    When I connect to the WebSocket endpoint
    And I do not send authentication within 5 seconds
    Then my connection should be closed
    And I should receive an "authentication timeout" message

  Scenario: Handle invalid authentication token
    When I connect to the WebSocket endpoint
    And I send an invalid authentication token
    Then I should receive an "authentication failed" message
    And my connection should be closed

  # Auction Update Scenarios

  Scenario: Receive real-time auction updates
    Given I have an authenticated WebSocket connection
    And I am monitoring auction "12345"
    When auction "12345" price changes to $75
    Then I should receive an "auctionUpdate" message
    And the message should contain the new price of $75
    And the message should include time remaining

  Scenario: Receive updates only for monitored auctions
    Given I have an authenticated WebSocket connection
    And I am monitoring auction "12345"
    But I am not monitoring auction "67890"
    When auction "12345" price changes to $80
    And auction "67890" price changes to $120
    Then I should receive update for auction "12345"
    But I should not receive update for auction "67890"

  Scenario: Broadcast auction end notifications
    Given I have an authenticated WebSocket connection
    And I am monitoring auction "12345"
    When auction "12345" ends
    Then I should receive an "auctionEnded" message
    And the message should include final price
    And the message should indicate if I won

  # Message Handling Scenarios

  Scenario: Handle malformed WebSocket messages
    Given I have an authenticated WebSocket connection
    When I send a malformed JSON message
    Then I should receive an "error" message
    And the error should say "Invalid message format"
    But my connection should remain open

  Scenario: Rate limit WebSocket messages
    Given I have an authenticated WebSocket connection
    When I send 100 messages within 1 second
    Then I should receive a "rateLimitExceeded" message
    And subsequent messages should be ignored
    But my connection should remain open

  Scenario: Support bidirectional communication
    Given I have an authenticated WebSocket connection
    When I send a "placeBid" message for auction "12345" with amount $85
    Then I should receive a "bidPlaced" confirmation
    And other connected clients should receive the auction update
    And the bid should be recorded in the system

  # Connection Resilience Scenarios

  Scenario: Handle connection drops gracefully
    Given I have an authenticated WebSocket connection
    And I am monitoring 3 auctions
    When my connection drops unexpectedly
    And I reconnect within 30 seconds
    Then my auction subscriptions should be restored
    And I should receive any missed critical updates

  Scenario: Clean up resources on disconnect
    Given I have an authenticated WebSocket connection
    And I am monitoring auction "12345"
    When I disconnect from WebSocket
    Then my subscriptions should be removed
    And server resources should be freed
    But my auction monitoring should continue server-side