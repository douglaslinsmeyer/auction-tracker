# External Dependencies and API Contracts

## 1. Nellis Auction API

### Base Information
- **Production URL**: `https://www.nellisauction.com`
- **API Base URL**: `https://cargo.prd.nellis.run/api`
- **Authentication**: Cookie-based (requires valid session cookies)
- **Rate Limits**: Unknown (no documentation found)

### Discovered Endpoints

#### Get Auction Data
```http
GET https://www.nellisauction.com/p/product/{auctionId}?_data=routes/p.$title.$productId._index
```

**Request Headers**:
```
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
Accept: application/json
Accept-Language: en-US,en;q=0.9
Cache-Control: no-cache
Pragma: no-cache
Cookie: {session_cookies}
```

**Response Structure**:
```javascript
{
  "product": {
    "id": "string",
    "title": "string",
    "currentPrice": number,
    "retailPrice": number,
    "bidCount": number,
    "bidderCount": number,
    "marketStatus": "active" | "sold" | "closed",
    "isClosed": boolean,
    "closeTime": {
      "value": "ISO 8601 datetime string"
    },
    "extensionInterval": number, // Usually 30 seconds
    "location": "string",
    "inventoryNumber": "string",
    "userState": {
      "isWinning": boolean,
      "isWatching": boolean,
      "nextBid": number
    }
  }
}
```

#### Place Bid
```http
POST https://www.nellisauction.com/api/bids
```

**Request Headers**:
```
Content-Type: text/plain;charset=UTF-8
Accept: */*
Cache-Control: no-cache
Pragma: no-cache
Cookie: {session_cookies}
Referer: https://www.nellisauction.com/p/product/{auctionId}
Origin: https://www.nellisauction.com
```

**Request Body**:
```javascript
{
  "productId": number, // Must be integer
  "bid": number        // Must be whole number
}
```

**Response - Success**:
```javascript
{
  "success": true,
  "data": {
    "currentAmount": number,
    "minimumNextBid": number,
    "bidCount": number,
    "bidderCount": number
  }
}
```

**Response - Outbid**:
```javascript
{
  "success": true,
  "message": "Your bid was accepted, but another user has a higher maximum bid",
  "data": {
    "currentAmount": number,
    "minimumNextBid": number
  }
}
```

**Error Responses**:
- `"You have already placed a bid with the same price"` - 409
- `"Your bid is too low"` - 400
- `"This auction has ended"` - 410
- `"Authentication required"` - 401

### Undocumented Behaviors
1. **Soft Endings**: Bids in last 30 seconds extend auction by 30 seconds
2. **Bid Increments**: Server determines minimum bid increments
3. **Rate Limiting**: Suspected but limits unknown
4. **Cookie Expiration**: Sessions expire after unknown period
5. **Time Sync**: Server time may differ from client

### Critical Dependencies
- Cookies must include valid session information
- All bid amounts must be integers
- Product IDs must be parsed as integers
- Referer header required for bid placement

## 2. Redis

### Connection Details
- **Default URL**: `redis://localhost:6379`
- **Environment Variable**: `REDIS_URL`
- **Client Library**: `ioredis` v5.3.2

### Data Structures Used

#### Strings
- `nellis:auth:cookies` - Session cookies (TTL: 24 hours)
- `nellis:auction:{id}` - Auction data JSON (TTL: 1 hour)
- `nellis:system:state` - System state JSON
- `nellis:system:settings` - Global settings JSON

#### Sorted Sets
- `nellis:bid_history:{auctionId}` - Bid history (TTL: 7 days)
  - Score: timestamp
  - Member: JSON bid data

### Redis Configuration Requirements
```javascript
{
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true
}
```

### Fallback Behavior
- On connection failure: Falls back to in-memory Map
- No persistence across restarts in fallback mode
- All operations must handle both Redis and memory paths

## 3. Chrome Extension Integration

### WebSocket Protocol

#### Connection
```javascript
ws://localhost:3000/ws
```

