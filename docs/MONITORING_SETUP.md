# Monitoring Setup Guide

This guide covers setting up and using the Prometheus and Grafana monitoring stack for the Nellis Auction Helper.

## Overview

The monitoring stack provides:
- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **Alerts**: Proactive notifications for issues
- **Business Metrics**: Auction performance and bidding success tracking
- **Technical Metrics**: System health, memory usage, and API performance

## Quick Start

1. **Start the monitoring stack**:
   ```bash
   # From the project root
   docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
   ```

2. **Access the services**:
   - Prometheus: http://localhost:9090
   - Grafana: http://localhost:3003 (default login: admin/admin)

3. **View dashboards**:
   - Navigate to Grafana
   - Check the pre-configured dashboards:
     - Nellis Auction Helper - Overview
     - Nellis Auction Helper - Business Metrics

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Backend   │────▶│  Prometheus  │────▶│   Grafana   │
│  (Port 3000)│     │  (Port 9090) │     │ (Port 3003) │
└─────────────┘     └──────────────┘     └─────────────┘
                            │
                    ┌───────▼────────┐
                    │ Alert Manager  │
                    │   (Optional)   │
                    └────────────────┘
```

## Metrics Categories

### Business Metrics
- `auction_active_count`: Currently monitored auctions
- `auction_monitored_total`: Total auctions since startup
- `auction_completed_total`: Completed auctions (won/lost)
- `bids_placed_total`: Total bids by strategy and result
- `bid_amount_dollars`: Distribution of bid amounts
- `strategy_success_total`: Wins by bidding strategy
- `max_bid_reached_total`: Times max bid limit was hit

### SSE Metrics (Real-time Updates)
- `sse_connections_active`: Current SSE connections
- `sse_connections_total`: Connection attempts (success/failed)
- `sse_events_received_total`: Events by type
- `sse_event_latency_seconds`: Event delivery latency
- `sse_connection_errors_total`: Connection failures
- `sse_reconnection_attempts_total`: Reconnection attempts

### Polling Metrics (Fallback)
- `polling_active_count`: Auctions using polling
- `polling_requests_total`: Polling requests (success/failed)
- `polling_duration_seconds`: Request completion time
- `polling_fallback_activations_total`: SSE to polling fallbacks
- `auction_updates_by_source`: Updates by SSE vs polling

### System Metrics
- `system_health_status`: Overall health (0-1)
- `websocket_connections_active`: Connected clients
- `redis_connection_status`: Redis connectivity
- `http_request_duration_seconds`: API latency
- `nodejs_memory_usage_bytes`: Memory consumption
- `circuit_breaker_state`: API circuit breaker status

## Dashboards

### Overview Dashboard
Main system health dashboard showing:
- System health gauge
- SSE vs Polling distribution
- Active auctions and connections
- Bid activity timeline
- Memory usage trends
- API response times
- SSE event rates

### Business Metrics Dashboard
Business performance dashboard showing:
- Total bids and success rate
- Auctions won and win rate
- Strategy effectiveness pie chart
- Bid amount distribution
- Max bid limit reached trends

## Alerts

Pre-configured alerts include:

### Critical Alerts
- `BackendServiceDown`: Backend service is unreachable
- `SystemHealthDegraded`: Health score below 70%

### Warning Alerts
- `RedisConnectionLost`: Redis disconnected for >2 minutes
- `HighMemoryUsage`: Memory usage above 200MB
- `HighSSEFailureRate`: >10% of SSE connections failing
- `ExcessivePollingFallback`: >50% auctions using polling
- `CircuitBreakerOpen`: API circuit breaker triggered
- `HighBidFailureRate`: >20% of bids failing

### Info Alerts
- `NoActiveAuctions`: No auctions for 30 minutes

## Configuration

### Environment Variables
```bash
# Grafana admin password
GRAFANA_ADMIN_PASSWORD=your-secure-password

# Prometheus retention (default: 30d)
PROMETHEUS_RETENTION=30d
```

### Adding Custom Metrics

1. **In your code**:
   ```javascript
   const prometheusMetrics = require('./utils/prometheusMetrics');
   
   // Increment a counter
   prometheusMetrics.metrics.business.bidsPlaced.inc({ 
     strategy: 'sniping', 
     result: 'success' 
   });
   
   // Set a gauge
   prometheusMetrics.metrics.system.websocketConnections.set(10);
   
   // Record a histogram
   prometheusMetrics.metrics.sse.eventLatency.observe(0.123);
   ```

2. **View in Prometheus**:
   - Go to http://localhost:9090
   - Use the expression browser
   - Example queries:
     ```
     auction_active_count
     rate(bids_placed_total[5m])
     histogram_quantile(0.95, http_request_duration_seconds_bucket)
     ```

3. **Add to Grafana**:
   - Create new panel
   - Select Prometheus data source
   - Write your query
   - Configure visualization

## Maintenance

### Backup Grafana Dashboards
```bash
# Export dashboards
docker exec nellis-grafana grafana-cli admin export-dashboard

# Dashboards are also in git:
# grafana/dashboards/*.json
```

### Clean Up Old Data
```bash
# Prometheus data is automatically cleaned based on retention
# To manually clean:
docker exec nellis-prometheus rm -rf /prometheus/*
```

### Update Alert Rules
1. Edit `backend/alerts.yml`
2. Reload Prometheus config:
   ```bash
   curl -X POST http://localhost:9090/-/reload
   ```

## Troubleshooting

### Prometheus Not Scraping
1. Check target status: http://localhost:9090/targets
2. Verify backend is exposing metrics: http://localhost:3000/metrics
3. Check Docker network connectivity

### Grafana Can't Connect to Prometheus
1. Verify Prometheus is running: `docker ps`
2. Check datasource configuration in Grafana
3. Test connection in datasource settings

### Missing Metrics
1. Ensure backend is running with Prometheus integration
2. Check for typos in metric names
3. Verify metrics are being incremented in code
4. Wait for scrape interval (15s by default)

### High Memory Usage
1. Check Prometheus retention settings
2. Reduce metric cardinality (fewer labels)
3. Increase scrape interval if needed
4. Consider using recording rules for expensive queries

## Best Practices

1. **Use appropriate metric types**:
   - Counter: For values that only increase
   - Gauge: For values that can go up or down
   - Histogram: For measuring distributions

2. **Label carefully**:
   - Keep cardinality low
   - Use consistent label names
   - Avoid high-cardinality labels (user IDs, timestamps)

3. **Query efficiently**:
   - Use recording rules for complex queries
   - Leverage PromQL functions
   - Avoid expensive regex matches

4. **Monitor the monitors**:
   - Set up alerts for Prometheus/Grafana health
   - Monitor disk usage for metrics storage
   - Track query performance

## Integration with CI/CD

Add monitoring checks to your deployment:
```yaml
# Example GitHub Action step
- name: Check monitoring health
  run: |
    curl -f http://localhost:9090/-/healthy
    curl -f http://localhost:3003/api/health
```

## Next Steps

1. Configure email/Slack alerts via Alertmanager
2. Add more business-specific dashboards
3. Implement SLI/SLO tracking
4. Set up distributed tracing (optional)
5. Export metrics to cloud monitoring services