# Health Monitoring System

## Overview

The auction tracker includes a comprehensive health monitoring system that provides real-time insights into the status of all system components. The health monitoring system is designed to be resilient and continues to function even when primary components (like Redis) fail.

## Architecture

### Independent Health Storage

As of the latest update, the health monitoring system uses an independent storage mechanism to ensure it remains operational even during Redis failures. This is critical because health monitoring should be the last system to fail.

#### Storage Implementation

The health monitoring system uses a two-tier storage approach:

1. **Primary Storage**: In-memory JavaScript Map for fast access
2. **Secondary Storage**: JSON file on disk for persistence across restarts

Key features:
- Automatic synchronization between memory and disk
- Debounced file writes (maximum once per 5 seconds)
- Automatic cleanup of old data (24-hour retention)
- Graceful degradation when storage operations fail

### Health Check Components

The system monitors the following components:

1. **Memory**
   - Heap usage and total heap size
   - RSS (Resident Set Size) memory
   - System memory statistics
   - Thresholds: Warning at 200MB RSS, Critical at 240MB RSS

2. **Event Loop**
   - Measures event loop lag
   - Indicates if the Node.js process is responsive
   - Thresholds: Warning at 100ms, Critical at 500ms

3. **Disk Space**
   - Monitors available disk space for logs
   - Thresholds: Warning at 80% usage, Critical at 90% usage

4. **Redis Database**
   - Connection status
   - Non-critical: System continues to function without Redis

5. **WebSocket Server**
   - Number of connected clients
   - Connection capacity

6. **Nellis API**
   - API availability
   - Circuit breaker status

## API Endpoints

### GET /health

Returns comprehensive health status of the system.

Query Parameters:
- `detailed=true` - Include detailed metrics for each component

Response:
```json
{
  "status": "healthy|degraded|unhealthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "checks": {
    "memory": {
      "name": "memory",
      "status": "healthy",
      "message": "Heap: 50MB/100MB, RSS: 120MB",
      "duration": 2,
      "details": {
        "heap": {
          "used": 50,
          "total": 100,
          "percentage": 50
        },
        "rss": 120,
        "system": {
          "total": 16384,
          "free": 8192,
          "percentage": 50
        }
      }
    }
    // ... other checks
  },
  "auctions": {
    "monitored": 5,
    "memoryStats": {
      "total": 5,
      "active": 3,
      "ended": 2,
      "pollingIntervals": 3
    }
  }
}
```

Status Codes:
- 200: System is healthy or degraded but operational
- 503: System is unhealthy

### GET /health/live

Simple liveness check for load balancers.

Response:
```json
{
  "alive": true,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "pid": 1234,
  "uptime": 3600
}
```

### GET /health/ready

Readiness check for Kubernetes-style deployments.

Response:
```json
{
  "ready": true,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "checks": 2
}
```

## Dashboard Integration

The dashboard includes a dedicated System Health view that:
- Displays overall system status with color-coded indicators
- Shows individual component health in a table format
- Provides auction monitoring statistics
- Auto-refreshes every 5 seconds
- Works even when backend storage (Redis) is unavailable

### Accessing the Health View

