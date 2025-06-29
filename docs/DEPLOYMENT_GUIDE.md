# Deployment Guide

This guide covers the simplified deployment approach for the Nellis Auction Backend service.

## Overview

The deployment has been simplified from 5 Docker files to 3 core files:
- `Dockerfile` - Single multi-stage file for both development and production
- `docker-compose.yml` - Base configuration that works for development by default
- `docker-compose.prod.yml` - Minimal production overrides

## Quick Start

### Using the Deployment Script

The easiest way to deploy is using the `deploy.sh` script:

```bash
# Development mode (foreground, with hot-reload)
./deploy.sh dev

# Production mode (background)
./deploy.sh prod

# Other commands
./deploy.sh logs    # View logs
./deploy.sh stop    # Stop all services
./deploy.sh status  # Check service status
./deploy.sh backup  # Backup Redis data
./deploy.sh clean   # Remove all containers and volumes
```

### Manual Docker Commands

If you prefer using Docker Compose directly:

```bash
# Development (default)
docker-compose up

# Production
docker-compose --env-file .env.production up -d

# Production with override file
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Environment Configuration

### Environment Files

The project uses environment files to control behavior:

1. **`.env.example`** - Template with all available options
2. **`.env.development`** - Pre-configured for development
3. **`.env.production`** - Template for production (requires configuration)

### Key Environment Variables

```bash
# Build Configuration
BUILD_TARGET=development      # Options: development, production

# Node Environment
NODE_ENV=development         # Options: development, production

# Authentication (REQUIRED for production)
AUTH_TOKEN=your-secure-token-here

# Logging
LOG_LEVEL=info              # Options: error, warn, info, debug
DEBUG=*                     # Debug namespaces (empty in production)

# Volume Configuration
SRC_VOLUME=./src:/app/src   # Source mounting (set to /dev/null for production)
PUBLIC_VOLUME=./public:/app/public  # Public files (set to /dev/null for production)
```

## Development Deployment

### Prerequisites
- Docker and Docker Compose installed
- Git repository cloned

### Steps

1. **Use the pre-configured development environment:**
   ```bash
   cp .env.development .env
   ```

2. **Start the services:**
   ```bash
   ./deploy.sh dev
   # or
   docker-compose up
   ```

3. **Verify services are running:**
   ```bash
   curl http://localhost:3000/health
   ```

### Development Features
- Hot-reload enabled via nodemon
- Source code mounted as volumes
- Debug port 9229 exposed
- All logs visible in console

## Production Deployment

### Prerequisites
- Docker and Docker Compose installed
- Secure environment for storing credentials

### Steps

1. **Configure production environment:**
   ```bash
   cp .env.production .env
   ```

2. **Set secure AUTH_TOKEN:**
   ```bash
   # Generate secure token
   openssl rand -hex 32
   
   # Edit .env and set AUTH_TOKEN
   ```

3. **Deploy in production mode:**
   ```bash
   ./deploy.sh prod
   # or
   docker-compose --env-file .env.production up -d
   ```

4. **Verify deployment:**
   ```bash
   ./deploy.sh status
   curl http://localhost:3000/health
   ```

### Production Features
- Runs as non-root user
- No source code mounting
- Optimized image size
- Health checks enabled
- Automatic restart on failure

## Docker Architecture

### Multi-Stage Dockerfile

The `Dockerfile` uses multi-stage builds:

```dockerfile
# Base stage - shared setup
FROM node:18-alpine AS base

# Development stage
FROM base AS development
- Includes nodemon for hot-reload
- All dependencies installed
- Runs on ports 3000 and 9229

# Production stage
FROM base AS production
- Only production dependencies
- Runs as non-root user
- Health check included
- Minimal attack surface
```

### Volume Management

Development volumes are controlled via environment variables:
- `SRC_VOLUME` - Source code mounting
- `PUBLIC_VOLUME` - Public files mounting

In production, these are set to `/dev/null` to disable mounting.

## Monitoring and Maintenance

### View Logs
```bash
# All logs
./deploy.sh logs

# Specific service
docker-compose logs -f backend
docker-compose logs -f redis
```

### Health Checks
```bash
# Application health
curl http://localhost:3000/health

# Service status
./deploy.sh status
```

### Backup and Restore

#### Backup Redis Data
```bash
# Automated backup
./deploy.sh backup

# Manual backup
docker-compose exec redis redis-cli BGSAVE
docker cp nellis-redis:/data/dump.rdb ./backups/backup-$(date +%Y%m%d).rdb
```

#### Restore Redis Data
```bash
# Stop Redis
docker-compose stop redis

# Copy backup
docker cp ./backups/backup.rdb nellis-redis:/data/dump.rdb

# Start Redis
docker-compose start redis
```

## Troubleshooting

### Common Issues

1. **Port already in use:**
   ```bash
   # Check what's using port 3000
   lsof -i :3000
   
   # Change port in .env
   PORT=3001
   ```

2. **Redis connection failed:**
   ```bash
   # Check Redis is running
   docker-compose ps redis
   
   # Check Redis logs
   docker-compose logs redis
   ```

3. **Permission errors:**
   ```bash
   # Fix log directory permissions
   sudo chown -R $(id -u):$(id -g) ./logs
   ```

### Clean Start
```bash
# Remove everything and start fresh
./deploy.sh clean
./deploy.sh dev
```

## Security Considerations

1. **AUTH_TOKEN**: Always use a secure, unique token in production
2. **Firewall**: Ensure only necessary ports are exposed
3. **Updates**: Regularly update base images and dependencies
4. **Logs**: Sensitive data is automatically redacted

## Migration from Old Setup

If you're migrating from the old 5-file setup:

1. **Remove old files:**
   ```bash
   rm Dockerfile.dev
   rm docker-compose.override.yml
   ```

2. **Update deployment commands:**
   - Replace `docker-compose up` with `./deploy.sh dev`
   - Replace complex production commands with `./deploy.sh prod`

3. **Move environment variables:**
   - Consolidate scattered env vars into `.env` files
   - Remove duplicate configurations

The new setup maintains full backward compatibility while simplifying deployment.