#### Message Format
All messages are JSON with structure:
```javascript
{
  "type": "message_type",
  "requestId": "optional_correlation_id",
  // ... message specific fields
}
```

#### Client → Server Messages

**Authenticate**:
```javascript
{
  "type": "authenticate",
  "token": "auth_token",
  "requestId": "uuid"
}
```

**Start Monitoring**:
```javascript
{
  "type": "startMonitoring",
  "auctionId": "12345",
  "config": {
    "maxBid": 100,
    "strategy": "increment" | "sniping",
    "autoBid": boolean
  },
  "metadata": {
    "title": "Auction Title",
    "url": "https://...",
    "imageUrl": "https://..."
  },
  "requestId": "uuid"
}
```

**Update Config**:
```javascript
{
  "type": "updateConfig",
  "auctionId": "12345",
  "config": {
    // Partial config updates
  },
  "requestId": "uuid"
}
```

#### Server → Client Messages

**Auction State**:
```javascript
{
  "type": "auctionState",
  "auction": {
    "id": "12345",
    "status": "monitoring" | "ended" | "error",
    "data": { /* current auction data */ },
    "config": { /* auction config */ },
    "lastUpdate": timestamp
  }
}
```

**Response**:
```javascript
{
  "type": "response",
  "requestId": "uuid",
  "action": "startMonitoring",
  "success": boolean,
  "data": { /* response data */ }
}
```

### REST API Integration

#### Cookie Sync
```http
POST http://localhost:3000/api/auth
Content-Type: application/json

{
  "cookies": "session=abc123; other=xyz789"
}
```

#### Validation
```http
POST http://localhost:3000/api/auth/validate
Content-Type: application/json

{
  "auctionId": "12345",      // Optional test auction
  "testBidAmount": 1         // Optional test bid
}
```

## 4. NPM Dependencies

### Production Dependencies
```json
{
  "axios": "^1.6.0",           // HTTP client for Nellis API
  "cors": "^2.8.5",            // CORS middleware
  "express": "^4.18.2",        // Web framework
  "ioredis": "^5.3.2",         // Redis client
  "joi": "^17.11.0",           // Validation (unused?)
  "node-cron": "^3.0.2",       // Cron jobs (unused?)
  "redis": "^4.6.12",          // Duplicate Redis client?
  "winston": "^3.11.0",        // Logging
  "ws": "^8.14.0"              // WebSocket server
}
```

### Known Issues
- Two Redis clients installed (ioredis and redis)
- joi installed but not used
- node-cron installed but not used

## 5. System Requirements

### Node.js
- **Required Version**: >= 18.0.0
- **Features Used**: 
  - Native EventEmitter
  - Promise-based APIs
  - ES6+ syntax

### Network Requirements
- Outbound HTTPS to nellisauction.com
- Inbound HTTP/WebSocket on configured port
- Redis connection (optional)

### Environment Variables
```bash
PORT=3000                    # Server port
REDIS_URL=redis://localhost:6379  # Redis connection
AUTH_TOKEN=your-token        # WebSocket auth token
```

## 6. Integration Points Summary

| Dependency | Critical | Fallback | Documentation |
|------------|----------|----------|---------------|
| Nellis API | Yes | No | Reverse engineered |
| Redis | No | Memory | Partial |
| Chrome Extension | Yes | No | WebSocket protocol |
| Node.js 18+ | Yes | No | Yes |

## 7. Missing Documentation

1. **Nellis API**:
   - Official API documentation
   - Rate limits
   - Error code meanings
   - Webhook support?
   - Batch operations?

2. **Authentication**:
   - Cookie format
   - Session duration
   - Refresh mechanism
   - Multi-account support?

3. **Business Rules**:
   - Bid increment calculations
   - Soft ending rules
   - Reserve prices
   - Buyer fees

## 8. Recommended Actions

1. **Contact Nellis**: Request official API documentation
2. **Implement Circuit Breaker**: Protect against API failures
3. **Add Request Logging**: Track API usage patterns
4. **Cookie Refresh**: Implement automatic cookie refresh
5. **API Versioning**: Prepare for API changes