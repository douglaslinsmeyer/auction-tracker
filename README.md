# Nellis Auction Helper

Full-stack auction monitoring and bidding system for nellisauction.com with real-time Server-Sent Events (SSE) integration, resilience patterns, and comprehensive monitoring.

## 🎯 Project Status: ✅ COMPLETE & PRODUCTION READY

All implementation phases completed with comprehensive testing, monitoring, and operational excellence.

## Components

- **Backend** (`backend/`): Node.js/Express API server with WebSocket and SSE support
- **Dashboard** (`dashboard/`): Web application for monitoring and control
- **Extension** (`extension/`): Chrome extension for browser integration

## Quick Start

### Option 1: Docker Compose (Simple)

```bash
# Start all services (backend, dashboard, redis)
docker-compose up

# Access:
# - Backend API: http://localhost:3000
# - Dashboard UI: http://localhost:3001
# - Redis: localhost:6379
```

### Option 2: Kubernetes (Recommended for Production)

```bash
# Quick setup for local development
./k8s/scripts/setup-local.sh

# Access via port-forward:
kubectl -n auction-tracker-dev port-forward service/dev-backend 3000:3000
kubectl -n auction-tracker-dev port-forward service/dev-dashboard 3001:3001
```

See [Kubernetes Deployment Guide](docs/KUBERNETES_DEPLOYMENT.md) for detailed instructions.

## Production Deployment

### Docker Compose
```bash
# Build and run in production mode
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Kubernetes (Rackspace Spot)
```bash
# Deploy to production
./k8s/scripts/deploy.sh -e production

# Or manually with kustomize
kustomize build k8s/overlays/production | kubectl apply -f -
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

Copy `.env.example` files to `.env` in each directory and configure:

```env
# Backend (.env)
PORT=3000
AUTH_TOKEN=your-secure-token
REDIS_URL=redis://localhost:6379
USE_SSE=true              # Real-time updates via Server-Sent Events
USE_CIRCUIT_BREAKER=true  # Enable fault tolerance
USE_POLLING_QUEUE=true    # Efficient fallback polling

# Dashboard (.env)
DASHBOARD_PORT=3001
BACKEND_URL=http://localhost:3000
```

See `.env.example` files for complete configuration options.

## 📚 Documentation

- **[📖 Complete Documentation Hub](docs/README.md)** - Master documentation index
- **[🎯 Project Overview](docs/PROJECT_OVERVIEW.md)** - Complete project summary
- **[🚀 Production Guide](docs/PRODUCTION_READINESS_CHECKLIST.md)** - Deployment and operations
- **[🏗️ Architecture Guide](docs/ARCHITECTURE.md)** - Technical design details

## Key Features

- **Real-time Updates**: Server-Sent Events (SSE) integration for instant bid notifications
- **Resilience**: Circuit breaker pattern prevents cascading failures
- **Security**: Request signing (HMAC-SHA256), rate limiting, and token authentication
- **Monitoring**: Built-in metrics, Prometheus integration, and structured logging
- **Feature Flags**: Safe rollout of new features with instant rollback capability
- **Bidding Strategies**: Manual, aggressive, and last-second sniping modes
- **High Performance**: Efficient polling queue reduces API load by 90%

## Documentation

- Project guidelines: `CLAUDE.md`
- Architecture details: `docs/ARCHITECTURE.md`
- API documentation: `http://localhost:3000/api-docs` (when backend is running)
- Research tools: `research/` directory contains Nellis API analysis utilities