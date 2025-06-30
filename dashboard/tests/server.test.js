const request = require('supertest');
const path = require('path');

describe('Dashboard Server', () => {
  let server;
  let app;

  beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.PORT = '0'; // Use random port
    
    // Load server
    const serverModule = require('../server');
    app = serverModule.app;
    server = serverModule.server;
  });

  afterAll((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  describe('Static file serving', () => {
    it('should serve index.html for root path', async () => {
      const response = await request(app).get('/');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/html/);
    });

    it('should serve app.js', async () => {
      const response = await request(app).get('/app.js');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/javascript/);
    });

    it('should serve styles.css', async () => {
      const response = await request(app).get('/styles.css');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/css/);
    });

    it('should return 404 for non-existent files', async () => {
      const response = await request(app).get('/non-existent-file.js');
      expect(response.status).toBe(404);
    });
  });

  describe('Security headers', () => {
    it('should set X-Content-Type-Options header', async () => {
      const response = await request(app).get('/');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('API proxy configuration', () => {
    it('should have proxy middleware configured for /api', async () => {
      // This test verifies that proxy middleware is set up
      // Actual proxy functionality would require backend to be running
      const response = await request(app).get('/api/health');
      // Expect proxy error since backend is not running in test
      expect([502, 503, 504]).toContain(response.status);
    });
  });
});