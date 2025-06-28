# Nellis Auction Monitor UI

A web-based monitoring dashboard for the Nellis Auction Helper backend.

## Features

- Real-time auction monitoring dashboard
- WebSocket connection for live updates
- View all monitored auctions at a glance
- See current bid, time remaining, and bid configuration
- Stop monitoring individual auctions
- Clear all monitored auctions
- Responsive design for mobile and desktop

## Access

Navigate to `http://localhost:3000` when the backend is running.

## API Endpoints

- `GET /api/auctions` - Get all monitored auctions
- `POST /api/auctions/:id/stop` - Stop monitoring a specific auction
- `POST /api/auctions/clear` - Clear all monitored auctions

## WebSocket Events

The UI connects via WebSocket for real-time updates:
- `auctionUpdate` - Received when auction data changes
- `notification` - Received for important events (outbid, won, ended)