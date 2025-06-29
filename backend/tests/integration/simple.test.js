// Simple test to verify basic functionality
const request = require('supertest');
const express = require('express');

describe('Simple Integration Test', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Add a simple test route
    app.get('/test', (req, res) => {
      res.json({ success: true, message: 'Test endpoint working' });
    });
  });

  it('should respond to test endpoint', async () => {
    const response = await request(app)
      .get('/test')
      .expect(200);
    
    expect(response.body).toEqual({
      success: true,
      message: 'Test endpoint working'
    });
  });

  it('should handle POST requests', async () => {
    app.post('/test', (req, res) => {
      res.json({ received: req.body });
    });

    const response = await request(app)
      .post('/test')
      .send({ data: 'test data' })
      .expect(200);
    
    expect(response.body.received).toEqual({ data: 'test data' });
  });
});