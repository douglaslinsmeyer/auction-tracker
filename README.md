# Nellis Auction Backend Service

Backend service for the Nellis Auction Helper Chrome extension. Provides 24/7 auction monitoring and automated bidding capabilities.

## 📚 Documentation

All project documentation is organized in the [`docs/`](./docs/) directory. Start with the [Documentation Index](./docs/README.md).

### Quick Links
- 🚀 [Development Guide](./docs/development/DEVELOPMENT.md) - Setup and workflow
- 📊 [Architecture Overview](./docs/phase-0/ARCHITECTURE_ASSESSMENT.md) - System design
- 🧪 [Testing Strategy](./docs/planning/BDD_TESTING_PLAN.md) - BDD approach
- 🔧 [API Reference](./docs/api/README.md) - REST and WebSocket APIs
- 📋 [Production Checklist](./docs/planning/PRODUCTION_READINESS_CHECKLIST.md) - Go-live requirements

## Features

- 24/7 auction monitoring (works when browser is closed)
- Real-time WebSocket updates
- REST API for extension communication
- Automated bidding based on configured strategies
- Docker containerization for easy deployment
- **Rate limiting protection** against API abuse and DDoS attacks
- **Automatic memory cleanup** for ended auctions to prevent memory leaks
- **Request signing** (optional) for enhanced API security with HMAC-SHA256

## Quick Start

### Using Docker Compose (Recommended)

1. Copy the environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set your auth token:
   ```
   AUTH_TOKEN=your-secure-token-here
   ```
   
   **⚠️ CRITICAL**: The AUTH_TOKEN is **required** - the server will not start without it!
   - No default or fallback values exist for security
   - Generate a secure token using: `openssl rand -hex 32`
   - For migration from older versions, see [MIGRATION_AUTH_TOKEN.md](./docs/MIGRATION_AUTH_TOKEN.md)

3. Build and start the service:
   ```bash
   docker-compose up -d
   ```

4. Check service health:
   ```bash
   curl http://localhost:3000/health
   ```

### Manual Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set environment variables:
   ```bash
   cp .env.example .env
   # Edit .env file
   ```

3. Start the service:
   ```bash
   npm start
   ```

## API Endpoints

### REST API

- `GET /health` - Health check endpoint
- `GET /api/status` - System status
- `GET /api/auctions` - List all monitored auctions
- `GET /api/auctions/:id` - Get specific auction details
- `POST /api/auctions/:id/monitor` - Start monitoring an auction
- `DELETE /api/auctions/:id/monitor` - Stop monitoring an auction
- `PUT /api/auctions/:id/config` - Update auction configuration
- `POST /api/auctions/:id/bid` - Place a bid
- `POST /api/auth` - Set authentication credentials

### WebSocket API

Connect to `ws://localhost:3000` and authenticate:

```javascript
// Connect
const ws = new WebSocket('ws://localhost:3000');

// Authenticate
ws.send(JSON.stringify({
  type: 'authenticate',
  token: 'your-auth-token'
}));

// Subscribe to auction updates
ws.send(JSON.stringify({
  type: 'subscribe',
  auctionId: '12345'
}));

// Start monitoring
ws.send(JSON.stringify({
  type: 'startMonitoring',
  auctionId: '12345',
  config: {
    maxBid: 100,
    autoBid: true,
    strategy: 'lastSecond'
  }
}));
```

## Configuration

### Auction Monitoring Config

```javascript
{
  maxBid: 100,              // Maximum bid amount
  bidIncrement: 1,          // Bid increment amount
  strategy: 'manual',       // Bidding strategy: 'manual', 'aggressive', 'lastSecond'
  autoBid: false,           // Enable automatic bidding
  notifyOnOutbid: true,     // Notify when outbid
  notifyOnEnd: true         // Notify when auction ends
}
```

### Environment Variables

See `.env.example` for all available configuration options.

## Development

```bash
# Install dev dependencies
npm install

# Run in development mode with auto-reload
npm run dev

# Run tests
npm test
```

## Docker Build

```bash
# Build image
docker build -t nellis-auction-backend .

# Run container
docker run -d -p 3000:3000 --env-file .env nellis-auction-backend
```

## Security Features

### Recent Security Improvements ✅
All 13 identified security vulnerabilities have been fixed:
- **Authentication**: No hardcoded tokens - AUTH_TOKEN required at startup
- **Rate Limiting**: Protection against API abuse and DDoS attacks
- **Input Validation**: Comprehensive validation on all endpoints using Joi
- **Data Encryption**: AES-256-GCM encryption for sensitive data at rest
- **Secure Logging**: Automatic redaction of tokens, cookies, and sensitive data
- **CORS Protection**: Whitelist-based Chrome extension authorization
- **Security Headers**: Helmet middleware with CSP, X-Frame-Options, etc.
- **Request Signing**: Optional HMAC-SHA256 signatures for enhanced security
- **Safe Math**: Protection against integer overflow in bid calculations
- **Error Handling**: No stack traces exposed in production

### Security Configuration
- `AUTH_TOKEN` - Required authentication token (no defaults)
- `ENCRYPTION_SECRET` - For encrypting sensitive data
- `API_SIGNING_SECRET` - For request signature verification
- `ALLOWED_EXTENSION_IDS` - Comma-separated list of authorized Chrome extensions

See [Security Documentation](./docs/phase-0/SECURITY_VULNERABILITIES.md) for details.

## Monitoring

The service logs to:
- Console (stdout)
- `error.log` - Error level logs only
- `combined.log` - All logs

## Architecture

### Core Technologies
- **Express.js** - REST API server
- **WebSocket (ws)** - Real-time bidirectional communication
- **Redis** - Data persistence (with in-memory fallback)
- **Axios** - HTTP client for Nellis API
- **Winston** - Secure logging with redaction

### Service Architecture
The backend uses a modular service architecture with:
- **Service Interfaces** - Clean contracts for all major services
- **Dependency Injection** - ServiceContainer for flexible instantiation
- **Backward Compatibility** - Both singleton and class-based usage supported

#### Services
- `auctionMonitor` - Manages auction monitoring and bidding strategies
- `nellisApi` - Interfaces with nellisauction.com
- `storage` - Handles data persistence (Redis/memory)
- `wsHandler` - Manages WebSocket connections

All services are available as both singletons (legacy) and classes (modern):
```javascript
// Legacy (singleton) - still works
const auctionMonitor = require('./services/auctionMonitor');

// Modern (class-based) - new option
const { AuctionMonitorClass } = require('./services');
const monitor = new AuctionMonitorClass(storage, nellisApi, logger);

// Dependency Injection - recommended
const { container } = require('./container/serviceRegistration');
const monitor = container.get('auctionMonitor');
```

## TODO

- [x] ~~Add data persistence~~ ✅ Redis persistence implemented with memory fallback
- [x] ~~Implement actual bid placement~~ ✅ Bid placement implemented with nellisApi
- [ ] Add circuit breaker for API resilience
- [ ] Implement auction state machine
- [ ] Add performance monitoring/metrics