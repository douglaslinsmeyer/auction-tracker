#!/bin/bash
# SSL Certificate Monitoring Script

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

# Check certificate expiration
check_certificate_expiry() {
    local cert_path="$1"
    local warn_days="${2:-30}"
    
    if [ ! -f "$cert_path" ]; then
        log_error "Certificate not found: $cert_path"
        return 1
    fi
    
    local expiry_date=$(openssl x509 -enddate -noout -in "$cert_path" | cut -d= -f2)
    local expiry_epoch=$(date -d "$expiry_date" +%s)
    local current_epoch=$(date +%s)
    local days_until_expiry=$(((expiry_epoch - current_epoch) / 86400))
    
    if [ $days_until_expiry -lt 0 ]; then
        log_error "Certificate has expired!"
        return 1
    elif [ $days_until_expiry -lt $warn_days ]; then
        log_warn "Certificate expires in $days_until_expiry days"
        return 2
    else
        log_info "Certificate is valid for $days_until_expiry days"
        return 0
    fi
}

# Check SSL connection
check_ssl_connection() {
    local hostname="${1:-localhost}"
    local port="${2:-443}"
    
    log_info "Checking SSL connection to $hostname:$port..."
    
    if timeout 10 openssl s_client -connect "$hostname:$port" -servername "$hostname" </dev/null 2>/dev/null | grep -q "Verify return code: 0"; then
        log_info "SSL connection successful"
        return 0
    else
        log_error "SSL connection failed"
        return 1
    fi
}

# Check certificate chain
check_certificate_chain() {
    local cert_path="$1"
    local chain_path="$2"
    
    if [ ! -f "$cert_path" ] || [ ! -f "$chain_path" ]; then
        log_error "Certificate or chain file not found"
        return 1
    fi
    
    if openssl verify -CAfile "$chain_path" "$cert_path" >/dev/null 2>&1; then
        log_info "Certificate chain is valid"
        return 0
    else
        log_error "Certificate chain validation failed"
        return 1
    fi
}

# Main function
main() {
    local cert_dir="$PROJECT_ROOT/ssl"
    local exit_code=0
    
    echo "SSL Certificate Health Check - $(date)"
    echo "======================================"
    
    # Check for self-signed certificates
    if [ -f "$cert_dir/cert.pem" ]; then
        log_info "Checking self-signed certificate..."
        check_certificate_expiry "$cert_dir/cert.pem" 30
        case $? in
            1) exit_code=1 ;;
            2) exit_code=2 ;;
        esac
        
        check_certificate_chain "$cert_dir/cert.pem" "$cert_dir/chain.pem"
        if [ $? -ne 0 ]; then
            exit_code=1
        fi
    fi
    
    # Check for Let's Encrypt certificates
    if [ -d "$cert_dir/live" ]; then
        for domain_dir in "$cert_dir/live"/*/; do
            if [ -d "$domain_dir" ]; then
                domain=$(basename "$domain_dir")
                log_info "Checking Let's Encrypt certificate for $domain..."
                
                check_certificate_expiry "$domain_dir/fullchain.pem" 30
                case $? in
                    1) exit_code=1 ;;
                    2) exit_code=2 ;;
                esac
                
                check_certificate_chain "$domain_dir/cert.pem" "$domain_dir/chain.pem"
                if [ $? -ne 0 ]; then
                    exit_code=1
                fi
                
                # Check actual SSL connection if not localhost
                if [ "$domain" != "localhost" ]; then
                    check_ssl_connection "$domain" 443
                    if [ $? -ne 0 ]; then
                        exit_code=1
                    fi
                fi
            fi
        done
    fi
    
    # Check nginx configuration
    if docker-compose -f "$PROJECT_ROOT/docker-compose.yml" -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T nginx nginx -t >/dev/null 2>&1; then
        log_info "Nginx configuration is valid"
    else
        log_error "Nginx configuration test failed"
        exit_code=1
    fi
    
    echo
    case $exit_code in
        0)
            log_info "All SSL checks passed"
            ;;
        1)
            log_error "SSL checks failed - immediate attention required"
            ;;
        2)
            log_warn "SSL checks passed with warnings - action recommended"
            ;;
    esac
    
    exit $exit_code
}

# Command line options
case "${1:-check}" in
    "check")
        main
        ;;
    "expiry")
        cert_path="${2:-$PROJECT_ROOT/ssl/cert.pem}"
        check_certificate_expiry "$cert_path" "${3:-30}"
        ;;
    "connection")
        check_ssl_connection "${2:-localhost}" "${3:-443}"
        ;;
    "help")
        echo "Usage: $0 [command] [options]"
        echo "Commands:"
        echo "  check                    - Run all SSL checks (default)"
        echo "  expiry <cert> [days]     - Check certificate expiry"
        echo "  connection <host> [port] - Test SSL connection"
        echo "  help                     - Show this help"
        ;;
    *)
        echo "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac