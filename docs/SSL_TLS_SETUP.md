# SSL/TLS Configuration Guide

This guide covers setting up SSL/TLS encryption for the Nellis Auction Helper using nginx as a reverse proxy.

## Overview

The production setup uses nginx to:
- Terminate SSL/TLS connections
- Proxy requests to backend services
- Provide security headers
- Handle rate limiting
- Serve as a single entry point

## Quick Start with Let's Encrypt

### 1. Prerequisites
- Domain name pointing to your server
- Ports 80 and 443 open
- Docker and Docker Compose installed

### 2. Initial Setup

```bash
# Create directories for SSL certificates
mkdir -p ssl certbot/www

# Start nginx without SSL first (for Let's Encrypt challenge)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d nginx
```

### 3. Obtain SSL Certificate

```bash
# Install certbot
docker run -it --rm --name certbot \
  -v "$(pwd)/ssl:/etc/letsencrypt" \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  certbot/certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email \
  -d your-domain.com \
  -d www.your-domain.com
```

### 4. Configure nginx

Update `nginx/conf.d/nellis-auction.conf` with your domain:
```nginx
server_name your-domain.com www.your-domain.com;
```

Update SSL certificate paths:
```nginx
ssl_certificate /etc/nginx/ssl/live/your-domain.com/fullchain.pem;
ssl_certificate_key /etc/nginx/ssl/live/your-domain.com/privkey.pem;
ssl_trusted_certificate /etc/nginx/ssl/live/your-domain.com/chain.pem;
```

### 5. Restart with SSL

```bash
# Restart nginx with SSL configuration
docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart nginx
```

## Self-Signed Certificates (Development/Testing)

For development or internal use, you can create self-signed certificates:

```bash
# Create SSL directory
mkdir -p ssl

# Generate private key
openssl genrsa -out ssl/key.pem 2048

# Generate certificate signing request
openssl req -new -key ssl/key.pem -out ssl/csr.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

# Generate self-signed certificate
openssl x509 -req -days 365 -in ssl/csr.pem \
  -signkey ssl/key.pem -out ssl/cert.pem

# Create chain file (same as cert for self-signed)
cp ssl/cert.pem ssl/chain.pem
```

## Certificate Renewal

### Automated Renewal with Certbot

The project includes automated SSL certificate management scripts:

1. **Renewal Script**: `scripts/renew-ssl.sh` - Handles certificate renewal
2. **Monitoring Script**: `scripts/ssl-check.sh` - Monitors certificate health
3. **Setup Script**: `scripts/setup-ssl-monitoring.sh` - Configures automated monitoring

### Quick Setup

```bash
# Setup SSL certificate monitoring and auto-renewal
./scripts/setup-ssl-monitoring.sh

# Test SSL health check
./scripts/ssl-check.sh

# Manual renewal test
./scripts/renew-ssl.sh
```

### Manual Cron Setup

If you prefer manual cron configuration:
```bash
# Check for renewal twice daily
0 0,12 * * * /path/to/nellis-auction-helper/scripts/renew-ssl.sh >> /var/log/letsencrypt-renew.log 2>&1

# Daily SSL health check
0 9 * * * /path/to/nellis-auction-helper/scripts/ssl-check.sh >> /var/log/ssl-check.log 2>&1
```

## Production Configuration

### Environment Variables

Update `.env.production`:
```env
# SSL Configuration
SSL_CERT_PATH=/etc/nginx/ssl/live/your-domain.com/fullchain.pem
SSL_KEY_PATH=/etc/nginx/ssl/live/your-domain.com/privkey.pem
SSL_CHAIN_PATH=/etc/nginx/ssl/live/your-domain.com/chain.pem

# Domain configuration
DOMAIN_NAME=your-domain.com
```

### Security Headers

The nginx configuration includes security headers:
- `Strict-Transport-Security`: Forces HTTPS
- `X-Frame-Options`: Prevents clickjacking
- `X-Content-Type-Options`: Prevents MIME sniffing
- `Content-Security-Policy`: Controls resource loading

### SSL Configuration Options

#### Modern Configuration (Recommended)
```nginx
# Supports only TLS 1.2 and 1.3
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256...
```

#### Intermediate Configuration (Broader Compatibility)
```nginx
# Also supports older clients
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256...
```

## Testing SSL Configuration

