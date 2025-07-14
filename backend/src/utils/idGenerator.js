/**
 * Secure ID generation utility
 * Uses crypto.randomBytes for cryptographically secure random values
 */

const crypto = require('crypto');

class IdGenerator {
  /**
   * Generate a secure random ID
   * @param {string} prefix - Optional prefix for the ID
   * @param {number} byteLength - Number of random bytes (default: 16)
   * @returns {string} Secure random ID
   */
  static generate(prefix = '', byteLength = 16) {
    const randomBytes = crypto.randomBytes(byteLength);
    const randomId = randomBytes.toString('hex');

    if (prefix) {
      return `${prefix}_${randomId}`;
    }

    return randomId;
  }

  /**
   * Generate a secure client ID with timestamp
   * @returns {string} Client ID in format: client_timestamp_randomhex
   */
  static generateClientId() {
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(16);
    const randomId = randomBytes.toString('hex');
    return `client_${timestamp}_${randomId}`;
  }

  /**
   * Generate a secure session ID
   * @returns {string} Session ID (32 bytes hex)
   */
  static generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate a secure token
   * @param {number} length - Token length in bytes (default: 32)
   * @returns {string} Base64url encoded token
   */
  static generateToken(length = 32) {
    return crypto.randomBytes(length)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Generate a UUID v4 compatible ID
   * @returns {string} UUID v4 format
   */
  static generateUUID() {
    const bytes = crypto.randomBytes(16);

    // Set version (4) and variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = bytes.toString('hex');
    return [
      hex.substring(0, 8),
      hex.substring(8, 12),
      hex.substring(12, 16),
      hex.substring(16, 20),
      hex.substring(20, 32)
    ].join('-');
  }

  /**
   * Generate a short random ID (URL-safe)
   * @param {number} length - Desired length (default: 8)
   * @returns {string} URL-safe random ID
   */
  static generateShortId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = crypto.randomBytes(length);
    let result = '';

    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }

    return result;
  }

  /**
   * Generate a request ID for tracking
   * @returns {string} Request ID with timestamp
   */
  static generateRequestId() {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    return `req_${timestamp}_${random}`;
  }
}

module.exports = IdGenerator;