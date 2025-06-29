Feature: SSE Edge Cases and Error Handling
  As a backend service
  I want to handle SSE edge cases gracefully
  So that the auction monitoring remains reliable under all conditions

  Background:
    Given the SSE client is initialized
    And feature flag "USE_SSE" is enabled

  Scenario: SSE connection failure should fallback to polling
    Given an auction with ID "123" and product ID "prod123"
    When I start monitoring the auction with strategy "manual"
    And the SSE connection fails
    Then the system should fallback to polling mode
    And auction monitoring should continue without interruption

  Scenario: Multiple rapid SSE events should be processed correctly
    Given an auction with ID "123" and product ID "prod123"
    And SSE monitoring is active
    When I receive 10 rapid bid update events within 1 second
    Then all 10 events should be processed
    And no events should be lost or duplicated
    And the auction state should reflect the latest bid

  Scenario: SSE reconnection after temporary network failure
    Given an auction with ID "123" and product ID "prod123" 
    And SSE monitoring is active
    When the SSE connection is temporarily lost
    Then the client should attempt to reconnect
    And after successful reconnection, events should resume
    And no duplicate connections should be created

  Scenario: SSE connection with invalid product ID
    Given an auction with ID "123" and invalid product ID "invalid"
    When I attempt to start SSE monitoring
    Then the SSE connection should fail gracefully
    And the system should fallback to polling mode
    And error should be logged but not crash the service

  Scenario: Maximum reconnection attempts exceeded
    Given an auction with ID "123" and product ID "prod123"
    And SSE monitoring is active
    When the SSE connection fails repeatedly
    And maximum reconnection attempts are exceeded
    Then the system should permanently fallback to polling
    And fallback event should be emitted
    And no further reconnection attempts should be made

  Scenario: SSE events with malformed JSON data
    Given an auction with ID "123" and product ID "prod123"
    And SSE monitoring is active
    When I receive an SSE event with malformed JSON
    Then the error should be caught and logged
    And the connection should remain active
    And subsequent valid events should process normally

  Scenario: Concurrent SSE connections for multiple auctions
    Given I have 5 different auctions with unique product IDs
    When I start SSE monitoring for all auctions simultaneously
    Then 5 separate SSE connections should be established
    And each connection should receive events independently
    And disconnecting one auction should not affect others

  Scenario: SSE connection cleanup on auction completion
    Given an auction with ID "123" and product ID "prod123"
    And SSE monitoring is active
    When I receive an "auction closed" SSE event
    Then the SSE connection should be automatically closed
    And the auction should be marked as completed
    And no resources should be leaked

  Scenario: SSE feature flag disabled during active monitoring
    Given an auction with ID "123" and product ID "prod123"
    And SSE monitoring is active
    When feature flag "USE_SSE" is disabled
    Then existing SSE connections should remain active
    And new monitoring requests should use polling only
    And existing auctions should continue without interruption

  Scenario: SSE session establishment and keepalive handling
    Given an auction with ID "123" and product ID "prod123"
    When I establish an SSE connection
    Then I should receive a "connected" message with session ID
    And I should receive periodic "ping" keepalive messages
    And the session ID should be stored for reference
    And keepalive messages should not trigger bid updates