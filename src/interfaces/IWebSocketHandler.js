/**
 * Interface for WebSocket Handler Service
 * Defines the contract for WebSocket communication
 */

class IWebSocketHandler {
  /**
   * Handle new WebSocket connection
   * @param {WebSocket} ws - WebSocket instance
   * @param {WebSocketServer} wss - WebSocket server instance
   */
  handleConnection(ws, wss) {
    throw new Error('Method handleConnection() must be implemented');
  }

  /**
   * Handle incoming WebSocket message
   * @param {string} clientId - Client identifier
   * @param {string|Buffer} message - Message data
   */
  handleMessage(clientId, message) {
    throw new Error('Method handleMessage() must be implemented');
  }

  /**
   * Handle client authentication
   * @param {string} clientId - Client identifier
   * @param {Object} data - Authentication data
   * @param {string} requestId - Request identifier
   */
  handleAuthentication(clientId, data, requestId) {
    throw new Error('Method handleAuthentication() must be implemented');
  }

  /**
   * Handle client disconnection
   * @param {string} clientId - Client identifier
   */
  handleDisconnection(clientId) {
    throw new Error('Method handleDisconnection() must be implemented');
  }

  /**
   * Broadcast message to subscribers of an auction
   * @param {string} auctionId - The auction ID
   * @param {Object} message - Message to broadcast
   */
  broadcastToSubscribers(auctionId, message) {
    throw new Error('Method broadcastToSubscribers() must be implemented');
  }

  /**
   * Broadcast message to all authenticated clients
   * @param {Object} message - Message to broadcast
   */
  broadcastToAll(message) {
    throw new Error('Method broadcastToAll() must be implemented');
  }

  /**
   * Broadcast auction state update
   * @param {string} auctionId - The auction ID
   */
  broadcastAuctionState(auctionId) {
    throw new Error('Method broadcastAuctionState() must be implemented');
  }

  /**
   * Send error message to client
   * @param {string} clientId - Client identifier
   * @param {string} error - Error message
   * @param {string} requestId - Request identifier
   */
  sendError(clientId, error, requestId) {
    throw new Error('Method sendError() must be implemented');
  }

  /**
   * Get connected client count
   * @returns {number} Number of connected clients
   */
  getClientCount() {
    throw new Error('Method getClientCount() must be implemented');
  }

  /**
   * Get authenticated client count
   * @returns {number} Number of authenticated clients
   */
  getAuthenticatedClientCount() {
    throw new Error('Method getAuthenticatedClientCount() must be implemented');
  }

  /**
   * Check if client is authenticated
   * @param {string} clientId - Client identifier
   * @returns {boolean} True if authenticated
   */
  isClientAuthenticated(clientId) {
    throw new Error('Method isClientAuthenticated() must be implemented');
  }

  /**
   * Get client subscriptions
   * @param {string} clientId - Client identifier
   * @returns {Set<string>} Set of auction IDs
   */
  getClientSubscriptions(clientId) {
    throw new Error('Method getClientSubscriptions() must be implemented');
  }
}

module.exports = IWebSocketHandler;