Feature: End-to-End Integration Flows
  As a user
  I want to use the complete auction system seamlessly
  So that I can monitor and bid on auctions effectively

  Background:
    Given the auction service is running
    And all external services are available
    And I have valid authentication credentials

  # Complete User Journey Scenarios
  
  Scenario: First-time user complete flow
    When I authenticate with the system for the first time
    Then my session should be created
    When I search for auctions containing "laptop"
    Then I should see available auctions
    When I select auction "12345" to monitor
    And I set max bid to $500 with "aggressive" strategy
    Then monitoring should start successfully
    When the auction price increases to $450
    Then an automatic bid should be placed
    When the auction ends and I win
    Then I should receive a victory notification
    And my auction history should be updated

  Scenario: Power user managing multiple auctions
    Given I am already monitoring 5 auctions
    When I authenticate from a new device
    Then all my monitored auctions should be synchronized
    When I add 3 more auctions to monitor
    Then I should be monitoring 8 auctions total
    When I view my dashboard
    Then I should see real-time updates for all auctions
    When 2 auctions end simultaneously
    Then both results should be processed correctly
    And my statistics should be updated accurately

  Scenario: Recovery from service disruption
    Given I am actively monitoring 3 auctions
    And I have placed bids on 2 of them
    When the service experiences a 5-minute outage
    And I try to access the system during the outage
    Then I should see a maintenance message
    When the service recovers
    Then my session should be restored
    And all auction states should be current
    And any missed updates should be synchronized
    And my bidding strategies should resume

  # Chrome Extension Integration Scenarios

  Scenario: Extension and backend coordination
    Given I have the Chrome extension installed
    When I log in through the extension
    Then the backend should recognize my session
    When I navigate to an auction page on Nellis
    Then the extension should detect the auction
    And offer to monitor it through the backend
    When I accept and set parameters
    Then the backend should start monitoring
    And the extension should show real-time updates
    When I close the browser
    Then monitoring should continue on the backend

  Scenario: Seamless device switching
    Given I am monitoring auctions on my desktop
    When I open the mobile web interface
    And authenticate with the same account
    Then I should see all my active auctions
    When I modify settings on mobile
    Then changes should reflect on desktop immediately
    When an auction needs attention
    Then both devices should be notified
    And actions from either device should be synchronized

  # API Contract Validation Scenarios

  Scenario: REST and WebSocket consistency
    Given I am connected via WebSocket
    When I start monitoring auction "12345" via REST API
    Then I should receive a WebSocket notification
    When the auction updates
    Then both REST polling and WebSocket should show same data
    When I place a bid via WebSocket
    Then the REST API should reflect the bid immediately
    And all connected clients should see consistent state

  Scenario: API version compatibility
    Given the backend supports API v1 and v2
    When a v1 client connects
    Then it should receive v1-formatted responses
    When a v2 client connects simultaneously
    Then it should receive v2-formatted responses
    When both clients monitor the same auction
    Then both should function correctly
    And data consistency should be maintained

  # Multi-Service Coordination Scenarios

  Scenario: Coordinated service failover
    Given I am monitoring auctions with Redis primary
    When Redis primary fails
    Then the system should switch to Redis replica
    And no monitoring data should be lost
    When I place a bid during failover
    Then the bid should be queued and processed
    When primary recovers
    Then data should be synchronized
    And normal operation should resume

  Scenario: Cross-service transaction handling
    Given I am monitoring auction "12345"
    When I place a bid that requires:
      | Service | Action |
      | Auth | Validate session |
      | Nellis API | Submit bid |
      | Storage | Save bid history |
      | WebSocket | Broadcast update |
    Then all steps should complete atomically
    If any step fails
    Then previous steps should be rolled back
    And consistent state should be maintained

  # Data Consistency Scenarios

  Scenario: Maintain consistency across storage layers
    Given auction data exists in:
      | Layer | Purpose |
      | Memory | Fast access |
      | Redis | Persistence |
      | API Cache | Reduce load |
    When the auction price updates
    Then all layers should be updated
    In the correct order to prevent inconsistency
    And read operations should always see latest data
    Even during update propagation

  Scenario: Handle split-brain scenarios
    Given two backend instances are running
    When network partition occurs between them
    And both receive updates for auction "12345"
    Then conflict should be detected
    And resolution should favor most recent update
    When partition heals
    Then instances should reconcile
    And maintain single source of truth

  # Event Propagation Scenarios

  Scenario: Event ordering guarantees
    Given I am monitoring auction "12345"
    When rapid updates occur:
      | Time | Event |
      | 0ms | Price increase to $100 |
      | 10ms | New bidder joins |
      | 20ms | Price increase to $105 |
      | 30ms | Time extension triggered |
    Then events should be processed in order
    And no updates should be lost
    And final state should be consistent
    And all clients should see same sequence

  Scenario: Broadcast efficiency at scale
    Given 1000 users are monitoring various auctions
    And 500 are watching auction "12345"
    When auction "12345" updates
    Then update should broadcast to exactly 500 users
    Within 100 milliseconds
    Without affecting other auction monitors
    And system resources should scale linearly

  # End-to-End Performance Scenarios

  Scenario: Complete bid cycle performance
    Given I am monitoring auction "12345"
    When I submit a manual bid
    Then these steps should complete within:
      | Step | Max Time |
      | API request validation | 10ms |
      | Nellis API submission | 500ms |
      | Storage update | 20ms |
      | WebSocket broadcast | 50ms |
      | UI update | 100ms |
    And total time should be under 1 second

  Scenario: Bulk operation handling
    Given I want to monitor 50 auctions at once
    When I submit the bulk request
    Then validation should complete within 100ms
    And all auctions should be added within 5 seconds
    And progress should be reported incrementally
    And partial failures should not block others
    And final status should list all results

  # Security Integration Scenarios

  Scenario: Token refresh during operations
    Given my auth token expires in 1 minute
    And I am in the middle of placing a bid
    When the token expires
    Then refresh should happen automatically
    And the bid should complete with new token
    Without user intervention
    And security should not be compromised

  Scenario: Audit trail completeness
    Given audit logging is enabled
    When I perform these actions:
      | Action | Details |
      | Login | From new device |
      | Monitor | Add auction 12345 |
      | Bid | $150 on auction 12345 |
      | Win | Auction 12345 |
    Then each action should be logged
    With complete context and timestamp
    And logs should be correlated by session
    And be queryable for compliance