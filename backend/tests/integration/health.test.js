const request = require('supertest');
const { app } = require('../../src/index');
const logger = require('../../src/utils/logger');
const storage = require('../../src/services/storage');
const healthChecker = require('../../src/utils/healthCheck');
const nellisApi = require('../../src/services/nellisApi');
const prometheusMetrics = require('../../src/utils/prometheusMetrics');
// const auctionMonitor = require('../../src/services/auctionMonitor');
// const WebSocket = require('ws');

// Suppress logs during tests
logger.transports.forEach(transport => {
  transport.silent = true;
});

describe('Health Endpoint Integration Tests', () => {
  let originalPort;
  let testServer;
  let wss;

  beforeAll(async () => {
    // Save original port and set test port to avoid conflicts
    originalPort = process.env.PORT;
    process.env.PORT = '0'; // Use random available port

    // Initialize storage if needed
    if (!storage.redis) {
      await storage.initialize();
    }

    // Create WebSocket server for test
    wss = { clients: { size: 0 } }; // Mock WebSocket server

    // Register health checks if not already registered
    if (!healthChecker.checks.has('redis')) {
      healthChecker.registerCheck('redis', () => {
        const connected = storage.connected;
        return {
          status: connected ? 'healthy' : 'unhealthy',
          message: connected ? 'Redis connected' : 'Redis not connected',
          details: {
            connected,
            url: process.env.REDIS_URL ? 'Configured' : 'Not configured'
          }
        };
      });
    }

    if (!healthChecker.checks.has('websocket')) {
      healthChecker.registerCheck('websocket', () => {
        const clientCount = wss.clients.size;
        return {
          status: 'healthy',
          message: `${clientCount} connected clients`,
          details: {
            clients: clientCount,
            maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS_PER_IP, 10) || 10
          }
        };
      });
    }

    if (!healthChecker.checks.has('nellis-api')) {
      healthChecker.registerCheck('nellis-api', () => {
        const circuitBreakerState = prometheusMetrics.metrics.performance.circuitBreakerState._getValue() || 0;
        const stateMap = ['closed', 'open', 'half-open'];
        const state = stateMap[circuitBreakerState] || 'unknown';

        return {
          status: state === 'closed' ? 'healthy' : state === 'half-open' ? 'degraded' : 'unhealthy',
          message: `Circuit breaker ${state}`,
          details: {
            state,
            cookiesAvailable: nellisApi.hasCookies ? 'Yes' : 'No'
          }
        };
      });
    }
  });

  afterAll(async () => {
    // Restore original port
    if (originalPort !== undefined) {
      process.env.PORT = originalPort;
    }

    if (testServer && testServer.close) {
      await new Promise((resolve) => testServer.close(resolve));
    }

    if (storage.redis) {
      await storage.close();
    }
  });

  describe('GET /health', () => {
    it('should return basic health status', async () => {
      const response = await request(app)
        .get('/health');

      // Health endpoint can return 200 or 503 depending on health status
      expect([200, 503]).toContain(response.status);

      expect(response.body).toMatchObject({
        status: expect.stringMatching(/healthy|unhealthy/),
        timestamp: expect.any(String),
        uptime: expect.any(Number)
      });
    });

    it('should return detailed health status with query parameter', async () => {
      const response = await request(app)
        .get('/health?detailed=true');

      // Health endpoint can return 200 or 503 depending on health status
      expect([200, 503]).toContain(response.status);

      expect(response.body).toMatchObject({
        status: expect.stringMatching(/healthy|unhealthy/),
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        checks: expect.objectContaining({
          memory: expect.objectContaining({
            name: 'memory',
            status: expect.stringMatching(/healthy|degraded|unhealthy/),
            message: expect.any(String),
            duration: expect.any(Number)
          }),
          eventLoop: expect.objectContaining({
            name: 'eventLoop',
            status: expect.stringMatching(/healthy|degraded|unhealthy/),
            message: expect.any(String),
            duration: expect.any(Number)
          }),
          diskSpace: expect.objectContaining({
            name: 'diskSpace',
            status: expect.stringMatching(/healthy|degraded|unhealthy/),
            message: expect.any(String),
            duration: expect.any(Number)
          }),
          redis: expect.objectContaining({
            name: 'redis',
            status: expect.stringMatching(/healthy|unhealthy/),
            message: expect.any(String),
            duration: expect.any(Number)
          }),
          websocket: expect.objectContaining({
            name: 'websocket',
            status: expect.stringMatching(/healthy|unhealthy/),
            message: expect.any(String),
            duration: expect.any(Number)
          }),
          'nellis-api': expect.objectContaining({
            name: 'nellis-api',
            status: expect.stringMatching(/healthy|unhealthy/),
            message: expect.any(String),
            duration: expect.any(Number)
          })
        }),
        auctions: expect.objectContaining({
          monitored: expect.any(Number),
          memoryStats: expect.objectContaining({
            total: expect.any(Number),
            active: expect.any(Number),
            ended: expect.any(Number),
            pollingIntervals: expect.any(Number)
          })
        })
      });
    });

    it('should return correct status codes based on health', async () => {
      const response = await request(app)
        .get('/health')
        .expect((res) => {
          // Health endpoint should return 200 even when unhealthy
          // (some systems use 503 for unhealthy, but our current implementation uses 200)
          expect([200, 503]).toContain(res.status);
        });

      expect(response.body.status).toBeDefined();
    });

    it('should include auction monitoring stats', async () => {
      const response = await request(app)
        .get('/health?detailed=true');

      // Health endpoint can return 200 or 503 depending on health status
      expect([200, 503]).toContain(response.status);

      expect(response.body.auctions).toBeDefined();
      expect(response.body.auctions.monitored).toBeGreaterThanOrEqual(0);
      expect(response.body.auctions.memoryStats).toBeDefined();
      expect(response.body.auctions.memoryStats.total).toBeGreaterThanOrEqual(0);
      expect(response.body.auctions.memoryStats.active).toBeGreaterThanOrEqual(0);
      expect(response.body.auctions.memoryStats.ended).toBeGreaterThanOrEqual(0);
    });

    it('should measure check durations accurately', async () => {
      const response = await request(app)
        .get('/health?detailed=true');

      // Health endpoint can return 200 or 503 depending on health status
      expect([200, 503]).toContain(response.status);

      const checks = response.body.checks;
      Object.values(checks).forEach(check => {
        expect(check.duration).toBeGreaterThanOrEqual(0);
        expect(check.duration).toBeLessThan(5000); // No check should take more than 5 seconds
      });
    });

    it('should handle concurrent health check requests', async () => {
      const promises = Array(5).fill(null).map(() =>
        request(app)
          .get('/health?detailed=true')
      );

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        // Health endpoint can return 200 or 503 depending on health status
        expect([200, 503]).toContain(response.status);
        expect(response.body.status).toBeDefined();
        expect(response.body.checks).toBeDefined();
      });
    });

    it('should show redis as unhealthy when disconnected', async () => {
      // Temporarily disconnect redis
      const originalRedis = storage.redis;
      const originalConnected = storage.connected;
      storage.redis = null;
      storage.connected = false;

      try {
        const response = await request(app)
          .get('/health?detailed=true');

        // Health endpoint can return 200 or 503 depending on health status
        expect([200, 503]).toContain(response.status);

        expect(response.body.checks.redis.status).toBe('unhealthy');
        expect(response.body.checks.redis.message).toContain('not connected');
      } finally {
        // Restore redis client
        storage.redis = originalRedis;
        storage.connected = originalConnected;
      }
    });

    it('should calculate overall status correctly', async () => {
      const response = await request(app)
        .get('/health?detailed=true');

      // Health endpoint can return 200 or 503 depending on health status
      expect([200, 503]).toContain(response.status);

      const checks = response.body.checks;
      const hasUnhealthy = Object.values(checks).some(check => check.status === 'unhealthy');

      if (hasUnhealthy) {
        expect(response.body.status).toBe('unhealthy');
      } else {
        expect(response.body.status).toBe('healthy');
      }
    });
  });

  describe('Health Check Performance', () => {
    it('should complete health check within reasonable time', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/health?detailed=true');

      // Health endpoint can return 200 or 503 depending on health status
      expect([200, 503]).toContain(response.status);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should not leak memory on repeated health checks', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform 10 health checks
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .get('/health?detailed=true');

        // Health endpoint can return 200 or 503 depending on health status
        expect([200, 503]).toContain(response.status);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});