/**
 * Client-side request signing utility
 * This file can be used by the Chrome extension to sign API requests
 */

class RequestSigner {
  constructor(secret) {
    if (!secret) {
      throw new Error('API signing secret is required');
    }
    this.secret = secret;
  }

  /**
   * Generate HMAC-SHA256 signature for a request
   * @param {string} method - HTTP method
   * @param {string} path - Request path
   * @param {number} timestamp - Unix timestamp in milliseconds
   * @param {string} body - Request body (JSON string)
   * @returns {Promise<string>} Base64 encoded signature
   */
  async generateSignature(method, path, timestamp, body = '') {
    // Create canonical request string
    const bodyHash = body ? await this.sha256(body) : '';
    const canonicalRequest = [
      method.toUpperCase(),
      path,
      timestamp,
      bodyHash
    ].join('\n');

    // Generate HMAC signature
    const signature = await this.hmacSha256(canonicalRequest, this.secret);
    return this.arrayBufferToBase64(signature);
  }

  /**
   * Sign a fetch request
   * @param {string} url - Request URL
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Modified options with signature headers
   */
  async signRequest(url, options = {}) {
    const urlObj = new URL(url);
    const method = options.method || 'GET';
    const body = options.body || '';
    const timestamp = Date.now();

    const signature = await this.generateSignature(
      method,
      urlObj.pathname + urlObj.search,
      timestamp,
      body
    );

    return {
      ...options,
      headers: {
        ...options.headers,
        'X-Signature': signature,
        'X-Timestamp': timestamp.toString()
      }
    };
  }

  /**
   * SHA-256 hash
   * @param {string} message - Message to hash
   * @returns {Promise<string>} Hex encoded hash
   */
  async sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return this.arrayBufferToHex(hashBuffer);
  }

  /**
   * HMAC-SHA256
   * @param {string} message - Message to sign
   * @param {string} secret - Secret key
   * @returns {Promise<ArrayBuffer>} HMAC signature
   */
  async hmacSha256(message, secret) {
    const enc = new TextEncoder();
    const keyData = enc.encode(secret);
    
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const messageData = enc.encode(message);
    return await crypto.subtle.sign('HMAC', key, messageData);
  }

  /**
   * Convert ArrayBuffer to base64
   * @param {ArrayBuffer} buffer
   * @returns {string} Base64 encoded string
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert ArrayBuffer to hex
   * @param {ArrayBuffer} buffer
   * @returns {string} Hex encoded string
   */
  arrayBufferToHex(buffer) {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

// Example usage:
/*
const signer = new RequestSigner('your-api-secret');

// Sign a GET request
const signedOptions = await signer.signRequest(
  'https://api.example.com/auction/123',
  { method: 'GET' }
);
const response = await fetch('https://api.example.com/auction/123', signedOptions);

// Sign a POST request with body
const body = JSON.stringify({ bid: 100 });
const signedPostOptions = await signer.signRequest(
  'https://api.example.com/auction/123/bid',
  {
    method: 'POST',
    body: body,
    headers: {
      'Content-Type': 'application/json'
    }
  }
);
const postResponse = await fetch('https://api.example.com/auction/123/bid', signedPostOptions);
*/

// Export for use in Chrome extension or browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RequestSigner;
}