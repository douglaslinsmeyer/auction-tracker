# Auction Backend

Backend service for the Auction Helper system. Provides 24/7 auction monitoring, automated bidding, and real-time updates via WebSocket.

## Overview

This is a standalone Node.js/Express application that:
- Monitors auctions on nellisauction.com
- Implements automated bidding strategies
- Provides REST API and WebSocket connections
- Integrates with Server-Sent Events (SSE) for real-time updates
- Supports Redis for persistence with in-memory fallback

## Prerequisites

- Node.js 18+ 
- Redis (optional, will fallback to in-memory storage)
- Docker (optional, for containerized deployment)

## Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env and set your AUTH_TOKEN
```

## Configuration

Key environment variables:
- `PORT` - Server port (default: 3000)
- `AUTH_TOKEN` - Required authentication token
- `REDIS_HOST/PORT` - Redis connection (optional)
- `ALLOWED_ORIGINS` - CORS allowed origins (comma-separated)
- `ALLOWED_EXTENSION_IDS` - Chrome extension IDs (comma-separated)

## Running the Backend

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm start

# With Docker
docker-compose up
```

## API Endpoints

### REST API
- `GET /health` - Health check
- `GET /api/auctions` - List monitored auctions
- `POST /api/auctions/:id/monitor` - Start monitoring
- `POST /api/auctions/:id/stop` - Stop monitoring
- `POST /api/auctions/:id/bid` - Place bid
- `PUT /api/auctions/:id/config` - Update configuration

### WebSocket
Connect to `ws://localhost:3000` for real-time updates.

Events:
- `authenticate` - Authenticate with token
- `auctionUpdate` - Auction state changes
- `startMonitoring` - Begin monitoring auction
- `stopMonitoring` - Stop monitoring auction

## Architecture

- **Express** - REST API framework
- **WebSocket (ws)** - Real-time bidirectional communication
- **Redis/Memory** - State persistence
- **SSE Client** - Real-time updates from Nellis
- **Circuit Breaker** - Fault tolerance for external API
- **Rate Limiting** - API protection

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Deployment

### Docker
```bash
docker build -t auction-backend .
docker run -p 3000:3000 --env-file .env auction-backend
```

### PM2
```bash
pm2 start ecosystem.config.js
```

## Security

- Token-based authentication required
- Rate limiting on all endpoints
- CORS configuration for allowed origins
- Request signing available (HMAC-SHA256)
- Input validation with Joi

## Monitoring

- Health endpoint: `GET /health`
- Metrics endpoint: `GET /metrics`
- Structured logging with Winston
- Memory usage tracking

## Related Components

- **Dashboard** - Web UI for monitoring (separate application)
- **Chrome Extension** - Browser integration (separate repository)