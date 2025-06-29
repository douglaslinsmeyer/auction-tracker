const crypto = require('crypto');

class CryptoUtil {
  constructor() {
    // Get encryption key from environment or generate a warning
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16; // 128 bits
    this.tagLength = 16; // 128 bits
    this.saltLength = 32; // 256 bits
    
    // Initialize encryption key
    this.initializeKey();
  }

  initializeKey() {
    if (process.env.ENCRYPTION_KEY) {
      // Use provided key (must be 32 bytes hex string)
      const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
      if (key.length !== this.keyLength) {
        throw new Error(`ENCRYPTION_KEY must be ${this.keyLength * 2} hex characters (${this.keyLength} bytes)`);
      }
      this.encryptionKey = key;
    } else if (process.env.ENCRYPTION_SECRET) {
      // Derive key from secret using PBKDF2
      const salt = Buffer.from('nellis-auction-salt-v1', 'utf8'); // Fixed salt for key derivation
      this.encryptionKey = crypto.pbkdf2Sync(
        process.env.ENCRYPTION_SECRET,
        salt,
        100000, // iterations
        this.keyLength,
        'sha256'
      );
    } else {
      // Generate a random key for this session (not recommended for production)
      console.warn('WARNING: No ENCRYPTION_KEY or ENCRYPTION_SECRET provided. Using random key for this session only.');
      console.warn('Encrypted data will not be readable after restart. Set ENCRYPTION_SECRET in production.');
      this.encryptionKey = crypto.randomBytes(this.keyLength);
    }
  }

  /**
   * Encrypt a string
   * @param {string} text - Plain text to encrypt
   * @returns {string} - Base64 encoded encrypted data with format: iv:authTag:encrypted
   */
  encrypt(text) {
    try {
      // Generate random IV for each encryption
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
      
      // Encrypt the data
      const encrypted = Buffer.concat([
        cipher.update(text, 'utf8'),
        cipher.final()
      ]);
      
      // Get the authentication tag
      const authTag = cipher.getAuthTag();
      
      // Combine iv:authTag:encrypted and encode as base64
      const combined = Buffer.concat([iv, authTag, encrypted]);
      return combined.toString('base64');
    } catch (error) {
      console.error('Encryption error:', error.message);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt a string
   * @param {string} encryptedData - Base64 encoded encrypted data
   * @returns {string} - Decrypted plain text
   */
  decrypt(encryptedData) {
    try {
      // Decode from base64
      const combined = Buffer.from(encryptedData, 'base64');
      
      // Extract components
      const iv = combined.slice(0, this.ivLength);
      const authTag = combined.slice(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = combined.slice(this.ivLength + this.tagLength);
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);
      
      // Decrypt the data
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      console.error('Decryption error:', error.message);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash a password or sensitive string (one-way)
   * @param {string} text - Text to hash
   * @returns {string} - Hashed value
   */
  hash(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  /**
   * Generate a secure random token
   * @param {number} length - Length in bytes (default 32)
   * @returns {string} - Hex encoded random token
   */
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   * @param {string} a - First string
   * @param {string} b - Second string
   * @returns {boolean} - True if strings are equal
   */
  secureCompare(a, b) {
    if (a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}

module.exports = new CryptoUtil();