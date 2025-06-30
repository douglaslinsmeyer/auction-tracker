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

    it('should serve index.html for non-existent routes (SPA behavior)', async () => {
      const response = await request(app).get('/non-existent-route');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/html/);
    });
  });

  describe('API configuration', () => {
    it('should provide configuration endpoint', async () => {
      const response = await request(app).get('/api/config');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toHaveProperty('backendUrl');
      expect(response.body).toHaveProperty('wsUrl');
    });
  });

});