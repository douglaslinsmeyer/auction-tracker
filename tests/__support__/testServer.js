const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');

class TestServer {
  constructor() {
    this.app = null;
    this.server = null;
    this.wss = null;
    this.port = null;
  }

  async start(port = 0) {
    // Create Express app
    this.app = express();
    this.app.use(cors());
    this.app.use(express.json());
    
    // Create HTTP server
    this.server = http.createServer(this.app);
    
    // Create WebSocket server
    this.wss = new WebSocket.Server({ server: this.server });
    
    // Start server
    return new Promise((resolve) => {
      this.server.listen(port, () => {
        this.port = this.server.address().port;
        console.log(`Test server started on port ${this.port}`);
        resolve(this.port);
      });
    });
  }

  async stop() {
    if (this.wss) {
      // Close all WebSocket connections
      this.wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.close();
        }
      });
      this.wss.close();
    }

    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log('Test server stopped');
          resolve();
        });
      });
    }
  }

  getApp() {
    return this.app;
  }

  getWss() {
    return this.wss;
  }

  getUrl() {
    return `http://localhost:${this.port}`;
  }

  getWsUrl() {
    return `ws://localhost:${this.port}`;
  }
}

module.exports = TestServer;