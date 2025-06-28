const auctionMonitor = require('./auctionMonitor');

class WebSocketHandler {
  constructor() {
    this.clients = new Map();
  }

  handleConnection(ws, wss) {
    const clientId = this.generateClientId();
    
    // Store client info
    this.clients.set(clientId, {
      ws: ws,
      subscriptions: new Set(),
      authenticated: false
    });

    console.info(`WebSocket client connected: ${clientId}`);

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      clientId: clientId,
      message: 'Connected to Nellis Auction Backend'
    }));

    // Handle incoming messages
    ws.on('message', (message) => {
      this.handleMessage(clientId, message);
    });

    // Handle close
    ws.on('close', () => {
      this.handleDisconnection(clientId);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
    });

    // Send current monitored auctions
    this.sendMonitoredAuctions(clientId);
  }

  handleMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const data = JSON.parse(message);
      console.log(`Received message from client ${clientId}:`, data);
      
      // Store requestId to include in response
      const requestId = data.requestId;
      console.log(`RequestId for this message: ${requestId}`);
      
      switch (data.type) {
        case 'authenticate':
          console.log(`Calling handleAuthentication with requestId: ${requestId}`);
          this.handleAuthentication(clientId, data, requestId);
          break;
          
        case 'subscribe':
          this.handleSubscribe(clientId, data.auctionId);
          break;
          
        case 'unsubscribe':
          this.handleUnsubscribe(clientId, data.auctionId);
          break;
          
        case 'startMonitoring':
          this.handleStartMonitoring(clientId, data, requestId);
          break;
          
        case 'stopMonitoring':
          this.handleStopMonitoring(clientId, data.auctionId, requestId);
          break;
          
        case 'updateConfig':
          this.handleUpdateConfig(clientId, data);
          break;
          
        case 'placeBid':
          this.handlePlaceBid(clientId, data);
          break;
          
        case 'ping':
          console.log(`Received ping from client ${clientId}, sending pong`);
          client.ws.send(JSON.stringify({ type: 'pong' }));
          break;
          
        default:
          console.warn(`Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error(`Error handling message from client ${clientId}:`, error);
      client.ws.send(JSON.stringify({
        type: 'error',
        error: 'Invalid message format'
      }));
    }
  }

  handleAuthentication(clientId, data, requestId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Simple token-based auth for now
    // In production, implement proper JWT or OAuth
    const validToken = process.env.AUTH_TOKEN || 'dev-token';
    
    if (data.token === validToken) {
      client.authenticated = true;
      const response = {
        type: 'authenticated',
        success: true,
        requestId: requestId
      };
      console.log(`Sending auth response to client ${clientId}:`, response);
      client.ws.send(JSON.stringify(response));
      console.info(`Client ${clientId} authenticated successfully`);
    } else {
      client.ws.send(JSON.stringify({
        type: 'authenticated',
        success: false,
        error: 'Invalid authentication token',
        requestId: requestId
      }));
      console.warn(`Client ${clientId} failed authentication`);
    }
  }

  handleSubscribe(clientId, auctionId) {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) {
      this.sendError(clientId, 'Not authenticated');
      return;
    }

    client.subscriptions.add(auctionId);
    console.info(`Client ${clientId} subscribed to auction ${auctionId}`);
    
    // Send current auction data
    const auctions = auctionMonitor.getMonitoredAuctions();
    const auction = auctions.find(a => a.id === auctionId);
    
    if (auction) {
      client.ws.send(JSON.stringify({
        type: 'auctionUpdate',
        auctionId: auctionId,
        data: auction.data
      }));
    }
  }

  handleUnsubscribe(clientId, auctionId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.delete(auctionId);
    console.info(`Client ${clientId} unsubscribed from auction ${auctionId}`);
  }

  async handleStartMonitoring(clientId, data, requestId) {
    console.log(`Handling startMonitoring for client ${clientId}, requestId: ${requestId}`, data);
    
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) {
      console.log(`Client ${clientId} not authenticated`);
      this.sendError(clientId, 'Not authenticated', requestId);
      return;
    }

    const { auctionId, config, metadata } = data;
    console.log(`Adding auction ${auctionId} to monitor`);
    const success = auctionMonitor.addAuction(auctionId, config, metadata);
    console.log(`Auction ${auctionId} monitoring result: ${success}`);
    
    const response = {
      type: 'monitoringStarted',
      auctionId: auctionId,
      success: success,
      requestId: requestId
    };
    
    console.log(`Sending response to client ${clientId}:`, response);
    client.ws.send(JSON.stringify(response));

    if (success) {
      client.subscriptions.add(auctionId);
    }
  }

  handleStopMonitoring(clientId, auctionId, requestId) {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) {
      this.sendError(clientId, 'Not authenticated', requestId);
      return;
    }

    const success = auctionMonitor.removeAuction(auctionId);
    
    client.ws.send(JSON.stringify({
      type: 'monitoringStopped',
      auctionId: auctionId,
      success: success,
      requestId: requestId
    }));

    if (success) {
      client.subscriptions.delete(auctionId);
    }
  }

  handleUpdateConfig(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) {
      this.sendError(clientId, 'Not authenticated');
      return;
    }

    const { auctionId, config } = data;
    const auction = auctionMonitor.monitoredAuctions.get(auctionId);
    
    if (auction) {
      auction.config = { ...auction.config, ...config };
      client.ws.send(JSON.stringify({
        type: 'configUpdated',
        auctionId: auctionId,
        config: auction.config
      }));
    } else {
      this.sendError(clientId, 'Auction not found');
    }
  }

  async handlePlaceBid(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) {
      this.sendError(clientId, 'Not authenticated');
      return;
    }

    const { auctionId, amount } = data;
    const nellisApi = require('./nellisApi');
    
    try {
      const result = await nellisApi.placeBid(auctionId, amount);
      client.ws.send(JSON.stringify({
        type: 'bidResult',
        auctionId: auctionId,
        ...result
      }));
    } catch (error) {
      this.sendError(clientId, error.message);
    }
  }

  handleDisconnection(clientId) {
    this.clients.delete(clientId);
    console.info(`WebSocket client disconnected: ${clientId}`);
  }

  sendMonitoredAuctions(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const auctions = auctionMonitor.getMonitoredAuctions();
    client.ws.send(JSON.stringify({
      type: 'monitoredAuctions',
      auctions: auctions
    }));
  }

  sendError(clientId, error, requestId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.ws.send(JSON.stringify({
        type: 'error',
        error: error,
        requestId: requestId
      }));
    }
  }

  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Broadcast to subscribed clients
  broadcastToSubscribers(auctionId, message) {
    this.clients.forEach((client, clientId) => {
      if (client.subscriptions.has(auctionId) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  // Broadcast to all authenticated clients
  broadcastToAll(message) {
    this.clients.forEach((client, clientId) => {
      if (client.authenticated && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }
}

module.exports = new WebSocketHandler();