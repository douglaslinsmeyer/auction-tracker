# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Full-stack auction monitoring and bidding system for nellisauction.com:
- **Backend**: `nellis-auction-backend/` - Node.js/Express service with WebSocket support
- **Extension**: `nellis-auction-helper/` - Chrome extension (Manifest V3)
- These are separate repositories that work together via WebSocket and REST APIs

## Project Documentation Guidelines
- For this project, all documentation should be consolidated into the @docs/ folder

## Development Commands

### Backend Development
```bash
# Start with Docker (includes Redis)
docker-compose up

# Development without Docker
npm run dev                    # Hot-reload with nodemon
npm start                      # Production mode

# Testing
npm test                       # All tests
npm run test:watch            # Watch mode
npm run test:unit             # Unit tests only
npm run test:integration      # Integration tests only
npm run test:coverage         # With coverage report
npm run test:bdd              # BDD tests with Cucumber
npm run test:bdd:watch        # BDD tests in watch mode
npm run test:e2e              # End-to-end tests with Puppeteer
npm run test:e2e:headful      # E2E tests with visible browser
npm run test:all              # Run all test types sequentially

# Run a single test file
npm test -- tests/unit/auctionMonitor.test.js
```

### Docker Commands
```bash
docker-compose up              # Development mode (default)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up  # Production
docker-compose build --no-cache  # Rebuild containers
docker-compose logs -f         # View logs
```

## Architecture

### Backend Architecture
- **Express + WebSocket**: REST API on `/api/*`, WebSocket on `/ws` for client communication
- **SSE Integration**: Server-Sent Events client for real-time Nellis auction updates (Phase 4.5)
- **Redis**: Primary storage (falls back to in-memory if unavailable)
- **Event-driven**: AuctionMonitor emits events for real-time updates
- **Dependency Injection**: ServiceContainer for flexible service instantiation
- **Service Interfaces**: Clean contracts (IAuctionMonitor, INellisApi, IStorage, IWebSocketHandler)
- **Services** (available as both singletons and classes):
  - `auctionMonitor`: Manages auction monitoring and bidding
  - `nellisApi`: Interface with nellisauction.com
  - `sseClient`: Connects to Nellis SSE endpoints for real-time updates (planned)
  - `storage`: Redis/memory persistence layer
  - `websocket`: Real-time client communication (relays SSE events to extension)
  - `CircuitBreakerNellisApi`: Circuit breaker pattern for API resilience
  - `PollingQueueWrapper`: Manages fallback polling when SSE unavailable

### Extension Architecture
- **Service Worker**: `background.js` - Persistent background operations
- **Content Script**: `content-isolated.js` - Page interaction
- **Backend Client**: `backend-client.js` - WebSocket connection to backend service
- **Message Passing**: Between popup, service worker, and content scripts
- **Note**: Extension continues to use WebSocket to communicate with backend; SSE is backend-to-Nellis only

## Key Implementation Details

### Auction Mechanics
- Bids received in the last 30 seconds reset the timer to 30 seconds
- Backend handles all bidding logic based on selected strategy

### Service Worker Keep-Alive
- Messages must be exchanged between extension and server within 30-second windows
- Implemented via periodic heartbeat messages

### Bidding Strategies
- **Manual**: User-triggered bids only
- **Aggressive**: Auto-bid up to max when outbid
- **Last Second**: Snipe bid in final 30 seconds

### API Documentation
- Swagger UI available at `http://localhost:3000/api-docs`
- Definition file: `swagger.yaml`
- Keep documentation updated when modifying endpoints

### Authentication
- Token-based auth for backend API (header: `Authorization`)
- Cookie synchronization for nellisauction.com authentication

### Testing Approach
- Jest with 30-second timeout per test
- Mock Redis using custom `ioredis` mock at `tests/mocks/redis.mock.js`
- Optional `redis-mock` support via `tests/support/testRedis.js` (for legacy tests)
- Test utilities in `tests/utils/`
- Integration tests use real Express server
- BDD tests using Cucumber.js with Gherkin syntax
- Multiple Jest configurations:
  - `jest.config.js` - Main configuration
  - `jest.config.bdd.js` - BDD/Cucumber tests
  - `jest.config.puppeteer.js` - E2E tests with Puppeteer
  - `jest.config.test.js` - Additional test configuration
- Test organization:
  - `tests/unit/` - Unit tests
  - `tests/integration/` - Integration tests
  - `tests/e2e/` - End-to-end tests
  - `tests/features/` - BDD feature files (Gherkin)
  - `tests/step-definitions/` and `tests/features/step_definitions/` - Step definitions
  - `tests/fixtures/` - Mock data
  - `tests/mocks/` - Custom mocks
  - `tests/support/` - Test support utilities

### Environment Configuration
- Create `.env` file with:
  ```
  AUTH_TOKEN=your-secure-token
  PORT=3000
  ```
- Default auth token: `dev-token` (change in production)

### Real-Time Communication

#### WebSocket Events (Extension ↔ Backend)
- Client → Server: `startMonitoring`, `stopMonitoring`, `placeBid`, `updateStrategy`
- Server → Client: `auctionUpdate`, `error`, `connected`, `monitoringStatus`

#### SSE Events (Nellis → Backend)
- `ch_product_bids:{productId}`: Real-time bid updates
- `ch_product_closed:{productId}`: Auction closure notifications
- Connection management handled by backend SSE client
- Automatic fallback to polling if SSE unavailable

## Claude Coding Guidelines

### Project Documentation
- When compacting, even when auto-compacting, retain in context all project documentation

### Testing Practices
- Any time we create new functionality or modify existing functionality we need to update our tests and run them, if they fail, we must fix them until they pass

### Project Phase Review
- At the end of each phase, capture a detailed review of the work performed and lessons learned, then update existing project documentation with necessary updates and revisions but DO NOT CREATE NEW VERSIONS OF EXISTING PROJECT DOCUMENTATION.

### Deliverable Review
- Before marking a phase deliverable complete, check with me that it is satisfactory.