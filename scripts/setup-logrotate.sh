#!/bin/bash
# Setup log rotation for Nellis Auction Helper
# This script can be run inside Docker containers or on the host

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Setting up log rotation for Nellis Auction Helper..."

# Function to setup logrotate in container
setup_container_logrotate() {
    echo "Setting up log rotation in container..."
    
    # Install logrotate if not present
    if ! command -v logrotate &> /dev/null; then
        echo "Installing logrotate..."
        if command -v apk &> /dev/null; then
            # Alpine Linux
            apk add --no-cache logrotate
        elif command -v apt-get &> /dev/null; then
            # Debian/Ubuntu
            apt-get update && apt-get install -y logrotate
        fi
    fi
    
    # Create log directories
    mkdir -p /app/logs/backend/archive
    mkdir -p /app/logs/dashboard/archive
    mkdir -p /etc/logrotate.d
    
    # Copy logrotate configuration
    cp "$PROJECT_ROOT/logrotate.conf" /etc/logrotate.d/nellis-auction
    
    # Create logrotate state file directory
    mkdir -p /var/lib/logrotate
    
    # Test configuration
    echo "Testing logrotate configuration..."
    logrotate -d /etc/logrotate.d/nellis-auction
    
    # Add cron job for logrotate (runs daily at 3:00 AM)
    echo "0 3 * * * /usr/sbin/logrotate /etc/logrotate.d/nellis-auction" > /etc/cron.d/nellis-logrotate
    
    # Start cron if not running
    if command -v crond &> /dev/null; then
        crond
    elif command -v cron &> /dev/null; then
        service cron start
    fi
    
    echo "Log rotation setup complete in container!"
}

# Function to setup host-based log rotation
setup_host_logrotate() {
    echo "Setting up log rotation on host..."
    
    # Check if running as root
    if [ "$EUID" -ne 0 ]; then 
        echo "Please run as root for host setup"
        exit 1
    fi
    
    # Create log directories
    mkdir -p "$PROJECT_ROOT/logs/backend/archive"
    mkdir -p "$PROJECT_ROOT/logs/dashboard/archive"
    
    # Adjust paths in logrotate config for host
    sed "s|/app/logs|$PROJECT_ROOT/logs|g" "$PROJECT_ROOT/logrotate.conf" > /tmp/nellis-auction-logrotate
    
    # Install to system logrotate.d
    cp /tmp/nellis-auction-logrotate /etc/logrotate.d/nellis-auction
    rm /tmp/nellis-auction-logrotate
    
    # Test configuration
    echo "Testing logrotate configuration..."
    logrotate -d /etc/logrotate.d/nellis-auction
    
    echo "Log rotation setup complete on host!"
    echo "Logs will be rotated automatically by system cron."
}

# Function to manually rotate logs
manual_rotate() {
    echo "Manually rotating logs..."
    
    if [ -f /etc/logrotate.d/nellis-auction ]; then
        logrotate -f /etc/logrotate.d/nellis-auction
        echo "Logs rotated successfully!"
    else
        echo "Logrotate configuration not found. Please run setup first."
        exit 1
    fi
}

# Main script logic
case "${1:-setup}" in
    "container")
        setup_container_logrotate
        ;;
    "host")
        setup_host_logrotate
        ;;
    "rotate")
        manual_rotate
        ;;
    "setup")
        # Auto-detect environment
        if [ -f /.dockerenv ]; then
            setup_container_logrotate
        else
            setup_host_logrotate
        fi
        ;;
    *)
        echo "Usage: $0 {setup|container|host|rotate}"
        echo "  setup     - Auto-detect and setup (default)"
        echo "  container - Setup for Docker container"
        echo "  host      - Setup for host system"
        echo "  rotate    - Manually rotate logs now"
        exit 1
        ;;
esac