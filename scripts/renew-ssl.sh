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