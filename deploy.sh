#!/bin/bash

# Deployment Helper Script
# Usage: ./deploy.sh [dev|prod|stop|logs|clean]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Main deployment logic
case ${1:-dev} in
    dev|development)
        print_info "Starting development environment..."
        docker-compose up --build
        ;;
    
    prod|production)
        print_info "Starting production environment..."
        
        # Check if production env file exists
        if [ ! -f .env.production ]; then
            print_error ".env.production not found! Copy .env.example and configure it."
            exit 1
        fi
        
        # Check AUTH_TOKEN is set
        if grep -q "your-secure-production-token-here" .env.production; then
            print_error "Please set a secure AUTH_TOKEN in .env.production!"
            exit 1
        fi
        
        docker-compose --env-file .env.production up -d --build
        print_info "Production deployment started in background"
        print_info "View logs with: ./deploy.sh logs"
        ;;
    
    stop)
        print_info "Stopping all services..."
        docker-compose down
        ;;
    
    logs)
        docker-compose logs -f --tail=100
        ;;
    
    clean)
        print_warning "This will remove all containers and volumes!"
        read -p "Are you sure? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker-compose down -v
            print_info "All containers and volumes removed"
        else
            print_info "Cleanup cancelled"
        fi
        ;;
    
    status)
        print_info "Service status:"
        docker-compose ps
        ;;
    
    backup)
        print_info "Creating Redis backup..."
        docker-compose exec redis redis-cli BGSAVE
        sleep 2
        # Copy the dump file
        docker cp nellis-redis:/data/dump.rdb ./backups/redis-backup-$(date +%Y%m%d-%H%M%S).rdb
        print_info "Backup saved to ./backups/"
        ;;
    
    *)
        echo "Usage: $0 {dev|prod|stop|logs|clean|status|backup}"
        echo ""
        echo "Commands:"
        echo "  dev       - Start development environment (default)"
        echo "  prod      - Start production environment"
        echo "  stop      - Stop all services"
        echo "  logs      - View logs (follow mode)"
        echo "  clean     - Remove all containers and volumes"
        echo "  status    - Show service status"
        echo "  backup    - Backup Redis data"
        exit 1
        ;;
esac