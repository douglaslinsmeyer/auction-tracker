Feature: Application Initialization - Complete Behaviors
  As discovered during Phase 0 code analysis
  All behaviors found in index.js

  Background:
    Given environment is configured

  # Service Initialization Order
  Scenario: Initialize services in correct order
    When the application starts
    Then services should initialize in this order:
      | Service | Action |
      | storage | initialize() - establish Redis connection |
      | nellisApi | initialize() - recover cookies from storage |
      | auctionMonitor | initialize() - recover persisted auctions |
    And server should start listening only after all services ready

  # Dependency Loading
  Scenario: Handle missing Swagger dependencies gracefully
    Given swagger-ui-express is not installed
    When application starts
    Then application should continue without Swagger UI
    And "Swagger dependencies not available" should be logged

  # CORS Configuration
  Scenario Outline: Allow specific origins
    When request comes from "<origin>"
    Then CORS should <result>
    
    Examples:
      | origin | result |
      | chrome-extension://abcdef | allow |
      | http://localhost:3000 | allow |
      | http://localhost:8080 | allow |
      | https://example.com | reject |
      | null | allow |

  # Express Configuration
  Scenario: Configure Express middleware
    When server initializes
    Then these middleware should be applied in order:
      | Middleware | Configuration |
      | cors | With custom origin function |
      | express.json | For JSON parsing |
      | express.urlencoded | With extended: true |

  # Swagger Documentation
  Scenario: Load Swagger documentation when available
    Given swagger.yaml exists
    And Swagger dependencies are available
    When server starts
    Then Swagger UI should be available at /api-docs
    And custom configuration should be applied
    
  Scenario: Skip Swagger if YAML missing
    Given swagger.yaml does not exist
    When server starts
    Then "swagger.yaml not found" should be logged
    And server should continue normally

  # Static File Serving
  Scenario: Serve monitoring UI
    When server starts
    Then public directory should be served as static files
    And UI should be accessible at root path

  # Health Check
  Scenario: Provide health check endpoint
    When GET /health is called
    Then response should include:
      | Field | Value |
      | status | "healthy" |
      | uptime | Process uptime in seconds |
      | monitoredAuctions | Current count |

  # WebSocket Integration
  Scenario: Initialize WebSocket with broadcast handler
    When auctionMonitor initializes
    Then custom broadcast handler should be provided
    That calls wsHandler.broadcastAuctionState

  # Port Configuration
  Scenario: Use environment port or default
    Given PORT environment variable is "4000"
    When server starts
    Then server should listen on port 4000
    
  Scenario: Default to port 3000
    Given PORT environment variable is not set
    When server starts
    Then server should listen on port 3000

  # Logging Configuration
  Scenario: Set up Winston logger
    When logger initializes
    Then these transports should be configured:
      | Transport | Configuration |
      | File | error.log for errors only |
      | File | combined.log for all logs |
      | Console | Simple format |

  # Startup Logging
  Scenario: Log startup information
    When server starts successfully
    Then these should be logged:
      | Information | Example |
      | Port | "running on port 3000" |
      | Redis status | "Redis connected: true" |
      | Auction count | "Monitored auctions: 0" |

  # Error Handling
  Scenario: Handle startup failures
    Given storage initialization fails
    When server tries to start
    Then error should be logged
    And process should exit with code 1

  # Graceful Shutdown
  Scenario: Handle SIGTERM signal
    Given server is running
    When SIGTERM is received
    Then shutdown sequence should:
      | Step | Action |
      | 1 | Log "SIGTERM received" |
      | 2 | Close HTTP server |
      | 3 | Call auctionMonitor.shutdown() |
      | 4 | Close storage connection |
      | 5 | Exit process with code 0 |

  # Module Exports
  Scenario: Export app and logger
    When module is required
    Then exports should include:
      | Export | Type |
      | app | Express application |
      | logger | Winston logger instance |

  # WebSocket Connection Handling
  Scenario: Handle new WebSocket connections
    When WebSocket client connects
    Then wsHandler.handleConnection should be called
    With WebSocket instance and server reference

  # API Route Mounting
  Scenario: Mount API routes
    When server initializes
    Then /api routes should be handled by apiRoutes module
    And all API endpoints should be prefixed with /api