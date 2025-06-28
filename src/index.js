const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
const winston = require('winston');
require('dotenv').config();

const auctionMonitor = require('./services/auctionMonitor');
const apiRoutes = require('./routes/api');
const wsHandler = require('./services/websocket');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Create Express app
const app = express();
const server = http.createServer(app);

// Configure WebSocket server
const wss = new WebSocket.Server({ server });

// Configure CORS to allow Chrome extensions
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow any chrome extension
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }
    
    // Allow localhost for development
    if (origin.match(/^http:\/\/localhost:\d+$/)) {
      return callback(null, true);
    }
    
    // Reject everything else
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    uptime: process.uptime(),
    monitoredAuctions: auctionMonitor.getMonitoredCount()
  });
});

// API routes
app.use('/api', apiRoutes);

// WebSocket connection handling
wss.on('connection', (ws) => {
  wsHandler.handleConnection(ws, wss);
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Nellis Auction Backend running on port ${PORT}`);
  
  // Start auction monitoring service
  auctionMonitor.initialize(wss);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    auctionMonitor.shutdown();
    process.exit(0);
  });
});

module.exports = { app, logger };