# Auction Dashboard

Standalone web application for monitoring and controlling auctions. Connects to the Auction Backend service via WebSocket for real-time updates.

## Overview

This is a Node.js/Express application that serves a web dashboard for:
- Real-time auction monitoring
- Bidding strategy configuration  
- Auction history viewing
- System status monitoring

## Features

- Real-time auction monitoring dashboard
- WebSocket connection to backend service
- Bidding strategy configuration
- Dark mode support
- Responsive design with Tailwind CSS
- Bid history tracking
- Authentication integration

## Architecture

The UI is a standalone web application that:
- Connects to the backend via WebSocket for real-time updates
- Uses vanilla JavaScript for simplicity and performance
- Styled with Tailwind CSS (loaded from CDN)
- Can be deployed separately or served by the backend

## Prerequisites

- Node.js 14+
- Backend service running (default: http://localhost:3000)

## Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env to configure backend URL if needed
```

## Configuration

Environment variables in `.env`:
- `PORT` - Dashboard server port (default: 3001)
- `BACKEND_URL` - Backend API URL (default: http://localhost:3000)
- `WS_URL` - WebSocket URL (default: ws://localhost:3000)
- `NODE_ENV` - Environment (development/production)

## Running the Dashboard

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm start
```

Then open http://localhost:3001 in your browser.

## Deployment

### Development
Both applications run on separate ports:
- Backend: http://localhost:3000
- Dashboard: http://localhost:3001

### Production
Deploy as two separate applications:

1. **Backend Deployment**
   - Deploy to your server/cloud provider
   - Ensure Redis is available (optional)
   - Set production AUTH_TOKEN
   - Configure ALLOWED_ORIGINS to include dashboard URL

2. **Dashboard Deployment**
   - Deploy to static hosting or Node.js server
   - Set BACKEND_URL and WS_URL to production backend
   - Can use services like Vercel, Netlify, or traditional hosting

## File Structure

```
dashboard/
├── src/
│   ├── index.html      # Main application HTML
│   ├── app.js          # Application logic and WebSocket client
│   └── settings.js     # Settings management
├── assets/             # Static assets (if any)
├── dist/               # Production build output
├── package.json        # Package configuration
└── README.md          # This file
```

## Security

- Requires authentication token to connect to backend
- Token stored in localStorage
- All communication over WebSocket (upgradeable to WSS for production)

## Contributing

When making changes to the UI:
1. Test with the backend running locally
2. Verify WebSocket connectivity
3. Test all auction monitoring features
4. Ensure responsive design works on mobile