### 1. Automated Testing
```bash
# Run comprehensive SSL health check
./scripts/ssl-check.sh

# Check specific certificate expiry
./scripts/ssl-check.sh expiry ssl/cert.pem 30

# Test SSL connection
./scripts/ssl-check.sh connection your-domain.com 443
```

### 2. Manual Testing
```bash
# Test SSL handshake
openssl s_client -connect your-domain.com:443 -servername your-domain.com

# Check certificate details
openssl x509 -in ssl/cert.pem -text -noout
```

### 3. Online Tools
- [SSL Labs](https://www.ssllabs.com/ssltest/): Comprehensive SSL test
- [Security Headers](https://securityheaders.com/): Check security headers
- [Mozilla Observatory](https://observatory.mozilla.org/): Security scan

### 4. curl Testing
```bash
# Test HTTPS endpoint
curl -v https://your-domain.com/health

# Test HTTP to HTTPS redirect
curl -I http://your-domain.com
```

## Troubleshooting

### Common Issues

1. **Certificate not found**
   ```
   nginx: [emerg] cannot load certificate "/etc/nginx/ssl/cert.pem"
   ```
   - Check file paths and permissions
   - Ensure certificates are mounted correctly

2. **Mixed content warnings**
   - Update all internal links to use HTTPS
   - Check WebSocket connections use `wss://`
   - Update API URLs in environment variables

3. **502 Bad Gateway**
   - Check backend services are running
   - Verify Docker network connectivity
   - Check nginx upstream configuration

4. **Certificate renewal fails**
   - Ensure port 80 is accessible
   - Check certbot webroot path
   - Verify domain DNS settings

### Debug Commands

```bash
# Check nginx configuration
docker-compose exec nginx nginx -t

# View nginx error logs
docker-compose logs -f nginx

# Test backend connectivity
docker-compose exec nginx curl http://backend:3000/health

# Check certificate expiry
openssl x509 -enddate -noout -in ssl/cert.pem
```

## Best Practices

1. **Certificate Management**
   - Use Let's Encrypt for free certificates
   - Automate renewal process
   - Monitor expiration dates
   - Keep private keys secure

2. **Security**
   - Use strong cipher suites
   - Enable OCSP stapling
   - Implement security headers
   - Regular security updates

3. **Performance**
   - Enable HTTP/2
   - Use SSL session caching
   - Enable OCSP stapling
   - Optimize cipher suite order

4. **Monitoring**
   - Set up certificate expiry alerts
   - Monitor SSL handshake errors
   - Track SSL protocol usage
   - Log security header violations

## SSL Monitoring and Alerting

### Alert Configuration

Configure SSL monitoring alerts:

```bash
# Set up email alerts
export SSL_ALERT_EMAIL="ops@your-domain.com"

# Set up webhook alerts (optional)
export SSL_ALERT_WEBHOOK="https://your-webhook-url/alerts"

# Set alert threshold (days before expiry)
export SSL_ALERT_THRESHOLD="7"

# Test alert system
./scripts/ssl-alert.sh
```

### Log Monitoring

SSL monitoring logs are stored in:
- `logs/ssl-renewal.log` - Certificate renewal logs
- `logs/ssl-check.log` - Daily health check logs
- `logs/ssl-expiry.log` - Weekly expiry check logs
- `logs/ssl-alerts.log` - Alert notification logs

## Integration with Monitoring

Add SSL metrics to Prometheus:

```yaml
# prometheus.yml addition
- job_name: 'ssl_exporter'
  static_configs:
    - targets:
      - your-domain.com:443
  metrics_path: /probe
  params:
    module: [https]
  relabel_configs:
    - source_labels: [__address__]
      target_label: __param_target
    - source_labels: [__param_target]
      target_label: instance
    - target_label: __address__
      replacement: ssl-exporter:9219
```

## Backup SSL Certificates

Include SSL certificates in your backup routine:

```bash
# Add to backup script
cp -r ssl/* "$BACKUP_DIR/ssl/"

# Exclude private keys from version control
echo "ssl/*.pem" >> .gitignore
echo "ssl/*.key" >> .gitignore
```

## Next Steps

1. Set up monitoring for certificate expiration
2. Configure alerts for SSL errors
3. Implement certificate pinning (optional)
4. Set up multi-domain certificates (SAN)
5. Consider using a CDN for additional security