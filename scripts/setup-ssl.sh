#!/bin/bash
# SSL/TLS Setup Script for Nellis Auction Helper

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create SSL directories
create_ssl_dirs() {
    log_info "Creating SSL directories..."
    mkdir -p "$PROJECT_ROOT/ssl"
    mkdir -p "$PROJECT_ROOT/certbot/www"
    mkdir -p "$PROJECT_ROOT/nginx/conf.d"
}

# Generate self-signed certificate
generate_self_signed() {
    log_info "Generating self-signed certificate..."
    
    cd "$PROJECT_ROOT/ssl"
    
    # Generate private key
    openssl genrsa -out key.pem 2048
    
    # Generate certificate
    openssl req -new -x509 -key key.pem -out cert.pem -days 365 \
        -subj "/C=US/ST=State/L=City/O=Nellis Auction Helper/CN=localhost"
    
    # Create chain file (copy of cert for self-signed)
    cp cert.pem chain.pem
    
    log_info "Self-signed certificate generated successfully"
    log_warn "This certificate is for development/testing only!"
}

# Setup Let's Encrypt
setup_letsencrypt() {
    local domain="$1"
    local email="$2"
    
    if [ -z "$domain" ] || [ -z "$email" ]; then
        log_error "Domain and email required for Let's Encrypt"
        echo "Usage: $0 letsencrypt <domain> <email>"
        exit 1
    fi
    
    log_info "Setting up Let's Encrypt for domain: $domain"
    
    # Update nginx configuration with domain
    sed -i "s/server_name _;/server_name $domain www.$domain;/g" \
        "$PROJECT_ROOT/nginx/conf.d/nellis-auction.conf"
    
    # Start nginx for HTTP challenge
    log_info "Starting nginx for HTTP challenge..."
    docker-compose -f "$PROJECT_ROOT/docker-compose.yml" \
        -f "$PROJECT_ROOT/docker-compose.prod.yml" up -d nginx
    
    # Wait for nginx to start
    sleep 5
    
    # Run certbot
    log_info "Running certbot..."
    docker run -it --rm --name certbot \
        -v "$PROJECT_ROOT/ssl:/etc/letsencrypt" \
        -v "$PROJECT_ROOT/certbot/www:/var/www/certbot" \
        certbot/certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "$email" \
        --agree-tos \
        --no-eff-email \
        -d "$domain" \
        -d "www.$domain"
    
    if [ $? -eq 0 ]; then
        # Update nginx SSL paths
        cat > "$PROJECT_ROOT/nginx/conf.d/ssl-paths.conf" <<EOF
# SSL certificate paths for $domain
ssl_certificate /etc/nginx/ssl/live/$domain/fullchain.pem;
ssl_certificate_key /etc/nginx/ssl/live/$domain/privkey.pem;
ssl_trusted_certificate /etc/nginx/ssl/live/$domain/chain.pem;
EOF
        
        log_info "Let's Encrypt certificate obtained successfully!"
        log_info "Restarting nginx with SSL..."
        
        docker-compose -f "$PROJECT_ROOT/docker-compose.yml" \
            -f "$PROJECT_ROOT/docker-compose.prod.yml" restart nginx
    else
        log_error "Failed to obtain Let's Encrypt certificate"
        exit 1
    fi
}

# Setup certificate renewal
setup_renewal() {
    log_info "Setting up automatic certificate renewal..."
    
    # Create renewal script
    cat > "$PROJECT_ROOT/scripts/renew-ssl.sh" <<'EOF'
#!/bin/bash
# SSL Certificate Renewal Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "[$(date)] Starting SSL renewal check..."

docker run --rm --name certbot \
    -v "$PROJECT_ROOT/ssl:/etc/letsencrypt" \
    -v "$PROJECT_ROOT/certbot/www:/var/www/certbot" \
    certbot/certbot renew

if [ $? -eq 0 ]; then
    echo "[$(date)] Certificate renewed successfully, reloading nginx..."
    docker-compose -f "$PROJECT_ROOT/docker-compose.yml" \
        -f "$PROJECT_ROOT/docker-compose.prod.yml" \
        exec nginx nginx -s reload
else
    echo "[$(date)] Certificate renewal not needed or failed"
fi
EOF
    
    chmod +x "$PROJECT_ROOT/scripts/renew-ssl.sh"
    
    # Add to crontab
    local cron_cmd="0 0,12 * * * $PROJECT_ROOT/scripts/renew-ssl.sh >> $PROJECT_ROOT/logs/ssl-renewal.log 2>&1"
    
    if crontab -l 2>/dev/null | grep -q "renew-ssl.sh"; then
        log_warn "Renewal cron job already exists"
    else
        (crontab -l 2>/dev/null; echo "$cron_cmd") | crontab -
        log_info "Added renewal cron job"
    fi
}

# Check SSL configuration
check_ssl() {
    local domain="${1:-localhost}"
    local port="${2:-443}"
    
    log_info "Checking SSL configuration for $domain:$port..."
    
    # Check if port is open
    if ! nc -zv "$domain" "$port" 2>&1 | grep -q succeeded; then
        log_error "Cannot connect to $domain:$port"
        return 1
    fi
    
    # Check certificate
    echo | openssl s_client -connect "$domain:$port" -servername "$domain" 2>/dev/null | \
        openssl x509 -noout -text | grep -E "Subject:|Issuer:|Not After"
    
    # Test HTTPS
    if curl -ksI "https://$domain:$port/health" | grep -q "200 OK"; then
        log_info "HTTPS health check: OK"
    else
        log_warn "HTTPS health check: Failed"
    fi
}

# Main menu
show_menu() {
    echo
    echo "Nellis Auction Helper - SSL/TLS Setup"
    echo "====================================="
    echo
    echo "1) Generate self-signed certificate (development)"
    echo "2) Setup Let's Encrypt certificate (production)"
    echo "3) Setup automatic renewal"
    echo "4) Check SSL configuration"
    echo "5) Exit"
    echo
    read -p "Select option (1-5): " choice
    
    case $choice in
        1)
            create_ssl_dirs
            generate_self_signed
            ;;
        2)
            create_ssl_dirs
            read -p "Enter your domain name: " domain
            read -p "Enter your email address: " email
            setup_letsencrypt "$domain" "$email"
            setup_renewal
            ;;
        3)
            setup_renewal
            ;;
        4)
            read -p "Enter domain to check (default: localhost): " domain
            domain="${domain:-localhost}"
            read -p "Enter port (default: 443): " port
            port="${port:-443}"
            check_ssl "$domain" "$port"
            ;;
        5)
            exit 0
            ;;
        *)
            log_error "Invalid option"
            show_menu
            ;;
    esac
}

# Command line interface
if [ $# -eq 0 ]; then
    show_menu
else
    case "$1" in
        "self-signed")
            create_ssl_dirs
            generate_self_signed
            ;;
        "letsencrypt")
            create_ssl_dirs
            setup_letsencrypt "$2" "$3"
            setup_renewal
            ;;
        "renew")
            "$PROJECT_ROOT/scripts/renew-ssl.sh"
            ;;
        "check")
            check_ssl "$2" "$3"
            ;;
        *)
            echo "Usage: $0 [command] [options]"
            echo "Commands:"
            echo "  self-signed           - Generate self-signed certificate"
            echo "  letsencrypt <domain> <email> - Setup Let's Encrypt"
            echo "  renew                 - Renew certificates"
            echo "  check [domain] [port] - Check SSL configuration"
            echo
            echo "Or run without arguments for interactive menu"
            exit 1
            ;;
    esac
fi