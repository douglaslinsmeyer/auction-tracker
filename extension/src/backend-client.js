/**
 * Backend Client for Nellis Auction Helper
 * Handles communication with the backend service
 */
class BackendClient {
  constructor() {
    this.baseUrl = null;
    this.authToken = null;
    this.ws = null;
    this.wsReconnectTimer = null;
    this.wsReconnectDelay = CONFIG.WEBSOCKET.RECONNECT_DELAY;
    this.isConnected = false;
    this.messageHandlers = new Map();
    this.pendingRequests = new Map();
    this.requestIdCounter = 0;
    this.pingInterval = null;
    this.pingIntervalDelay = CONFIG.WEBSOCKET.PING_INTERVAL;
  }

  async initialize() {
    // Load backend configuration
    const { backend, backendUrl } = await chrome.storage.local.get(['backend', 'backendUrl']);
    
    // Use backendUrl from settings, fallback to backend.url, then default
    this.baseUrl = backendUrl || backend?.url || CONFIG.BACKEND.DEFAULT_URL;
    this.authToken = backend?.token || CONFIG.BACKEND.DEFAULT_TOKEN;
    
    console.log('Initializing backend client:', {
      baseUrl: this.baseUrl,
      authToken: this.authToken
    });
    
    // Always connect to backend
    await this.connect();
  }

  async connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const wsUrl = this.baseUrl.replace(/^http/, 'ws');
      console.log('Connecting to WebSocket:', wsUrl);
      
      this.ws = new WebSocket(wsUrl);
      console.log('WebSocket object created, readyState:', this.ws.readyState);
      
