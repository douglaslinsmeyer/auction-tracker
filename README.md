# Nellis Auction Backend Service

Backend service for the Nellis Auction Helper Chrome extension. Provides 24/7 auction monitoring and automated bidding capabilities.

## Features

- 24/7 auction monitoring (works when browser is closed)
- Real-time WebSocket updates
- REST API for extension communication
- Automated bidding based on configured strategies
- Docker containerization for easy deployment

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

## Security Notes

- Always use a strong `AUTH_TOKEN` in production
- The service requires authentication cookies from Nellis to place bids
- WebSocket connections require authentication
- CORS is configured to only allow Chrome extension and localhost origins

## Monitoring

The service logs to:
- Console (stdout)
- `error.log` - Error level logs only
- `combined.log` - All logs

## Architecture

- **Express.js** - REST API server
- **WebSocket (ws)** - Real-time bidirectional communication
- **Axios** - HTTP client for Nellis API
- **Winston** - Logging
- **Node-cron** - Scheduled tasks (future enhancement)

## TODO

- [ ] Add data persistence
- [ ] Implement actual bid placement (currently placeholder)