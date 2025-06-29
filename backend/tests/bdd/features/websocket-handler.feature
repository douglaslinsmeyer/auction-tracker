Feature: WebSocket Handler - Complete Behaviors
  As discovered during Phase 0 code analysis
  All behaviors found in websocket.js

  Background:
    Given the WebSocketHandler is initialized
    And a WebSocket server is running

  # Connection Management
  Scenario: Handle new WebSocket connection
    When a client connects
    Then a unique clientId should be generated
    And client should be stored in clients Map
    And welcome message should be sent with clientId
    And current monitored auctions should be sent immediately
    
  Scenario: Generate unique client IDs
    When generateClientId is called
    Then ID should follow pattern "client_[timestamp]_[random]"
    And each ID should be unique

  # Authentication Flow
  Scenario: Authenticate client with valid token
    Given AUTH_TOKEN is "valid-token"
    When client sends authenticate message with "valid-token"
    Then client.authenticated should be set to true
    And success response should include requestId
    And "authenticated successfully" should be logged
    
  Scenario: Reject invalid authentication
    Given AUTH_TOKEN is "valid-token"
    When client sends authenticate message with "wrong-token"
    Then authenticated response should have success: false
    And error should be "Invalid authentication token"
    And client.authenticated should remain false

  # Message Routing
  Scenario Outline: Route messages to appropriate handlers
    Given client is <auth_state>
    When client sends message with type "<message_type>"
    Then <handler_method> should be called
    
    Examples:
      | auth_state | message_type | handler_method |
      | authenticated | subscribe | handleSubscribe |
      | authenticated | startMonitoring | handleStartMonitoring |
      | authenticated | stopMonitoring | handleStopMonitoring |
      | authenticated | updateConfig | handleUpdateConfig |
      | any | ping | respond with pong |
      | any | authenticate | handleAuthentication |

  # Request ID Handling
  Scenario: Preserve requestId in responses
    Given client sends message with requestId "req-123"
    When handler processes the message
    Then response should include requestId "req-123"
    And requestId should be logged

  # Subscription Management
  Scenario: Subscribe to auction updates
    Given client is authenticated
    When client subscribes to auction "12345"
    Then auction ID should be added to client.subscriptions Set
    And current auction data should be sent if available
    
  Scenario: Unsubscribe from auction
    Given client is subscribed to auction "12345"
    When client unsubscribes from auction "12345"
    Then auction ID should be removed from subscriptions
    And unsubscribe should be logged

  # Monitoring Operations
  Scenario: Start monitoring with authentication check
    Given client is not authenticated
    When client tries to start monitoring
    Then error "Not authenticated" should be sent
    And monitoring should not start
    
  Scenario: Start monitoring success flow
    Given client is authenticated
    When startMonitoring is called for auction "12345"
    Then auctionMonitor.addAuction should be called
    And response should include success status
    And auction should be added to subscriptions
    And broadcast should occur after 100ms

  # Configuration Updates
  Scenario: Update auction configuration
    Given client is authenticated
    And auction "12345" is being monitored
    When updateConfig is called with new maxBid
    Then auctionMonitor.updateAuctionConfig should be called
    And success response should be sent
    And auction state should be broadcast

  # Bid Placement
  Scenario: Place bid through WebSocket
    Given client is authenticated
    When placeBid message is received
    Then nellisApi.placeBid should be called
    And result should be sent as bidResult message
    
  Scenario: Handle bid placement errors
    Given placeBid throws an error
    When bid is attempted
    Then error message should be sent to client

  # Broadcasting
  Scenario: Broadcast to specific auction subscribers
    Given 3 clients are subscribed to auction "12345"
    And 2 clients are subscribed to auction "67890"
    When broadcastToSubscribers is called for "12345"
    Then only the 3 subscribed clients should receive message
    
  Scenario: Broadcast to all authenticated clients
    Given 5 clients are connected
    And 3 are authenticated
    When broadcastToAll is called
    Then only the 3 authenticated clients should receive message
    And broadcast count should be logged

  Scenario: Skip broadcasting to closed connections
    Given client WebSocket state is not OPEN
    When broadcast is attempted
    Then message should not be sent to that client

  # Error Handling
  Scenario: Handle malformed messages
    When client sends invalid JSON
    Then error "Invalid message format" should be sent
    And error should be logged with clientId
    
  Scenario: Handle unknown message types
    When client sends message with type "unknown"
    Then warning should be logged "Unknown message type"

  # Disconnection Handling
  Scenario: Clean up on client disconnect
    Given client is connected with subscriptions
    When client disconnects
    Then client should be removed from clients Map
    And "client disconnected" should be logged

  # Auction State Broadcasting
  Scenario: Broadcast full auction state
    Given auction "12345" exists in monitor
    When broadcastAuctionState is called
    Then complete auction object should be broadcast
    And including id, title, config, data, and status

  # Get Monitored Auctions
  Scenario: Respond to getMonitoredAuctions request
    Given client requests monitored auctions
    When handleGetMonitoredAuctions is called
    Then response should include all auctions
    And response type should be "response"
    And requestId should be preserved

  # Connection Lifecycle
  Scenario: Set up WebSocket event handlers
    When new connection is established
    Then message handler should be registered
    And close handler should be registered
    And error handler should be registered
    
  Scenario: Log WebSocket errors
    When WebSocket emits error event
    Then error should be logged with clientId