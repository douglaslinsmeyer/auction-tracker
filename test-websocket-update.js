const WebSocket = require('ws');
require('dotenv').config();

// Ensure AUTH_TOKEN is set
if (!process.env.AUTH_TOKEN) {
  console.error('Error: AUTH_TOKEN environment variable is required');
  console.error('Set it in your .env file or run with: AUTH_TOKEN=your-token node test-websocket-update.js');
  process.exit(1);
}

// Connect to WebSocket server
const ws = new WebSocket('ws://localhost:3000/ws');

ws.on('open', () => {
  console.log('Connected to WebSocket server');
  
  // Authenticate
  ws.send(JSON.stringify({
    type: 'authenticate',
    token: process.env.AUTH_TOKEN
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', message.type);
  
  if (message.type === 'authenticated') {
    console.log('Authenticated successfully');
    
    // Simulate updating config after 2 seconds
    setTimeout(() => {
      console.log('Sending config update...');
      ws.send(JSON.stringify({
        type: 'updateConfig',
        auctionId: 'test-auction-id', // Replace with actual auction ID
        config: {
          strategy: 'sniping',
          maxBid: 150
        },
        requestId: 'test-req-1'
      }));
    }, 2000);
  } else if (message.type === 'auctionState') {
    console.log('Received auction state update:', {
      auctionId: message.auction.id,
      config: message.auction.config
    });
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.on('close', () => {
  console.log('Disconnected from WebSocket server');
});