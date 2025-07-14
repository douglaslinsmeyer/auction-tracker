const WebSocket = require('ws');
const EventEmitter = require('events');

class WsTestClient extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.messages = [];
    this.connected = false;
  }

  connect(url) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        this.connected = true;
        this.emit('open');
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          this.messages.push(message);
          this.emit('message', message);

          // Emit specific event types (but not error to avoid unhandled errors)
          if (message.type && message.type !== 'error') {
            this.emit(message.type, message);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });

      this.ws.on('close', () => {
        this.connected = false;
        this.emit('close');
      });

      this.ws.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });

      // Timeout connection attempt
      setTimeout(() => {
        if (!this.connected && this.ws) {
          this.ws.close();
          reject(new Error('WebSocket connection timeout'));
        }
      }, 5000);
    });
  }

  send(data) {
    if (!this.connected) {
      throw new Error('WebSocket not connected');
    }

    const message = typeof data === 'string' ? data : JSON.stringify(data);
    this.ws.send(message);
  }

  waitForMessage(type, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for message type: ${type}`));
      }, timeout);

      // Check existing messages first
      const existing = this.messages.find(m => !type || m.type === type);
      if (existing) {
        clearTimeout(timer);
        resolve(existing);
        return;
      }

      const handler = (message) => {
        if (!type || message.type === type) {
          clearTimeout(timer);
          this.removeListener('message', handler);
          resolve(message);
        }
      };

      this.on('message', handler);
    });
  }

  clearMessages() {
    this.messages = [];
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.messages = [];
  }
}

module.exports = WsTestClient;