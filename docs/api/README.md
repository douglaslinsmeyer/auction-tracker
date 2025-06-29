# API Documentation

The Nellis Auction Backend provides both REST and WebSocket APIs for communication with the Chrome extension and other clients.

## 🌐 Base URLs

- **REST API**: `http://localhost:3000/api`
- **WebSocket**: `ws://localhost:3000/ws`
- **Swagger UI**: `http://localhost:3000/api-docs` (when enabled)

## 🔐 Authentication

**⚠️ IMPORTANT**: The server requires `AUTH_TOKEN` to be configured. There are no default tokens for security. See [MIGRATION_AUTH_TOKEN.md](../MIGRATION_AUTH_TOKEN.md) for setup instructions.

### REST API
Include the auth token in the Authorization header:
```
Authorization: Bearer YOUR_AUTH_TOKEN
```

### WebSocket
Send authentication message after connection:
```json
{
  "type": "authenticate",
  "token": "YOUR_AUTH_TOKEN"
}
```

### Request Signing (Optional)
For enhanced security, requests can be signed with HMAC-SHA256:
```
X-Signature: <base64_hmac_signature>
X-Timestamp: <unix_timestamp_ms>
```
See [REQUEST_SIGNING.md](../security/REQUEST_SIGNING.md) for implementation details.

## 📡 REST API Endpoints

### Auction Management

#### Get All Monitored Auctions
```
GET /api/auctions
```
Returns list of all currently monitored auctions with their latest data.

#### Get Specific Auction
```
GET /api/auctions/:id
```
Returns detailed data for a specific auction.

#### Start Monitoring
```
POST /api/auctions/:id/monitor
Body: {
  "maxBid": 100,
  "strategy": "aggressive|last-second|manual",
  "autoBid": true,
  "incrementAmount": 5
}
```
Begin monitoring an auction with specified configuration.

#### Stop Monitoring
```
DELETE /api/auctions/:id/monitor
```
Stop monitoring a specific auction.

#### Update Configuration
```
PUT /api/auctions/:id/config
Body: {
  "maxBid": 150,
  "strategy": "last-second"
}
```
Update monitoring configuration for an auction.

#### Clear All Auctions
```
POST /api/auctions/clear
```
Stop monitoring all auctions.

### Bidding

#### Place Manual Bid
```
POST /api/auctions/:id/bid
Body: {
  "amount": 75
}
```
Place a manual bid on an auction.

#### Get Bid History
```
GET /api/auctions/:id/bids
```
Retrieve bid history for an auction.

### Authentication

#### Set Cookies
```
POST /api/auth
Body: {
  "cookies": "auth_cookie=value; session=value"
}
```
Set authentication cookies for Nellis API access.

#### Validate Authentication
```
POST /api/auth/validate
```
Validate current authentication status.

#### Check Auth Status
```
GET /api/auth/status
```
Check if authenticated with Nellis.

### System

#### System Status
```
GET /api/status
```
Get system status including monitored auctions count and Redis status.

#### Get Settings
```
GET /api/settings
```
Retrieve global system settings.

#### Update Settings
```
POST /api/settings
Body: {
  "enableNotifications": true,
  "defaultStrategy": "aggressive"
}
```
Update global system settings.

## 🔌 WebSocket API

### Connection Flow
1. Connect to WebSocket endpoint
2. Send authentication message
3. Subscribe to auctions
4. Receive real-time updates

### Client → Server Messages

#### Authentication
```json
{
  "type": "authenticate",
  "token": "YOUR_AUTH_TOKEN"
}
```

#### Subscribe to Auction
```json
{
  "type": "subscribe",
  "auctionId": "12345"
}
```

#### Start Monitoring
```json
{
  "type": "startMonitoring",
  "auctionId": "12345",
  "config": {
    "maxBid": 100,
    "strategy": "aggressive",
    "autoBid": true
  }
}
```

#### Stop Monitoring
```json
{
  "type": "stopMonitoring",
  "auctionId": "12345"
}
```

#### Update Configuration
```json
{
  "type": "updateConfig",
  "auctionId": "12345",
  "config": {
    "maxBid": 150
  }
}
```

#### Place Bid
```json
{
  "type": "placeBid",
  "auctionId": "12345",
  "amount": 75
}
```

#### Get Monitored Auctions
```json
{
  "type": "getMonitoredAuctions"
}
```

