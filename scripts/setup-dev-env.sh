#!/bin/bash

# Development Environment Setup Script
# Creates .env files for development environment

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Create backend .env file for development
create_backend_env() {
    if [ -f backend/.env ]; then
        print_warning "backend/.env already exists, skipping..."
        return
    fi
    
    print_info "Creating backend/.env for development..."
    cat > backend/.env << 'EOF'
# Backend Configuration
PORT=3000
NODE_ENV=development

# Authentication
AUTH_TOKEN=dev-token

# Encryption (for development only)
ENCRYPTION_SECRET=dev-encryption-key-change-in-production

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:8080

# Chrome Extension IDs (comma-separated)
ALLOWED_EXTENSION_IDS=your-extension-id-here

# WebSocket Configuration
WS_MAX_PAYLOAD_SIZE=1048576

# Rate Limiting
API_RATE_LIMIT_WINDOW_MS=60000
API_RATE_LIMIT_MAX=100
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=5

# SSE Configuration
USE_SSE=true
SSE_ENABLED=true

# Feature Flags
USE_POLLING_QUEUE=false
USE_CIRCUIT_BREAKER=false
EOF
}

# Create dashboard .env file for development
create_dashboard_env() {
    if [ -f dashboard/.env ]; then
        print_warning "dashboard/.env already exists, skipping..."
        return
    fi
    
    print_info "Creating dashboard/.env for development..."
    cat > dashboard/.env << 'EOF'
# Dashboard Configuration
DASHBOARD_PORT=3001
NODE_ENV=development

# Backend Configuration (internal Docker network)
BACKEND_URL=http://backend:3000
BACKEND_WS_URL=ws://backend:3000

# External URLs (for browser access)
EXTERNAL_BACKEND_URL=http://localhost:3000
EXTERNAL_WS_URL=ws://localhost:3000
EOF
}

# Main execution
print_info "Setting up development environment files..."

create_backend_env
create_dashboard_env

print_info "Development environment setup complete!"
print_info "You can now run: ./deploy.sh dev"