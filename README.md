# Auction Helper

Full-stack auction monitoring and bidding system for nellisauction.com.

## Components

- **Backend** (`backend/`): Node.js/Express API server with WebSocket support
- **Dashboard** (`dashboard/`): Web application for monitoring and control
- **Extension** (`extension/`): Chrome extension for browser integration

## Quick Start with Docker

```bash
# Start all services (backend, dashboard, redis)
docker-compose up

# Access:
# - Backend API: http://localhost:3000
# - Dashboard UI: http://localhost:3001
# - Redis: localhost:6379
```

## Production Deployment

```bash
# Build and run in production mode
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Development

Each component can be developed independently:

### Backend
```bash
cd backend
npm install
npm run dev
```

### Dashboard
```bash
cd dashboard
npm install
npm run dev
```

### Extension
See `extension/README.md` for Chrome extension development instructions.

## Environment Variables

Create `.env` files in the project root:

```env
# Backend
PORT=3000
AUTH_TOKEN=your-secure-token
REDIS_URL=redis://localhost:6379

# Dashboard
DASHBOARD_PORT=3001
BACKEND_URL=http://localhost:3000
```

## Documentation

- Project guidelines: `CLAUDE.md`
- Architecture details: `docs/ARCHITECTURE.md`
- API documentation: `http://localhost:3000/api-docs` (when backend is running)