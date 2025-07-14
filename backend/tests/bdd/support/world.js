/**
 * Cucumber World
 * Provides shared context and utilities for BDD tests
 */

const { setWorldConstructor, setDefaultTimeout } = require('@cucumber/cucumber');
const axios = require('axios');
const WebSocket = require('ws');
const sinon = require('sinon');
const { expect } = require('chai');
const { app } = require('../../../src/index');
const { Server: WebSocketServer } = require('ws');
const auctionMonitor = require('../../../src/services/auctionMonitor');
const nellisApi = require('../../../src/services/nellisApi');
const wsHandler = require('../../../src/services/websocket');

// Set default timeout for all steps
setDefaultTimeout(30 * 1000); // 30 seconds

class CustomWorld {
  constructor() {
    // Server and connections
    this.server = null;
    this.serverPort = null;
    this.baseUrl = null;
    this.wsUrl = null;

    // WebSocket connections
    this.wsConnections = [];

    // Test data
    this.authToken = process.env.AUTH_TOKEN;
    this.lastResponse = null;
    this.lastError = null;
    this.monitoredAuctions = new Map();

    // Stubs and mocks
    this.stubs = {};
  }

  /**
   * Start the test server
   */
  async startServer() {
    // Storage is already initialized in BeforeAll hook

    // Initialize nellisApi to recover cookies
    await nellisApi.initialize();

    return new Promise((resolve) => {

      // Find available port
      this.server = app.listen(0, async () => {
        this.serverPort = this.server.address().port;
        this.baseUrl = `http://localhost:${this.serverPort}`;
        this.wsUrl = `ws://localhost:${this.serverPort}/ws`;

        // Create WebSocket server
        const wss = new WebSocketServer({ server: this.server, path: '/ws' });

        // Set up WebSocket connection handler
        wss.on('connection', (ws, _req) => {
          wsHandler.handleConnection(ws, wss);
        });

        // Initialize auction monitor with WebSocket handler's broadcast method
        await auctionMonitor.initialize(wss, (auctionId) => {
          wsHandler.broadcastAuctionState(auctionId);
        });

        resolve();
      });
    });
  }

  /**
   * Stop the test server
   */
  stopServer() {
    // Close all WebSocket connections
    for (const ws of this.wsConnections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
    this.wsConnections = [];

    // Close server
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(resolve);
      });
    }
    return Promise.resolve();
  }

  /**
   * Make an HTTP request to the API
   * @param {string} method - HTTP method
   * @param {string} path - API path
   * @param {Object} options - Request options
   */
  async makeRequest(method, path, options = {}) {
    try {
      const response = await axios({
        method,
        url: `${this.baseUrl}${path}`,
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json',
          ...options.headers
        },
        data: options.body,
        validateStatus: () => true // Don't throw on error status
      });

      this.lastResponse = response;
      this.lastError = null;
      return response;
    } catch (error) {
      this.lastError = error;
      this.lastResponse = error.response;
      throw error;
    }
  }

  /**
   * Create a WebSocket connection
   * @param {boolean} authenticate - Whether to authenticate after connecting
   */
  createWebSocketConnection(authenticate = true) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);

      ws.on('open', () => {
        this.wsConnections.push(ws);

        if (authenticate) {
          ws.send(JSON.stringify({
            type: 'authenticate',
            token: this.authToken
          }));

          // Wait for authentication response
          ws.once('message', (data) => {
            const message = JSON.parse(data);
            if (message.type === 'authenticated' && message.success) {
              resolve(ws);
            } else {
              reject(new Error('Authentication failed'));
            }
          });
        } else {
          resolve(ws);
        }
      });

      ws.on('error', reject);
    });
  }

  /**
   * Wait for a WebSocket message
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} messageType - Expected message type
   * @param {number} timeout - Timeout in milliseconds
   */
  waitForMessage(ws, messageType, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for message type: ${messageType}`));
      }, timeout);

      const handler = (data) => {
        const message = JSON.parse(data);
        if (message.type === messageType) {
          clearTimeout(timer);
          ws.removeListener('message', handler);
          resolve(message);
        }
      };

      ws.on('message', handler);
    });
  }

  /**
   * Stub a module method
   * @param {Object} module - Module to stub
   * @param {string} method - Method name
   * @param {Function} implementation - Stub implementation
   */
  stub(module, method, implementation) {
    const stub = sinon.stub(module, method);
    if (implementation) {
      stub.callsFake(implementation);
    }
    this.stubs[`${module.constructor.name}.${method}`] = stub;
    return stub;
  }

  /**
   * Restore all stubs
   */
  restoreStubs() {
    Object.values(this.stubs).forEach(stub => stub.restore());
    this.stubs = {};
  }

  /**
   * Get response data helper
   */
  getResponseData() {
    return this.lastResponse?.data;
  }

  /**
   * Get response status helper
   */
  getResponseStatus() {
    return this.lastResponse?.status;
  }

  /**
   * Assert response status
   * @param {number} expectedStatus
   */
  assertResponseStatus(expectedStatus) {
    expect(this.getResponseStatus()).to.equal(expectedStatus);
  }

  /**
   * Assert response contains
   * @param {Object} expected
   */
  assertResponseContains(expected) {
    const data = this.getResponseData();
    expect(data).to.deep.include(expected);
  }
}

setWorldConstructor(CustomWorld);

module.exports = CustomWorld;