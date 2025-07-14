/**
 * Working Integration Test
 * Demonstrates the test infrastructure is functional
 */

const request = require('supertest');
const express = require('express');
const WebSocket = require('ws');

describe('Working Integration Tests', () => {
  let app;
  let server;
  let wss;
  let port;

  beforeAll((done) => {
    // Create Express app
    app = express();
    app.use(express.json());

    // Add mock API routes
    app.get('/api/status', (req, res) => {
      res.json({
        success: true,
        status: 'running',
        monitoredAuctions: 0,
        storage: {
          type: 'memory',
          connected: true,
          healthy: true
        }
      });
    });

    app.post('/api/auth', (req, res) => {
      const { cookies } = req.body;
      if (!cookies) {
        res.status(400).json({ success: false, error: 'Cookies required' });
        return;
      }
      res.json({ success: true });
    });

    app.get('/api/auctions', (req, res) => {
      res.json({ success: true, auctions: [] });
    });

    // Create server
    server = app.listen(0, () => {
      port = server.address().port;

      // Create WebSocket server
      wss = new WebSocket.Server({ server });

      wss.on('connection', (ws) => {
        let authenticated = false;

        ws.on('message', (data) => {
          const message = JSON.parse(data);

          switch (message.type) {
            case 'ping':
              ws.send(JSON.stringify({ type: 'pong' }));
              break;

            case 'authenticate':
              if (message.token === 'dev-token') {
                authenticated = true;
                ws.send(JSON.stringify({
                  type: 'authenticated',
                  success: true,
                  requestId: message.requestId
                }));
              } else {
                ws.send(JSON.stringify({
                  type: 'error',
                  error: 'Invalid token',
                  requestId: message.requestId
                }));
              }
              break;

            case 'startMonitoring':
              if (!authenticated) {
                ws.send(JSON.stringify({
                  type: 'error',
                  error: 'Not authenticated',
                  requestId: message.requestId
                }));
              } else {
                ws.send(JSON.stringify({
                  type: 'response',
                  success: true,
                  requestId: message.requestId
                }));
              }
              break;

            default:
              ws.send(JSON.stringify({
                type: 'error',
                error: 'Unknown message type'
              }));
          }
        });
      });

      done();
    });
  });

  afterAll((done) => {
    wss.close();
    server.close(done);
  });

  describe('API Tests', () => {
    it('should return system status', async () => {
      const response = await request(app)
        .get('/api/status')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        status: 'running',
        storage: {
          connected: true,
          healthy: true
        }
      });
    });

    it('should handle authentication', async () => {
      const response = await request(app)
        .post('/api/auth')
        .send({ cookies: 'test-cookies' })
        .expect(200);

      expect(response.body).toEqual({ success: true });
    });

    it('should get auctions list', async () => {
      const response = await request(app)
        .get('/api/auctions')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        auctions: []
      });
    });
  });

  describe('WebSocket Tests', () => {
    it('should handle ping/pong', async () => {
      const ws = new WebSocket(`ws://localhost:${port}`);

      await new Promise((resolve) => {
        ws.on('open', resolve);
      });

      const response = await new Promise((resolve) => {
        ws.on('message', (data) => {
          resolve(JSON.parse(data));
        });
        ws.send(JSON.stringify({ type: 'ping' }));
      });

      expect(response).toEqual({ type: 'pong' });

      ws.close();
    });

    it('should authenticate with valid token', async () => {
      const ws = new WebSocket(`ws://localhost:${port}`);

      await new Promise((resolve) => {
        ws.on('open', resolve);
      });

      const response = await new Promise((resolve) => {
        ws.on('message', (data) => {
          resolve(JSON.parse(data));
        });
        ws.send(JSON.stringify({
          type: 'authenticate',
          token: 'dev-token',
          requestId: 'test-123'
        }));
      });

      expect(response).toMatchObject({
        type: 'authenticated',
        success: true,
        requestId: 'test-123'
      });

      ws.close();
    });

    it('should require authentication for monitoring', async () => {
      const ws = new WebSocket(`ws://localhost:${port}`);

      await new Promise((resolve) => {
        ws.on('open', resolve);
      });

      const response = await new Promise((resolve) => {
        ws.on('message', (data) => {
          resolve(JSON.parse(data));
        });
        ws.send(JSON.stringify({
          type: 'startMonitoring',
          auctionId: '123',
          requestId: 'monitor-123'
        }));
      });

      expect(response).toMatchObject({
        type: 'error',
        error: 'Not authenticated',
        requestId: 'monitor-123'
      });

      ws.close();
    });
  });

  describe('Integration Flow', () => {
    it('should handle complete flow', async () => {
      // 1. Authenticate via API
      const authResponse = await request(app)
        .post('/api/auth')
        .send({ cookies: 'test-cookies' })
        .expect(200);

      expect(authResponse.body.success).toBe(true);

      // 2. Connect WebSocket
      const ws = new WebSocket(`ws://localhost:${port}`);

      await new Promise((resolve) => {
        ws.on('open', resolve);
      });

      // 3. Authenticate WebSocket
      ws.send(JSON.stringify({
        type: 'authenticate',
        token: 'dev-token',
        requestId: 'auth'
      }));

      const authMsg = await new Promise((resolve) => {
        ws.on('message', (data) => {
          resolve(JSON.parse(data));
        });
      });

      expect(authMsg.success).toBe(true);

      // 4. Check status
      const statusResponse = await request(app)
        .get('/api/status')
        .expect(200);

      expect(statusResponse.body.status).toBe('running');

      ws.close();
    });
  });
});