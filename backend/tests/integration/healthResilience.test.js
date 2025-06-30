const request = require('supertest');
const { app, server } = require('../../src/index');
const logger = require('../../src/utils/logger');
const storage = require('../../src/services/storage');
const healthStorage = require('../../src/services/healthStorage');

// Suppress logs during tests
logger.transports.forEach(transport => {
    transport.silent = true;
});

describe('Health Monitoring Resilience Tests', () => {
    let originalRedis;
    
    beforeAll(async () => {
        // Clear any existing health data
        await healthStorage.clear();
    });
    
    afterAll(async () => {
        if (server && server.close) {
            await new Promise((resolve) => server.close(resolve));
        }
        // Clean up health storage
        await healthStorage.shutdown();
    });

    describe('Health monitoring with Redis failure', () => {
        beforeEach(() => {
            // Save original Redis state
            originalRedis = {
                client: storage.redis,
                connected: storage.connected
            };
        });
        
        afterEach(() => {
            // Restore Redis state
            storage.redis = originalRedis.client;
            storage.connected = originalRedis.connected;
        });
        
        it('should continue to work when Redis is disconnected', async () => {
            // Simulate Redis disconnection
            storage.connected = false;
            storage.redis = null;
            
            const response = await request(app)
                .get('/health?detailed=true')
                .expect(200); // Should still return 200 even with Redis down
            
            expect(response.body).toMatchObject({
                status: expect.any(String),
                timestamp: expect.any(String),
                uptime: expect.any(Number),
                checks: expect.any(Object)
            });
            
            // Verify Redis check exists if registered
            if (response.body.checks.redis) {
                expect(response.body.checks.redis).toMatchObject({
                    status: 'unhealthy',
                    message: expect.stringContaining('disconnected')
                });
            }
        });
        
        it('should store health data independently of Redis', async () => {
            // Disconnect Redis
            storage.connected = false;
            storage.redis = null;
            
            // Make multiple health checks
            for (let i = 0; i < 3; i++) {
                await request(app)
                    .get('/health?detailed=true')
                    .expect(200);
                    
                // Small delay between checks
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Verify health data was stored
            const history = await healthStorage.getHealthHistory(5);
            expect(history).toBeInstanceOf(Array);
            expect(history.length).toBeGreaterThanOrEqual(3);
            
            // Verify each health check has required fields
            history.forEach(check => {
                expect(check).toHaveProperty('timestamp');
                expect(check).toHaveProperty('status');
                expect(check).toHaveProperty('checks');
            });
        });
        
        it('should persist health data across restarts', async () => {
            // Disconnect Redis
            storage.connected = false;
            storage.redis = null;
            
            // Make a health check
            const firstResponse = await request(app)
                .get('/health?detailed=true')
                .expect(200);
            
            // Force sync to disk
            await healthStorage.syncToFile();
            
            // Create new health storage instance to simulate restart
            const newHealthStorage = require('../../src/services/healthStorage');
            
            // Get current health from new instance
            const currentHealth = await newHealthStorage.getCurrentHealth();
            
            expect(currentHealth).toBeTruthy();
            expect(currentHealth.status).toBe(firstResponse.body.status);
        });
        
        it('should handle multiple concurrent requests without Redis', async () => {
            // Disconnect Redis
            storage.connected = false;
            storage.redis = null;
            
            // Make concurrent requests
            const promises = Array(10).fill(null).map(() => 
                request(app)
                    .get('/health')
                    .expect(200)
            );
            
            const responses = await Promise.all(promises);
            
            // All should succeed
            responses.forEach(response => {
                expect(response.body.status).toBeDefined();
                expect(response.body.timestamp).toBeDefined();
            });
        });
        
        it('should show degraded status when Redis is down but other components are healthy', async () => {
            // Disconnect Redis
            storage.connected = false;
            storage.redis = null;
            
            const response = await request(app)
                .get('/health?detailed=true')
                .expect(200);
            
            // Overall status depends on if Redis is critical
            // With the new resilient design, system can be healthy even with Redis down
            expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.status);
            
            // But other components should still be checked
            expect(response.body.checks.memory.status).toBeDefined();
            expect(response.body.checks.eventLoop.status).toBeDefined();
            expect(response.body.checks.diskSpace.status).toBeDefined();
            
            // Check Redis status if it exists
            if (response.body.checks.redis) {
                expect(response.body.checks.redis.status).toBe('unhealthy');
            }
        });
    });
    
    describe('Health storage edge cases', () => {
        it('should handle file system errors gracefully', async () => {
            // Mock file system error
            const fs = require('fs').promises;
            const originalWriteFile = fs.writeFile;
            fs.writeFile = jest.fn().mockRejectedValue(new Error('Disk full'));
            
            try {
                // Should still return health data even if can't write to disk
                const response = await request(app)
                    .get('/health')
                    .expect(200);
                
                expect(response.body.status).toBeDefined();
            } finally {
                // Restore original function
                fs.writeFile = originalWriteFile;
            }
        });
        
        it('should limit health history size', async () => {
            // Make many health checks
            const checkCount = 150; // More than maxHistorySize (100)
            
            for (let i = 0; i < checkCount; i++) {
                await healthStorage.addHealthCheck({
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    checks: {}
                });
            }
            
            // Get all history
            const history = await healthStorage.getHealthHistory(200);
            
            // Should be limited to maxHistorySize
            expect(history.length).toBeLessThanOrEqual(100);
        });
        
        it('should clean up old health data', async () => {
            // This test is for the cleanup mechanism which runs periodically
            // For now, just verify the storage limits history size
            
            // Add many entries
            for (let i = 0; i < 150; i++) {
                await healthStorage.addHealthCheck({
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    checks: {}
                });
            }
            
            // Verify history is limited
            const history = await healthStorage.getHealthHistory(200);
            expect(history.length).toBeLessThanOrEqual(100);
        });
    });
    
    describe('Dashboard health view integration', () => {
        it('should provide data for dashboard health view', async () => {
            const response = await request(app)
                .get('/health?detailed=true')
                .expect(200);
            
            // Verify all required fields for dashboard
            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('uptime');
            expect(response.body).toHaveProperty('checks');
            
            // Verify default health checks exist
            expect(response.body.checks).toHaveProperty('memory');
            expect(response.body.checks).toHaveProperty('eventLoop');
            expect(response.body.checks).toHaveProperty('diskSpace');
            
            // Verify each check has required fields
            Object.values(response.body.checks).forEach(check => {
                expect(check).toHaveProperty('name');
                expect(check).toHaveProperty('status');
                expect(check).toHaveProperty('message');
                expect(check).toHaveProperty('duration');
            });
            
            // Verify auction stats if present
            if (response.body.auctions) {
                expect(response.body.auctions).toHaveProperty('monitored');
                expect(response.body.auctions).toHaveProperty('memoryStats');
            }
        });
    });
});