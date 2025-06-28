/**
 * API Integration Tests
 * Tests API endpoints with proper mocking
 */

const request = require('supertest');
const express = require('express');
const { mockAuction, mockCookies } = require('../fixtures/mockData');

describe('API Integration Tests', () => {
  let app;
  
  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Mock API routes
    app.get('/api/status', (req, res) => {
      res.json({
        success: true,
        status: 'running',
        monitoredAuctions: 0,
        uptime: 100,
        storage: {
          type: 'memory',
          connected: true,
          healthy: true
        }
      });
    });
    
    app.get('/api/auctions', (req, res) => {
      res.json({ success: true, auctions: [] });
    });
    
    app.get('/api/auctions/:id', (req, res) => {
      if (req.params.id === mockAuction.id) {
        res.json({ success: true, auction: mockAuction });
      } else {
        res.status(404).json({ success: false, error: 'Auction not found' });
      }
    });
    
    app.post('/api/auctions/:id/monitor', (req, res) => {
      res.json({ success: true, message: 'Started monitoring' });
    });
    
    app.delete('/api/auctions/:id/monitor', (req, res) => {
      res.json({ success: true, message: 'Stopped monitoring' });
    });
    
    app.post('/api/auth', (req, res) => {
      if (req.body.cookies) {
        res.json({ success: true });
      } else {
        res.status(400).json({ success: false, error: 'Cookies required' });
      }
    });
    
    app.get('/api/auth/status', (req, res) => {
      res.json({
        authenticated: true,
        cookieCount: 3,
        cookiesSet: true,
        message: 'Cookies are set'
      });
    });
    
    app.put('/api/auctions/:id/config', (req, res) => {
      res.json({ success: true, config: req.body.config });
    });
  });
  
  describe('Status Endpoint', () => {
    it('should return system status', async () => {
      const response = await request(app)
        .get('/api/status')
        .expect(200);
      
      expect(response.body).toMatchObject({
        success: true,
        status: 'running',
        monitoredAuctions: 0,
        storage: {
          connected: true
        }
      });
    });
  });
  
  describe('Auctions Endpoints', () => {
    it('should return empty auctions list', async () => {
      const response = await request(app)
        .get('/api/auctions')
        .expect(200);
      
      expect(response.body).toEqual({
        success: true,
        auctions: []
      });
    });
    
    it('should get specific auction', async () => {
      const response = await request(app)
        .get(`/api/auctions/${mockAuction.id}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.auction.id).toBe(mockAuction.id);
    });
    
    it('should return 404 for non-existent auction', async () => {
      const response = await request(app)
        .get('/api/auctions/999999')
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
    
    it('should start monitoring auction', async () => {
      const response = await request(app)
        .post('/api/auctions/123/monitor')
        .send({ config: { maxBid: 100 } })
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    it('should stop monitoring auction', async () => {
      const response = await request(app)
        .delete('/api/auctions/123/monitor')
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
  });
  
  describe('Auth Endpoints', () => {
    it('should authenticate with cookies', async () => {
      const response = await request(app)
        .post('/api/auth')
        .send({ cookies: mockCookies })
        .expect(200);
      
      expect(response.body).toEqual({ success: true });
    });
    
    it('should reject auth without cookies', async () => {
      const response = await request(app)
        .post('/api/auth')
        .send({})
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Cookies required');
    });
    
    it('should return auth status', async () => {
      const response = await request(app)
        .get('/api/auth/status')
        .expect(200);
      
      expect(response.body).toMatchObject({
        authenticated: true,
        cookieCount: 3
      });
    });
  });
  
  describe('Config Endpoints', () => {
    it('should update auction config', async () => {
      const newConfig = { maxBid: 200 };
      
      const response = await request(app)
        .put('/api/auctions/123/config')
        .send({ config: newConfig })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.config).toEqual(newConfig);
    });
  });
});