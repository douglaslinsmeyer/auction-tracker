const IdGenerator = require('../../src/utils/idGenerator');

describe('ID Generator', () => {
  describe('generate()', () => {
    it('should generate unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 1000; i++) {
        ids.add(IdGenerator.generate());
      }
      expect(ids.size).toBe(1000); // All IDs should be unique
    });

    it('should generate IDs with specified prefix', () => {
      const id = IdGenerator.generate('test');
      expect(id).toMatch(/^test_[0-9a-f]{32}$/);
    });

    it('should generate IDs with specified byte length', () => {
      const id = IdGenerator.generate('', 8);
      expect(id).toMatch(/^[0-9a-f]{16}$/); // 8 bytes = 16 hex chars
    });
  });

  describe('generateClientId()', () => {
    it('should generate client IDs with correct format', () => {
      const id = IdGenerator.generateClientId();
      expect(id).toMatch(/^client_\d{13}_[0-9a-f]{32}$/);
    });

    it('should include timestamp in client ID', () => {
      const before = Date.now();
      const id = IdGenerator.generateClientId();
      const after = Date.now();
      
      const timestamp = parseInt(id.split('_')[1]);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it('should generate unique client IDs even when called rapidly', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(IdGenerator.generateClientId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('generateSessionId()', () => {
    it('should generate 64-character hex session IDs', () => {
      const id = IdGenerator.generateSessionId();
      expect(id).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate cryptographically unique session IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 1000; i++) {
        ids.add(IdGenerator.generateSessionId());
      }
      expect(ids.size).toBe(1000);
    });
  });

  describe('generateToken()', () => {
    it('should generate URL-safe base64 tokens', () => {
      const token = IdGenerator.generateToken();
      // Should not contain +, /, or =
      expect(token).not.toMatch(/[+/=]/);
      // Should only contain URL-safe characters
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate tokens of specified length', () => {
      const token16 = IdGenerator.generateToken(16);
      const token32 = IdGenerator.generateToken(32);
      const token64 = IdGenerator.generateToken(64);
      
      // Base64 encoding increases length by ~4/3
      expect(token16.length).toBeGreaterThanOrEqual(21);
      expect(token32.length).toBeGreaterThanOrEqual(42);
      expect(token64.length).toBeGreaterThanOrEqual(85);
    });
  });

  describe('generateUUID()', () => {
    it('should generate valid UUID v4 format', () => {
      const uuid = IdGenerator.generateUUID();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuid).toMatch(uuidRegex);
    });

    it('should set correct version and variant bits', () => {
      const uuid = IdGenerator.generateUUID();
      const parts = uuid.split('-');
      
      // Version should be 4
      expect(parts[2][0]).toBe('4');
      
      // Variant should be 8, 9, a, or b
      expect(['8', '9', 'a', 'b']).toContain(parts[3][0]);
    });
  });

  describe('generateShortId()', () => {
    it('should generate alphanumeric IDs of specified length', () => {
      const id8 = IdGenerator.generateShortId(8);
      const id16 = IdGenerator.generateShortId(16);
      
      expect(id8).toMatch(/^[A-Za-z0-9]{8}$/);
      expect(id16).toMatch(/^[A-Za-z0-9]{16}$/);
    });

    it('should generate URL-safe IDs', () => {
      const id = IdGenerator.generateShortId(20);
      // Should only contain alphanumeric characters
      expect(id).toMatch(/^[A-Za-z0-9]+$/);
    });

    it.skip('should use uniform distribution of characters', () => {
      // Generate many IDs and check character distribution
      const charCounts = {};
      const iterations = 10000;
      
      for (let i = 0; i < iterations; i++) {
        const id = IdGenerator.generateShortId(1);
        charCounts[id] = (charCounts[id] || 0) + 1;
      }
      
      // Each character should appear roughly equally
      const counts = Object.values(charCounts);
      const avg = iterations / 62; // 62 possible characters
      const tolerance = avg * 0.4; // 40% tolerance for random variation
      
      counts.forEach(count => {
        expect(count).toBeGreaterThan(avg - tolerance);
        expect(count).toBeLessThan(avg + tolerance);
      });
    });
  });

  describe('generateRequestId()', () => {
    it('should generate request IDs with correct format', () => {
      const id = IdGenerator.generateRequestId();
      expect(id).toMatch(/^req_\d{13}_[0-9a-f]{16}$/);
    });

    it('should include timestamp in request ID', () => {
      const before = Date.now();
      const id = IdGenerator.generateRequestId();
      const after = Date.now();
      
      const timestamp = parseInt(id.split('_')[1]);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('Security', () => {
    it.skip('should not generate predictable sequences', () => {
      const ids = [];
      for (let i = 0; i < 10; i++) {
        ids.push(IdGenerator.generate());
      }
      
      // Check that IDs don't have predictable patterns
      for (let i = 1; i < ids.length; i++) {
        // IDs should be completely different
        let differences = 0;
        for (let j = 0; j < ids[i].length; j++) {
          if (ids[i][j] !== ids[i-1][j]) {
            differences++;
          }
        }
        // At least 90% of characters should be different
        expect(differences).toBeGreaterThan(ids[i].length * 0.9);
      }
    });

    it('should handle concurrent generation safely', async () => {
      const promises = [];
      const ids = new Set();
      
      // Generate 100 IDs concurrently
      for (let i = 0; i < 100; i++) {
        promises.push(
          new Promise(resolve => {
            const id = IdGenerator.generateClientId();
            ids.add(id);
            resolve();
          })
        );
      }
      
      await Promise.all(promises);
      expect(ids.size).toBe(100); // All IDs should be unique
    });
  });
});