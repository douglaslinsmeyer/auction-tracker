/**
 * WebSocketHandler Class Implementation
 * Wraps the existing singleton for class-based usage
 */

const IWebSocketHandler = require('../../interfaces/IWebSocketHandler');
const wsHandlerSingleton = require('../websocket');

class WebSocketHandlerClass extends IWebSocketHandler {
  constructor(auctionMonitor, logger) {
    super();
    // For now, delegate to singleton
    this._singleton = wsHandlerSingleton;
    
    // Store dependencies for future use
    this._auctionMonitor = auctionMonitor;
    this._logger = logger;
  }

  handleConnection(ws, wss) {
    return this._singleton.handleConnection(ws, wss);
  }

  handleMessage(clientId, message) {
    return this._singleton.handleMessage(clientId, message);
  }

  handleAuthentication(clientId, data, requestId) {
    return this._singleton.handleAuthentication(clientId, data, requestId);
  }

  handleDisconnection(clientId) {
    return this._singleton.handleDisconnection(clientId);
  }

  broadcastToSubscribers(auctionId, message) {
    return this._singleton.broadcastToSubscribers(auctionId, message);
  }

  broadcastToAll(message) {
    return this._singleton.broadcastToAll(message);
  }

  broadcastAuctionState(auctionId) {
    return this._singleton.broadcastAuctionState(auctionId);
  }

  sendError(clientId, error, requestId) {
    return this._singleton.sendError(clientId, error, requestId);
  }

  getClientCount() {
    return this._singleton.clients.size;
  }

  getAuthenticatedClientCount() {
    let count = 0;
    this._singleton.clients.forEach(client => {
      if (client.authenticated) count++;
    });
    return count;
  }

  isClientAuthenticated(clientId) {
    const client = this._singleton.clients.get(clientId);
    return client ? client.authenticated : false;
  }

  getClientSubscriptions(clientId) {
    const client = this._singleton.clients.get(clientId);
    return client ? client.subscriptions : new Set();
  }

  /**
   * Static factory method for backward compatibility
   * @returns {WebSocketHandlerClass} Instance wrapping the singleton
   */
  static getInstance() {
    return new WebSocketHandlerClass();
  }
}

module.exports = WebSocketHandlerClass;