const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
const winston = require('winston');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Conditionally load Swagger dependencies if available
let swaggerUi, YAML;
try {
  swaggerUi = require('swagger-ui-express');
  YAML = require('yamljs');
} catch (error) {
  console.log('Swagger dependencies not available, skipping Swagger UI setup');
}

const auctionMonitor = require('./services/auctionMonitor');
const nellisApi = require('./services/nellisApi');
const storage = require('./services/storage');
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

// Setup Swagger UI if available
if (swaggerUi && YAML) {
  const swaggerPath = path.join(__dirname, '..', 'swagger.yaml');
  if (fs.existsSync(swaggerPath)) {
    try {
      const swaggerDocument = YAML.load(swaggerPath);
      app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
        customSiteTitle: 'Nellis Auction Helper API',
        customfavIcon: '/favicon.ico',
        customCss: '.swagger-ui .topbar { display: none }',
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true,
          docExpansion: 'none',
          defaultModelsExpandDepth: -1
        }
      }));
      console.log('Swagger UI available at /api-docs');
    } catch (error) {
      console.error('Error loading Swagger documentation:', error.message);
    }
  } else {
    console.log('swagger.yaml not found, skipping Swagger UI setup');
  }
}

// Serve static files for the monitoring UI
app.use(express.static(path.join(__dirname, '..', 'public')));

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

// Initialize services and start server
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Initialize storage first
    await storage.initialize();
    
    // Initialize nellisApi to recover cookies
    await nellisApi.initialize();
    
    // Initialize auction monitor which will recover persisted auctions
    await auctionMonitor.initialize(wss);
    
    // Start listening
    server.listen(PORT, () => {
      logger.info(`Nellis Auction Backend running on port ${PORT}`);
      logger.info(`Redis connected: ${storage.connected}`);
      logger.info(`Monitored auctions: ${auctionMonitor.getMonitoredCount()}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    auctionMonitor.shutdown();
    await storage.close();
    process.exit(0);
  });
});

module.exports = { app, logger };