const requestSigning = require('../../src/utils/requestSigning');
const { createSigningMiddleware } = require('../../src/middleware/requestSigning');

describe('Request Signing', () => {
  const testSecret = 'test-secret-key-32-bytes-long!!!';

  describe('Signature Generation', () => {
    it('should generate consistent signatures for same input', () => {
      const method = 'POST';
      const path = '/api/auction/123';
      const timestamp = 1234567890;
      const body = '{"bid":100}';

      const sig1 = requestSigning.generateSignature(method, path, timestamp, body, testSecret);
      const sig2 = requestSigning.generateSignature(method, path, timestamp, body, testSecret);

      expect(sig1).toBe(sig2);
      expect(sig1).toMatch(/^[A-Za-z0-9+/=]+$/); // Base64 format
    });

    it('should generate different signatures for different inputs', () => {
      const timestamp = 1234567890;

      const sig1 = requestSigning.generateSignature('GET', '/api/auction/123', timestamp, '', testSecret);
      const sig2 = requestSigning.generateSignature('POST', '/api/auction/123', timestamp, '', testSecret);
      const sig3 = requestSigning.generateSignature('GET', '/api/auction/456', timestamp, '', testSecret);
      const sig4 = requestSigning.generateSignature('GET', '/api/auction/123', timestamp + 1, '', testSecret);

      expect(sig1).not.toBe(sig2);
      expect(sig1).not.toBe(sig3);
      expect(sig1).not.toBe(sig4);
    });

    it('should throw error if secret is missing', () => {
      expect(() => {
        requestSigning.generateSignature('GET', '/api/test', Date.now(), '', null);
      }).toThrow('Signing secret is required');
    });
  });

  describe('Signature Verification', () => {
    it('should verify valid signature', () => {
      const timestamp = Date.now();
      const method = 'POST';
      const path = '/api/auction/123';
      const body = { bid: 100 };

      const signature = requestSigning.generateSignature(
        method,
        path,
        timestamp,
        JSON.stringify(body),
        testSecret
      );

      const req = {
        method,
        originalUrl: path,
        body,
        headers: {
          'x-signature': signature,
          'x-timestamp': timestamp.toString()
        }
      };

      const result = requestSigning.verifySignature(req, testSecret);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const req = {
        method: 'GET',
        originalUrl: '/api/auction/123',
        headers: {
          'x-signature': 'invalid-signature',
          'x-timestamp': Date.now().toString()
        }
      };

      const result = requestSigning.verifySignature(req, testSecret);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Signature verification failed');
    });

    it('should reject expired timestamp', () => {
      const oldTimestamp = Date.now() - 600000; // 10 minutes ago
      const signature = requestSigning.generateSignature(
        'GET',
        '/api/auction/123',
        oldTimestamp,
        '',
        testSecret
      );

      const req = {
        method: 'GET',
        originalUrl: '/api/auction/123',
        headers: {
          'x-signature': signature,
          'x-timestamp': oldTimestamp.toString()
        }
      };

      const result = requestSigning.verifySignature(req, testSecret);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Request timestamp too old or too far in future');
    });

    it('should reject missing signature header', () => {
      const req = {
        method: 'GET',
        originalUrl: '/api/auction/123',
        headers: {
          'x-timestamp': Date.now().toString()
        }
      };

      const result = requestSigning.verifySignature(req, testSecret);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing signature header');
    });

    it('should reject missing timestamp header', () => {
      const req = {
        method: 'GET',
        originalUrl: '/api/auction/123',
        headers: {
          'x-signature': 'some-signature'
        }
      };

      const result = requestSigning.verifySignature(req, testSecret);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing or invalid timestamp header');
    });
  });

  describe('Middleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        method: 'GET',
        path: '/api/auction/123',
        originalUrl: '/api/auction/123',
        headers: {},
        ip: '127.0.0.1'
      };

      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      next = jest.fn();
    });

    it('should pass through when signing is disabled', () => {
      const middleware = createSigningMiddleware({ enabled: false });
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should skip excluded paths', () => {
      const middleware = createSigningMiddleware({
        enabled: true,
        secret: testSecret,
        excludePaths: ['/health']
      });

      req.path = '/health';
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should verify valid signature', () => {
      const timestamp = Date.now();
      const signature = requestSigning.generateSignature(
        req.method,
        req.originalUrl,
        timestamp,
        '',
        testSecret
      );

      req.headers = {
        'x-signature': signature,
        'x-timestamp': timestamp.toString()
      };

      const middleware = createSigningMiddleware({
        enabled: true,
        secret: testSecret
      });

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.signatureVerified).toBe(true);
      expect(req.signatureTimestamp).toBe(timestamp);
    });

    it('should reject invalid signature', () => {
      req.headers = {
        'x-signature': 'invalid-signature',
        'x-timestamp': Date.now().toString()
      };

      const middleware = createSigningMiddleware({
        enabled: true,
        secret: testSecret
      });

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid request signature',
        code: 'INVALID_SIGNATURE',
        details: 'Signature verification failed'
      });
    });

    it('should require signature for bid endpoints when configured', () => {
      req.path = '/api/auction/123/bid';

      const middleware = createSigningMiddleware({
        enabled: true,
        secret: testSecret,
        bidEndpointsRequired: true
      });

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        code: 'SIGNATURE_REQUIRED'
      }));
    });
  });

  describe('Client Helpers', () => {
    it('should generate correct headers', () => {
      const method = 'POST';
      const path = '/api/auction/123';
      const body = '{"bid":100}';

      const headers = requestSigning.generateHeaders(method, path, body, testSecret);

      expect(headers).toHaveProperty('X-Signature');
      expect(headers).toHaveProperty('X-Timestamp');
      expect(headers['X-Signature']).toMatch(/^[A-Za-z0-9+/=]+$/);
      expect(parseInt(headers['X-Timestamp'], 10)).toBeCloseTo(Date.now(), -2);
    });

    it('should sign fetch request correctly', () => {
      const url = 'http://localhost:3000/api/auction/123';
      const options = {
        method: 'POST',
        body: '{"bid":100}',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const signedOptions = requestSigning.signFetchRequest(url, options, testSecret);

      expect(signedOptions.headers).toHaveProperty('X-Signature');
      expect(signedOptions.headers).toHaveProperty('X-Timestamp');
      expect(signedOptions.headers['Content-Type']).toBe('application/json');
    });
  });
});