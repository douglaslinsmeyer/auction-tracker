# Backend Integration Guide

The Nellis Auction Helper now supports a backend service for 24/7 monitoring even when your browser is closed.

## Quick Start

### 1. Start the Backend Service

Navigate to the backend directory and start the service:

```bash
cd nellis-auction-backend
docker-compose up -d
```

The service will be available at http://localhost:3000

### 2. Enable Backend in Extension

1. Click the Nellis Auction Helper extension icon
2. Toggle "Backend Service" to ON
3. You should see "Connected" status with a green indicator

### 3. How It Works

When backend is enabled:
- Monitored auctions are synced with the backend service
- The backend continues monitoring even when browser is closed
- You'll receive notifications when important events occur
- Backend can be configured for automated bidding (requires additional setup)

## Features

### Local Monitoring (Browser Only)
- Works only when browser is open
- Updates every 6 seconds
- No automated bidding

### Backend Monitoring (24/7)
- Works even when browser is closed
- Real-time updates via Server-Sent Events (SSE) from Nellis
- WebSocket connection for extension communication
- Supports automated bidding strategies
- Persistent monitoring across browser restarts
- Intelligent fallback to polling when SSE unavailable

## Configuration

### Backend Settings

Edit `nellis-auction-backend/.env`:

```env
AUTH_TOKEN=your-secure-token-here
PORT=3000
```

### Extension Settings

The extension stores backend configuration in Chrome storage:
- Backend URL: http://localhost:3000 (default)
- Auth Token: dev-token (default)
- Auto-sync cookies: enabled (default)

## Security

- Communication is secured with token-based authentication
- Change the default AUTH_TOKEN in production
- Backend only accepts connections from Chrome extension

## Troubleshooting

### Backend Not Connecting

1. Check if Docker is running:
   ```bash
   docker ps
   ```

2. Check backend logs:
   ```bash
   docker-compose logs -f nellis-backend
   ```

3. Verify backend is accessible:
   ```bash
   curl http://localhost:3000/health
   ```

### Extension Not Syncing

1. Open Chrome DevTools (F12) on any page
2. Go to the Extension's service worker console
3. Check for error messages
4. Ensure backend toggle is ON in popup

## Next Steps

1. Configure automated bidding strategies
2. Set maximum bid limits for safety
3. Enable notifications for auction events
4. Monitor backend logs for activity

## Important Notes

- Automated bidding is currently a placeholder - actual bid placement needs to be implemented
- Always set reasonable maximum bid limits
- The backend requires authentication cookies from Nellis to place bids
- Monitor the backend logs to ensure it's working correctly