#### Heartbeat
```json
{
  "type": "ping"
}
```

### Server → Client Messages

#### Connection Confirmation
```json
{
  "type": "connected",
  "clientId": "uuid"
}
```

#### Authentication Result
```json
{
  "type": "authenticated",
  "success": true
}
```

#### Auction Update
```json
{
  "type": "auctionUpdate",
  "auctionId": "12345",
  "data": {
    "currentBid": 75,
    "timeRemaining": 120,
    "totalBids": 15,
    "isWinning": false
  }
}
```

#### Bid Placed
```json
{
  "type": "bidPlaced",
  "auctionId": "12345",
  "amount": 80,
  "success": true
}
```

#### Error
```json
{
  "type": "error",
  "message": "Failed to place bid",
  "code": "BID_FAILED"
}
```

#### Monitoring Status
```json
{
  "type": "monitoringStatus",
  "auctions": {
    "12345": {
      "id": "12345",
      "title": "Item Title",
      "currentBid": 75,
      "status": "active"
    }
  }
}
```

## 🚨 Error Codes

### REST API Errors
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing/invalid token)
- `404` - Not Found (auction doesn't exist)
- `409` - Conflict (auction already being monitored)
- `500` - Internal Server Error

### WebSocket Error Codes
- `AUTH_REQUIRED` - Authentication needed
- `AUTH_FAILED` - Invalid token
- `INVALID_MESSAGE` - Malformed message
- `AUCTION_NOT_FOUND` - Auction doesn't exist
- `BID_FAILED` - Failed to place bid
- `ALREADY_MONITORING` - Auction already being monitored

## 📝 Response Formats

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## 🔄 Rate Limits

### REST API Rate Limits
- **General API**: 100 requests per minute per IP
- **Authentication**: 5 requests per 15 minutes per IP (only failed attempts count)
- **Bid Operations**: 10 requests per minute per IP per auction

### WebSocket Rate Limits
- **Connection Limit**: 10 connections per minute per IP
- **Message Size Limit**: 1MB per message

## 🛡️ Security Features

### Input Validation
All endpoints validate input using Joi schemas:
- Auction IDs must be numeric
- Bid amounts must be positive integers with max $999,999
- Strategy types are restricted to allowed values
- All inputs are sanitized against XSS

### CORS Protection
- Only whitelisted Chrome extensions can access the API
- Configure allowed extensions via `ALLOWED_EXTENSION_IDS` environment variable
- Additional origins can be added via `ALLOWED_ORIGINS`

### Security Headers
The API includes security headers via Helmet:
- Content Security Policy (CSP)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin

### Data Protection
- Authentication cookies are encrypted with AES-256-GCM
- Sensitive data is redacted from logs
- No stack traces exposed in production error responses

### Request Signing (Optional)
For critical operations, enable request signing:
- HMAC-SHA256 signatures prevent tampering
- 5-minute timestamp window prevents replay attacks
- Required for bid operations when enabled
- **Message Rate**: No specific limit, but excessive messages may result in disconnection

### Rate Limit Headers
When rate limited, responses include:
- `RateLimit-Limit`: Maximum requests allowed
- `RateLimit-Remaining`: Requests remaining in window
- `RateLimit-Reset`: Time when the limit resets (Unix timestamp)

### Rate Limit Response (429)
```json
{
  "success": false,
  "error": "Too many requests from this IP, please try again later.",
  "code": "RATE_LIMIT_EXCEEDED"
}
```

### Configuration
Rate limits can be configured via environment variables:
- `API_RATE_LIMIT_MAX`: General API limit (default: 100)
- `AUTH_RATE_LIMIT_MAX`: Auth endpoint limit (default: 5)
- `BID_RATE_LIMIT_MAX`: Bid endpoint limit (default: 10)
- `WS_MAX_CONNECTIONS_PER_IP`: WebSocket connection limit (default: 10)

## 📚 Additional Resources

- [Source Code Reference](../reference/SOURCE_CODE_REFERENCE.md) - Code implementation details
- [WebSocket Handler Implementation](../reference/SOURCE_CODE_REFERENCE.md#websockethandler) - Internal WebSocket logic
- [API Routes Implementation](../reference/SOURCE_CODE_REFERENCE.md#api-routes) - REST endpoint code