# Source Code Reference Guide

## Quick Navigation

### Core Services
- [AuctionMonitor](#auctionmonitor) - Main monitoring service
- [NellisApi](#nellisapi) - External API interface  
- [Storage](#storage) - Redis/Memory persistence
- [WebSocketHandler](#websockethandler) - Real-time communication
- [API Routes](#api-routes) - REST endpoints
- [Application Entry](#application-entry) - Startup and configuration

## AuctionMonitor
**File**: `src/services/auctionMonitor.js`
**Type**: Singleton Service (EventEmitter)
**Lines**: 413

### Key Properties
```javascript
this.monitoredAuctions = new Map();  // Line 10 - Active auctions
this.pollingIntervals = new Map();   // Line 11 - Timer references
this.wss = null;                     // Line 12 - WebSocket server ref
this.broadcastHandler = null;        // Line 14 - Custom broadcast function
```

### Initialization & Recovery
- `initialize(wss, broadcastHandler)` - Line 17-29
- `recoverPersistedState()` - Line 35-55 - Loads auctions from storage

### Auction Management
- `addAuction(auctionId, config, metadata)` - Line 57-92 - Start monitoring
- `removeAuction(auctionId)` - Line 94-107 - Stop monitoring
- `updateAuctionConfig(auctionId, config)` - Line 384-400 - Change settings

### Polling & Updates
- `startPolling(auctionId, interval)` - Line 299-311 - Begin polling
- `stopPolling(auctionId)` - Line 313-319 - Stop polling
- `adjustPollingRate(auctionId, newInterval)` - Line 321-326 - Change frequency
- `updateAuction(auctionId)` - Line 109-154 - Main update logic

### Bidding Logic
- `executeAutoBid(auctionId, auctionData)` - Line 168-266 - Auto-bid implementation
- `handleBidUpdate(auctionId, newData, oldData)` - Line 156-166 - Bid change detection
- `handleOutbid(auctionId, data)` - Line 268-276 - Outbid handling

### Event Broadcasting
- `broadcastAuctionState(auctionId)` - Line 328-363 - Send updates to clients
- `emit()` events - Lines 285, 235, 270 - Event notifications

### Cleanup
- `handleAuctionEnd(auctionId, data)` - Line 278-297 - Auction ending logic
- `shutdown()` - Line 402-411 - Clean shutdown

### Key Events Emitted
- `'bidPlaced'` - Line 235
- `'outbid'` - Line 270  
- `'auctionEnded'` - Line 285

## NellisApi
**File**: `src/services/nellisApi.js`
**Type**: Singleton Service
**Lines**: 257

### Configuration
```javascript
this.baseUrl = 'https://www.nellisauction.com';     // Line 6
this.apiUrl = 'https://cargo.prd.nellis.run/api';   // Line 7
this.cookies = '';                                   // Line 8 - Session storage
this.headers = { /* Default headers */ };            // Line 9-15
```

### Initialization
- `initialize()` - Line 19-31 - Recover cookies from storage

### API Operations
- `getAuctionData(auctionId)` - Line 33-76 - Fetch auction details
- `placeBid(auctionId, amount, retryCount)` - Line 128-221 - Place bid with retry
- `getMultipleAuctions(auctionIds)` - Line 223-240 - Batch fetch
- `searchAuctions(query, filters)` - Line 242-254 - Search (stub)

### Authentication
- `authenticate(credentials)` - Line 88-106 - Login flow (incomplete)
- `setCookies(cookieString)` - Line 109-115 - Direct cookie setting
- `checkAuth()` - Line 118-126 - Verify authentication status

### Helper Methods
- `calculateTimeRemaining(closeTimeString)` - Line 78-86 - Time math

### Error Handling
- Error categorization - Lines 174-197
- Retry logic - Lines 208-217

## Storage
**File**: `src/services/storage.js`
**Type**: Singleton Service (EventEmitter)
**Lines**: 320

### Configuration
```javascript
this.redis = null;                   // Line 7 - Redis client
this.connected = false;              // Line 8 - Connection status
this.memoryFallback = new Map();     // Line 9 - In-memory backup
this.config = {
  keyPrefix: 'nellis:',              // Line 11
  cookieTTL: 86400,                  // Line 12 - 24 hours
  auctionDataTTL: 3600,              // Line 13 - 1 hour
};
```

### Initialization
- `initialize()` - Line 17-59 - Connect to Redis with retry

### Auction Operations
- `saveAuction(auctionId, auctionData)` - Line 67-84
- `getAuction(auctionId)` - Line 86-100
- `getAllAuctions()` - Line 102-131
- `removeAuction(auctionId)` - Line 133-147

### Cookie Management
- `saveCookies(cookies)` - Line 150-166
- `getCookies()` - Line 168-181

### Bid History
- `saveBidHistory(auctionId, bidData)` - Line 184-202 - Sorted set
- `getBidHistory(auctionId, limit)` - Line 204-217

### Settings & State
- `getSettings()` - Line 253-266 - Global settings with defaults
- `saveSettings(settings)` - Line 268-283
- `getDefaultSettings()` - Line 285-298
- `saveSystemState(state)` - Line 220-235
- `getSystemState()` - Line 237-250

### Health & Cleanup
- `isHealthy()` - Line 308-317 - Redis ping check
- `close()` - Line 301-305 - Graceful shutdown

### Key Prefixes
- Auctions: `nellis:auction:{id}`
- Cookies: `nellis:auth:cookies`
- Bid History: `nellis:bid_history:{id}`
- Settings: `nellis:system:settings`
- System State: `nellis:system:state`

## WebSocketHandler
**File**: `src/services/websocket.js`
**Type**: Singleton Service
**Lines**: 356

### Client Management
```javascript
this.clients = new Map();  // Line 7 - Connected clients
```

### Connection Handling
- `handleConnection(ws, wss)` - Line 9-45 - New client setup
- `handleDisconnection(clientId)` - Line 289-292 - Cleanup
- `generateClientId()` - Line 316-318 - Unique ID generation

### Message Routing
- `handleMessage(clientId, message)` - Line 47-108 - Main router
- Message types handled:
  - `'authenticate'` → `handleAuthentication()` - Line 110-137
  - `'subscribe'` → `handleSubscribe()` - Line 139-160
  - `'startMonitoring'` → `handleStartMonitoring()` - Line 170-201
  - `'stopMonitoring'` → `handleStopMonitoring()` - Line 203-223
  - `'updateConfig'` → `handleUpdateConfig()` - Line 225-251
  - `'placeBid'` → `handlePlaceBid()` - Line 253-273
  - `'ping'` → Inline pong response - Line 90-92
  - `'getMonitoredAuctions'` → `handleGetMonitoredAuctions()` - Line 275-287

### Broadcasting
- `broadcastToSubscribers(auctionId, message)` - Line 321-328
- `broadcastToAll(message)` - Line 330-340
- `broadcastAuctionState(auctionId)` - Line 343-353

### Authentication
- Uses `AUTH_TOKEN` env var - Line 116
- Stores auth state in client object - Line 119

### Error Handling
- `sendError(clientId, error, requestId)` - Line 305-313

## API Routes
**File**: `src/routes/api.js`
**Type**: Express Router
**Lines**: 507

### Auction Endpoints
- `GET /api/auctions` - Line 8-16 - List all monitored
- `GET /api/auctions/:id` - Line 19-28 - Get specific auction
- `POST /api/auctions/:id/monitor` - Line 94-120 - Start monitoring
- `DELETE /api/auctions/:id/monitor` - Line 123-137 - Stop monitoring
- `POST /api/auctions/:id/stop` - Line 140-154 - Stop (UI compat)
- `POST /api/auctions/clear` - Line 157-177 - Clear all
- `PUT /api/auctions/:id/config` - Line 180-212 - Update config

### Bidding
- `GET /api/auctions/:id/bids` - Line 215-235 - Bid history
- `POST /api/auctions/:id/bid` - Line 238-271 - Place bid

### Authentication
- `POST /api/auth` - Line 274-295 - Set cookies
- `POST /api/auth/validate` - Line 298-380 - Validate auth
- `GET /api/auth/status` - Line 383-397 - Check status

### System
- `GET /api/status` - Line 400-417 - System status
- `GET /api/settings` - Line 420-428 - Get settings
- `POST /api/settings` - Line 431-505 - Update settings

### Validation
- `validateAuctionConfig(config)` - Line 31-91 - Config validation
- Settings validation - Lines 439-495

### Error Mapping
- HTTP status codes - Lines 250-263

## Application Entry
**File**: `src/index.js`
**Type**: Main Application
**Lines**: 158

### Dependencies
```javascript
const auctionMonitor = require('./services/auctionMonitor');  // Line 19
const nellisApi = require('./services/nellisApi');            // Line 20
const storage = require('./services/storage');                // Line 21
const apiRoutes = require('./routes/api');                    // Line 22
const wsHandler = require('./services/websocket');            // Line 23
```

### Configuration
- CORS setup - Lines 46-66
- Express middleware - Lines 68-70
- Swagger UI - Lines 73-96 (optional)
- Static files - Line 99

### Server Initialization
- `startServer()` - Line 121-144
  1. Storage.initialize() - Line 124
  2. NellisApi.initialize() - Line 127
  3. AuctionMonitor.initialize() - Line 130
  4. Server.listen() - Line 135

### WebSocket Setup
- WebSocket server creation - Line 43
- Connection handler - Lines 114-116

### Shutdown Handling
- SIGTERM handler - Lines 149-156

### Exports
- `{ app, logger }` - Line 158

## Key Patterns & Locations

### Singleton Instances
All services export singleton instances:
- `module.exports = new AuctionMonitor();` - auctionMonitor.js:413
- `module.exports = new NellisApi();` - nellisApi.js:257
- `module.exports = new StorageService();` - storage.js:320
- `module.exports = new WebSocketHandler();` - websocket.js:356

### Event Emitters
- AuctionMonitor extends EventEmitter - auctionMonitor.js:7
- StorageService extends EventEmitter - storage.js:4

### Polling Mechanism
- Individual setInterval per auction - auctionMonitor.js:306
- Stored in pollingIntervals Map - auctionMonitor.js:11

### Error Handling Patterns
- Try-catch with console.error - Throughout
- Error categorization - nellisApi.js:174-197
- Silent fallbacks - storage.js (Redis → Memory)

### State Storage
- In-memory Maps - auctionMonitor.js:10-11
- Redis with memory fallback - storage.js:9
- No persistent state in WebSocket/API layers

### Authentication
- Cookie-based - nellisApi.js:8
- Token-based for WebSocket - websocket.js:116
- No session management

### Configuration
- Environment variables - index.js:119
- Default settings - storage.js:285-298
- Hardcoded values throughout

## Common Modification Points

### To Add New API Endpoint
1. Add route in `src/routes/api.js`
2. Add validation if needed
3. Call appropriate service method
4. Return consistent response format

### To Add New WebSocket Message Type
1. Add case in `handleMessage()` - websocket.js:59
2. Create handler method
3. Update client documentation

### To Add New Service
1. Create interface in new file
2. Implement service class
3. Export singleton (current pattern)
4. Wire up in index.js initialization

### To Add New Storage Type
1. Add methods to storage.js
2. Define key prefix pattern
3. Set appropriate TTL
4. Handle Redis/memory fallback

### To Change Polling Behavior
1. Modify `startPolling()` - auctionMonitor.js:299
2. Update `adjustPollingRate()` - auctionMonitor.js:321
3. Change timing logic in `updateAuction()` - auctionMonitor.js:134

### To Modify Bid Logic
1. Update `executeAutoBid()` - auctionMonitor.js:168
2. Modify strategy checks - auctionMonitor.js:178-188
3. Change bid calculation - auctionMonitor.js:191-193

## Testing Entry Points

### Unit Test Targets
- Service methods (need DI first)
- Validation functions - api.js:31
- Helper methods - nellisApi.js:78

### Integration Test Targets
- API routes - api.js
- WebSocket flows - websocket.js
- Storage operations - storage.js

### E2E Test Targets
- Full monitoring lifecycle
- Bidding strategies
- Recovery scenarios