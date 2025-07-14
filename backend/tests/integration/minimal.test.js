/**
 * Minimal Integration Test
 * Demonstrates basic test setup is working
 */

const request = require('supertest');
const express = require('express');
const WebSocket = require('ws');

describe('Minimal Integration Tests', () => {
  let app;
  let server;
  let wss;

  beforeAll(() => {
    // Create minimal Express app
    app = express();
    app.use(express.json());

    // Add test endpoints
    app.get('/test', (req, res) => {
      res.json({ success: true });
    });

    app.post('/echo', (req, res) => {
      res.json({ echo: req.body });
    });

    // Create server
    server = app.listen(0); // Random port
    // const port = server.address().port;

    // Create WebSocket server
    wss = new WebSocket.Server({ server });

    wss.on('connection', (ws) => {
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      });
    });
  });

  afterAll(() => {
    wss.close();
    server.close();
  });

  describe('HTTP Tests', () => {
    it('should handle GET requests', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.body).toEqual({ success: true });
    });

    it('should handle POST requests', async () => {
      const response = await request(app)
        .post('/echo')
        .send({ data: 'test' })
        .expect(200);

      expect(response.body).toEqual({ echo: { data: 'test' } });
    });
  });

  describe('WebSocket Tests', () => {
    it('should handle WebSocket connections', async () => {
      const port = server.address().port;
      const ws = new WebSocket(`ws://localhost:${port}`);

      await new Promise((resolve) => {
        ws.on('open', resolve);
      });

      expect(ws.readyState).toBe(WebSocket.OPEN);

      ws.close();
    });

    it('should handle ping/pong messages', async () => {
      const port = server.address().port;
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
  });
});