      // Add a connection timeout
      const connectionTimeout = setTimeout(() => {
        console.error('WebSocket connection timeout after 10 seconds');
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close();
        }
      }, 10000);
      
      this.ws.onopen = async () => {
        console.log('Connected to backend WebSocket');
        clearTimeout(connectionTimeout);
        this.isConnected = true;
        clearTimeout(this.wsReconnectTimer);
        
        // Start ping interval to keep connection alive
        this.startPingInterval();
        
        // Authenticate
        await this.authenticate();
        
        // Notify listeners
        this.emit('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('Disconnected from backend WebSocket:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        clearTimeout(connectionTimeout);
        this.isConnected = false;
        this.stopPingInterval();
        this.emit('disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', {
          type: error.type,
          target: error.target?.url,
          readyState: this.ws?.readyState,
          message: 'WebSocket connection failed',
          error: error
        });
        clearTimeout(connectionTimeout);
        this.emit('error', error);
      };
    } catch (error) {
      console.error('Failed to connect to backend:', error);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.wsReconnectTimer) {
      return;
    }
    
    this.wsReconnectTimer = setTimeout(() => {
      this.wsReconnectTimer = null;
      this.connect();
    }, this.wsReconnectDelay);
  }

  async disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    
    this.stopPingInterval();
    this.isConnected = false;
  }

  startPingInterval() {
    this.stopPingInterval(); // Clear any existing interval
    
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        console.log('Sending ping to keep connection alive');
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, this.pingIntervalDelay);
  }

  stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  async authenticate() {
    return this.sendMessage({
      type: 'authenticate',
      token: this.authToken
    });
  }

  handleMessage(message) {
    console.log('Received WebSocket message:', message);
    
    // Handle response to a request
    if (message.requestId && this.pendingRequests.has(message.requestId)) {
      console.log('Handling response for requestId:', message.requestId);
      const { resolve, reject } = this.pendingRequests.get(message.requestId);
      this.pendingRequests.delete(message.requestId);
      
      if (message.error) {
        reject(new Error(message.error));
      } else {
        resolve(message);
      }
      return;
    }
    
    if (message.requestId) {
      console.warn('Received response for unknown requestId:', message.requestId);
    }

    // Handle broadcast messages
    switch (message.type) {
      case 'authenticated':
        console.log('Backend authentication:', message.success ? 'successful' : 'failed');
        break;
        
      case 'pong':
        console.log('Received pong from server - connection alive');
        break;
        
      case 'auctionUpdate':
        this.emit('auctionUpdate', message);
        break;
        
      case 'notification':
        this.emit('notification', message);
        break;
        
      case 'monitoredAuctions':
        this.emit('monitoredAuctions', message.auctions);
        break;
        
      default:
        // Emit for custom handlers
        this.emit(message.type, message);
    }
  }

  sendMessage(message) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const requestId = `req_${++this.requestIdCounter}`;
      message.requestId = requestId;
      
      console.log('Sending WebSocket message:', message);
      this.pendingRequests.set(requestId, { resolve, reject });
      
      // Set timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          console.error('Request timeout for message:', message);
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 30000);
      
      this.ws.send(JSON.stringify(message));
    });
  }

  // Event emitter functionality
  on(event, handler) {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, new Set());
    }
    this.messageHandlers.get(event).add(handler);
  }

  off(event, handler) {
    if (this.messageHandlers.has(event)) {
      this.messageHandlers.get(event).delete(handler);
    }
  }

  emit(event, data) {
    if (this.messageHandlers.has(event)) {
      this.messageHandlers.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  // API Methods
  async startMonitoring(auctionId, config = {}, metadata = {}) {
    console.log('Starting monitoring via WebSocket:', auctionId, config, metadata);
    
    if (!this.isConnected) {
      throw new Error('WebSocket not connected');
    }
    
    return this.sendMessage({
      type: 'startMonitoring',
      auctionId,
      config,
      metadata
    });
  }

  async stopMonitoring(auctionId) {
    console.log('Stopping monitoring via WebSocket:', auctionId);
    
    if (!this.isConnected) {
      throw new Error('WebSocket not connected');
    }
    
    return this.sendMessage({
      type: 'stopMonitoring',
      auctionId
    });
  }

  async updateConfig(auctionId, config) {
    if (this.isConnected) {
      return this.sendMessage({
        type: 'updateConfig',
        auctionId,
        config
      });
    } else {
      const response = await fetch(`${this.baseUrl}${CONFIG.buildApiUrl(CONFIG.API.AUCTION_CONFIG, {id: auctionId})}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          config,
          token: this.authToken 
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update config: ${response.statusText}`);
      }
      
      return response.json();
    }
  }

  async placeBid(auctionId, amount) {
    if (this.isConnected) {
      return this.sendMessage({
        type: 'placeBid',
        auctionId,
        amount
      });
    } else {
      const response = await fetch(`${this.baseUrl}${CONFIG.buildApiUrl(CONFIG.API.AUCTION_BID, {id: auctionId})}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          amount,
          token: this.authToken 
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to place bid: ${response.statusText}`);
      }
      
      return response.json();
    }
  }

  async getMonitoredAuctions() {
    const response = await fetch(`${this.baseUrl}${CONFIG.API.AUCTIONS}?token=${encodeURIComponent(this.authToken)}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get auctions: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getBackendStatus() {
    // Check both isConnected flag and WebSocket readyState
    const wsConnected = this.ws && this.ws.readyState === WebSocket.OPEN;
    const actuallyConnected = this.isConnected && wsConnected;
    
    console.log('Backend status check:', {
      isConnected: this.isConnected,
      wsState: this.ws?.readyState,
      wsConnected: wsConnected,
      actuallyConnected: actuallyConnected,
      baseUrl: this.baseUrl
    });
    
    return {
      connected: actuallyConnected,
      url: this.baseUrl
    };
  }

  async syncCookies() {
    try {
      // Check if we have cookies permission
      if (!chrome.cookies) {
        console.warn('Cookies API not available - skipping cookie sync');
        return { success: false, error: 'Cookies permission not granted' };
      }
      
      // Get cookies from Chrome
      const cookies = await chrome.cookies.getAll({ domain: '.nellisauction.com' });
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      
      console.log('Syncing cookies to backend:', {
        baseUrl: this.baseUrl,
        cookiesFound: cookies.length,
        cookieString: cookieString ? 'Found cookies' : 'No cookies found',
        authToken: this.authToken
      });
      
      const requestBody = { 
        cookies: cookieString,
        token: this.authToken 
      };
      
      console.log('Request body:', requestBody);
      
      // Send to backend
      const response = await fetch(`${this.baseUrl}${CONFIG.API.AUTH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Cookie sync failed:', response.status, errorData);
        throw new Error(`Failed to sync cookies: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('Error syncing cookies:', error);
      return { success: false, error: error.message };
    }
  }
}

// Make it available to service worker
if (typeof globalThis !== 'undefined') {
  globalThis.BackendClient = BackendClient;
}