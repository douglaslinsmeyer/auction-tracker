#!/bin/bash
# SSL Monitoring Setup Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Setup SSL certificate monitoring
setup_ssl_monitoring() {
    log_info "Setting up SSL certificate monitoring..."
    
    # Create logs directory for SSL monitoring
    mkdir -p "$PROJECT_ROOT/logs"
    
    # SSL certificate renewal cron job (twice daily)
    local renewal_cron="0 0,12 * * * $PROJECT_ROOT/scripts/renew-ssl.sh >> $PROJECT_ROOT/logs/ssl-renewal.log 2>&1"
    
    # SSL certificate check cron job (daily)
    local check_cron="0 9 * * * $PROJECT_ROOT/scripts/ssl-check.sh >> $PROJECT_ROOT/logs/ssl-check.log 2>&1"
    
    # SSL certificate expiry warning (weekly)
    local expiry_cron="0 9 * * 1 $PROJECT_ROOT/scripts/ssl-check.sh expiry >> $PROJECT_ROOT/logs/ssl-expiry.log 2>&1"
    
    # Add to crontab if not already present
    local temp_cron=$(mktemp)
    crontab -l 2>/dev/null > "$temp_cron" || true
    
    if ! grep -q "renew-ssl.sh" "$temp_cron"; then
        echo "$renewal_cron" >> "$temp_cron"
        log_info "Added SSL renewal cron job"
    else
        log_warn "SSL renewal cron job already exists"
    fi
    
    if ! grep -q "ssl-check.sh" "$temp_cron"; then
        echo "$check_cron" >> "$temp_cron"
        log_info "Added SSL check cron job"
    else
        log_warn "SSL check cron job already exists"
    fi
    
    if ! grep -q "ssl-expiry.log" "$temp_cron"; then
        echo "$expiry_cron" >> "$temp_cron"
        log_info "Added SSL expiry warning cron job"
    else
        log_warn "SSL expiry warning cron job already exists"
    fi
    
    crontab "$temp_cron"
    rm "$temp_cron"
    
    log_info "SSL monitoring cron jobs configured"
}

# Setup SSL monitoring alerts
setup_ssl_alerts() {
    log_info "Creating SSL monitoring alert script..."
    
    cat > "$PROJECT_ROOT/scripts/ssl-alert.sh" <<'EOF'
#!/bin/bash
# SSL Alert Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration
ALERT_EMAIL="${SSL_ALERT_EMAIL:-admin@localhost}"
WEBHOOK_URL="${SSL_ALERT_WEBHOOK:-}"
ALERT_THRESHOLD="${SSL_ALERT_THRESHOLD:-7}"

# Run SSL check
check_result=$("$PROJECT_ROOT/scripts/ssl-check.sh" 2>&1)
check_exit_code=$?

# Generate alert if needed
if [ $check_exit_code -ne 0 ]; then
    subject="SSL Certificate Alert - $(hostname)"
    message="SSL certificate check failed on $(hostname) at $(date):\n\n$check_result"
    
    # Send email alert if configured
    if command -v mail >/dev/null 2>&1 && [ -n "$ALERT_EMAIL" ]; then
        echo -e "$message" | mail -s "$subject" "$ALERT_EMAIL"
    fi
    
    # Send webhook alert if configured
    if command -v curl >/dev/null 2>&1 && [ -n "$WEBHOOK_URL" ]; then
        curl -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"$subject\",\"details\":\"$message\"}" \
            >/dev/null 2>&1 || true
    fi
    
    # Log alert
    echo "[$(date)] SSL Alert sent: $subject" >> "$PROJECT_ROOT/logs/ssl-alerts.log"
fi
EOF
    
    chmod +x "$PROJECT_ROOT/scripts/ssl-alert.sh"
    log_info "SSL alert script created"
}

# Setup log rotation for SSL logs
setup_ssl_log_rotation() {
    log_info "Setting up SSL log rotation..."
    
    cat > "$PROJECT_ROOT/logrotate-ssl.conf" <<EOF
# SSL log rotation configuration
$PROJECT_ROOT/logs/ssl-*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 $(whoami) $(whoami)
    postrotate
        # Send HUP signal to rsyslog if running
        if [ -f /var/run/rsyslogd.pid ]; then
            kill -HUP \$(cat /var/run/rsyslogd.pid)
        fi
    endscript
}
EOF
    
    log_info "SSL log rotation configuration created"
    log_info "Add the following to your system crontab or logrotate.d:"
    echo "  logrotate -f $PROJECT_ROOT/logrotate-ssl.conf"
}

# Main setup function
main() {
    echo "SSL Monitoring Setup"
    echo "===================="
    echo
    
    setup_ssl_monitoring
    setup_ssl_alerts
    setup_ssl_log_rotation
    
    echo
    log_info "SSL monitoring setup complete!"
    echo
    echo "Next steps:"
    echo "1. Configure alert email: export SSL_ALERT_EMAIL=your-email@example.com"
    echo "2. Configure webhook URL: export SSL_ALERT_WEBHOOK=https://your-webhook-url"
    echo "3. Test SSL check: $PROJECT_ROOT/scripts/ssl-check.sh"
    echo "4. Test renewal: $PROJECT_ROOT/scripts/renew-ssl.sh"
    echo "5. View cron jobs: crontab -l"
    echo
}

# Command line interface
case "${1:-setup}" in
    "setup")
        main
        ;;
    "monitoring")
        setup_ssl_monitoring
        ;;
    "alerts")
        setup_ssl_alerts
        ;;
    "logs")
        setup_ssl_log_rotation
        ;;
    "help")
        echo "Usage: $0 [command]"
        echo "Commands:"
        echo "  setup      - Complete SSL monitoring setup (default)"
        echo "  monitoring - Setup monitoring cron jobs only"
        echo "  alerts     - Setup alert script only"
        echo "  logs       - Setup log rotation only"
        echo "  help       - Show this help"
        ;;
    *)
        echo "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac