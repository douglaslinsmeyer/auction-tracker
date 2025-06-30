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
        
        # Setup development environment files
        if [ -f scripts/setup-dev-env.sh ]; then
            ./scripts/setup-dev-env.sh
        fi
        
        # Check if monitoring flag is set
        if [ "$2" == "--with-monitoring" ] || [ "$2" == "-m" ]; then
            print_info "Starting with monitoring stack..."
            docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up --build
        else
            docker-compose up --build
        fi
        ;;
    
    prod|production)
        print_info "Starting production environment..."
        
        # Check if production env file exists
        if [ ! -f .env.production ]; then
            print_error ".env.production not found! Copy .env.example and configure it."
            exit 1
        fi
        
        # Check AUTH_TOKEN is set
        if grep -q "your-secure-auth-token-here" .env.production; then
            print_error "Please set a secure AUTH_TOKEN in .env.production!"
            exit 1
        fi
        
        # Check if monitoring flag is set
        if [ "$2" == "--with-monitoring" ] || [ "$2" == "-m" ]; then
            print_info "Starting with monitoring stack..."
            docker-compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.monitoring.yml up -d --build
        else
            docker-compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml up -d --build
        fi
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
    
    monitoring|monitor)
        print_info "Managing monitoring stack..."
        case ${2:-status} in
            start)
                print_info "Starting monitoring stack (requires main services)..."
                # Start main services first if not running
                docker-compose up -d redis
                # Then start monitoring
                docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d prometheus grafana redis-exporter
                print_info "Monitoring stack started:"
                print_info "  - Prometheus: http://localhost:9090"
                print_info "  - Grafana: http://localhost:3003 (admin/admin)"
                ;;
            stop)
                print_info "Stopping monitoring stack..."
                docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml stop prometheus grafana redis-exporter
                ;;
            status)
                print_info "Monitoring stack status:"
                docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml ps prometheus grafana redis-exporter
                ;;
            *)
                print_error "Unknown monitoring command: $2"
                echo "Usage: $0 monitoring {start|stop|status}"
                exit 1
                ;;
        esac
        ;;
    
    *)
        echo "Usage: $0 {dev|prod|stop|logs|clean|status|backup|monitoring} [options]"
        echo ""
        echo "Commands:"
        echo "  dev [--with-monitoring|-m]  - Start development environment (default)"
        echo "  prod [--with-monitoring|-m] - Start production environment"
        echo "  stop                        - Stop all services"
        echo "  logs                        - View logs (follow mode)"
        echo "  clean                       - Remove all containers and volumes"
        echo "  status                      - Show service status"
        echo "  backup                      - Backup Redis data"
        echo "  monitoring {start|stop|status} - Manage monitoring stack"
        echo ""
        echo "Examples:"
        echo "  $0 dev                      - Start dev environment"
        echo "  $0 dev --with-monitoring    - Start dev with monitoring"
        echo "  $0 monitoring start         - Start just monitoring stack"
        echo "  $0 monitoring status        - Check monitoring services"
        exit 1
        ;;
esac