1. Navigate to the dashboard (http://localhost:3001)
2. Click "System Health" in the navigation menu
3. View real-time health status of all components

### Health Status Indicators

- **Green**: Component is healthy and operating normally
- **Yellow**: Component is degraded but functional
- **Red**: Component is unhealthy and may need attention
- **Gray**: Status unknown (usually indicates communication failure)

## Implementation Details

### Health Storage Service

Location: `backend/src/services/healthStorage.js`

Key methods:
- `set(key, value)`: Store health data
- `get(key)`: Retrieve health data
- `addHealthCheck(result)`: Add health check result to history
- `getHealthHistory(limit)`: Get historical health data
- `getCurrentHealth()`: Get the most recent health status

### Health Check Service

Location: `backend/src/utils/healthCheck.js`

Key methods:
- `registerCheck(name, checkFn)`: Register a new health check
- `getHealth(detailed)`: Run all health checks and return results
- `getSimpleHealth()`: Get basic health status
- `getReadiness()`: Check if service is ready
- `getLiveness()`: Check if service is alive

## Resilience Features

1. **Independent Storage**: Health data is stored separately from application data
2. **Graceful Degradation**: System continues to function even when components fail
3. **Error Isolation**: Health check failures don't crash the application
4. **Automatic Recovery**: Failed components are retried automatically
5. **Historical Data**: Recent health check results are preserved for troubleshooting

## Configuration

Environment variables:
- `HEALTH_CHECK_INTERVAL`: How often to run health checks (default: 30 seconds)
- `HEALTH_HISTORY_SIZE`: Number of historical health checks to retain (default: 100)
- `HEALTH_FILE_SYNC_DELAY`: Delay before syncing to disk (default: 5000ms)

## Monitoring Best Practices

1. **Regular Checks**: Monitor the /health endpoint from your monitoring system
2. **Alert Thresholds**: Set up alerts for degraded or unhealthy states
3. **Historical Analysis**: Review health history to identify patterns
4. **Proactive Maintenance**: Address degraded states before they become critical
5. **Load Testing**: Verify health monitoring remains functional under load

## Troubleshooting

### Health endpoint returns 503

1. Check individual component statuses in the response
2. Look for components marked as "unhealthy"
3. Review application logs for specific errors
4. Check system resources (memory, disk space)

### Dashboard shows "Unable to fetch health data"

1. Verify backend is running and accessible
2. Check network connectivity between dashboard and backend
3. Look for CORS errors in browser console
4. Verify backend URL configuration

### Redis shows as unhealthy

This is non-critical. The system will:
1. Continue using in-memory storage
2. Attempt to reconnect to Redis automatically
3. Sync data when Redis connection is restored

## Redis Resilience and Recovery

The system is designed to handle Redis failures and recoveries gracefully:

### Automatic Reconnection
- The storage service (`backend/src/services/storage.js`) implements automatic reconnection
- Uses exponential backoff strategy with a maximum delay of 30 seconds
- Reconnection attempts continue indefinitely until successful
- Connection state is tracked through Redis events: `connect`, `ready`, `error`, `close`, `reconnecting`

### Failure Handling
- Backend continues operating when Redis is unavailable, using in-memory fallback
- Health monitoring remains fully functional during Redis outages via independent storage
- Dashboard correctly displays Redis status (healthy/unhealthy) in real-time
- Auto-refresh ensures status updates are reflected within 5-10 seconds
- No uncaught exceptions or crashes when Redis goes down

### Recovery Detection
- When Redis comes back online, the storage service automatically reconnects
- The `ready` event handler updates the connection state immediately
- Health checks reflect the recovered status on the next check cycle
- Dashboard updates automatically via its 5-second refresh interval
- No manual intervention or service restart required

### Implementation Details

1. **Storage Service Resilience**:
   ```javascript
   retryStrategy: (times) => {
     const delay = Math.min(times * 1000, 30000); // Max 30 seconds
     return delay; // Keep retrying indefinitely
   }
   ```

2. **Error Handling**:
   - Storage errors are caught and logged without crashing the application
   - Global error handlers prevent process termination from Redis connection errors
   - Error events are only emitted if there are listeners to prevent uncaught exceptions

3. **Health Check Integration**:
   - Redis health check uses `storage.connected` flag for instant status
   - Dashboard can parse health responses even with 503 status codes
   - Overall system status correctly reflects Redis state (healthy/degraded/unhealthy)

## Future Enhancements

1. **Metrics Export**: Prometheus/Grafana integration
2. **Custom Health Checks**: Plugin system for custom checks
3. **Alerting**: Built-in alerting for critical issues
4. **Performance Baselines**: Automatic performance baseline detection
5. **Predictive Analysis**: ML-based failure prediction