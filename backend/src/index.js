const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const logger = require('./utils/logger');
const metrics = require('./utils/metrics');
const { createSigningMiddleware, addSignatureInfo } = require('./middleware/requestSigning');

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


// Create Express app
const app = express();
const server = http.createServer(app);

// Configure WebSocket server with security limits
const wss = new WebSocket.Server({ 
  server,
  maxPayload: parseInt(process.env.WS_MAX_PAYLOAD_SIZE) || 1024 * 1024, // 1MB default
  clientTracking: true,
  perMessageDeflate: false // Disable compression to prevent zip bombs
});

// Configure CORS to allow Chrome extensions
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow specific Chrome extensions from whitelist
    if (origin.startsWith('chrome-extension://')) {
      // Get allowed extension IDs from environment
      const allowedExtensions = process.env.ALLOWED_EXTENSION_IDS?.split(',') || [];
      const extensionId = origin.replace('chrome-extension://', '');
      
      if (allowedExtensions.length > 0 && !allowedExtensions.includes(extensionId)) {
        logger.warn(`Blocked unauthorized Chrome extension: ${extensionId}`);
        return callback(new Error('Chrome extension not authorized'));
      }
      
      return callback(null, true);
    }
    
    // Allow localhost for development (only in development mode)
    if (process.env.NODE_ENV === 'development' && origin.match(/^http:\/\/localhost:\d+$/)) {
      return callback(null, true);
    }
    
    // Allow specific origins from environment variable (including dashboard)
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Reject everything else
    logger.warn(`CORS blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// Security headers with helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for compatibility
}));

// Additional security headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure rate limiting
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS) || 60 * 1000, // 1 minute window
  max: parseInt(process.env.API_RATE_LIMIT_MAX) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Too many requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    });
  }
});

// Apply rate limiting to API routes
app.use('/api', apiLimiter);

// More restrictive rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5, // limit each IP to 5 auth requests per windowMs
  message: 'Too many authentication attempts from this IP, please try again later.',
  skipSuccessfulRequests: true // Don't count successful auth requests
});

// Apply stricter rate limiting to auth endpoints
app.use('/api/auth', authLimiter);

// Add request signing middleware
app.use(createSigningMiddleware());

// Add signature info to responses
app.use(addSignatureInfo);

// Setup Swagger UI if available
if (swaggerUi && YAML) {
  const swaggerPath = path.join(__dirname, '..', '..', 'swagger.yaml');
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

// Note: UI is now served separately - backend is API only

// Health check endpoint
app.get('/health', (req, res) => {
  const memoryStats = auctionMonitor.getMemoryStats();
  res.json({ 
    status: 'healthy', 
    uptime: process.uptime(),
    monitoredAuctions: auctionMonitor.getMonitoredCount(),
    memoryStats: memoryStats,
    memoryUsage: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB'
    }
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  try {
    const allMetrics = metrics.getAllMetrics();
    const sseMetrics = metrics.getSSEMetrics();
    
    res.json({
      all: allMetrics,
      sse: sseMetrics,
      application: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        auctions: {
          monitored: auctionMonitor.getMonitoredCount(),
          memoryStats: auctionMonitor.getMemoryStats()
        }
      }
    });
  } catch (error) {
    logger.error('Error retrieving metrics', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
});

// SSE-specific metrics endpoint
app.get('/metrics/sse', (req, res) => {
  try {
    const sseMetrics = metrics.getSSEMetrics();
    res.json(sseMetrics);
  } catch (error) {
    logger.error('Error retrieving SSE metrics', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve SSE metrics' });
  }
});

// API routes
app.use('/api', apiRoutes);

// Error handling middleware (must be after all routes)
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
app.use(notFoundHandler);
app.use(errorHandler);

// WebSocket connection handling with rate limiting
const wsConnectionCounts = new Map();
const WS_RATE_LIMIT_WINDOW = parseInt(process.env.WS_RATE_LIMIT_WINDOW_MS) || 60 * 1000; // 1 minute
const WS_MAX_CONNECTIONS_PER_IP = parseInt(process.env.WS_MAX_CONNECTIONS_PER_IP) || 10; // Max 10 connections per IP per minute

// Clean up old connection counts periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of wsConnectionCounts.entries()) {
    if (now - data.resetTime > WS_RATE_LIMIT_WINDOW) {
      wsConnectionCounts.delete(key);
    }
  }
}, WS_RATE_LIMIT_WINDOW);

wss.on('connection', (ws, req) => {
  // Extract IP address
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  // Check rate limit for WebSocket connections
  const now = Date.now();
  const ipData = wsConnectionCounts.get(ip) || { count: 0, resetTime: now };
  
  if (now - ipData.resetTime > WS_RATE_LIMIT_WINDOW) {
    // Reset window
    ipData.count = 1;
    ipData.resetTime = now;
  } else {
    ipData.count++;
  }
  
  wsConnectionCounts.set(ip, ipData);
  
  if (ipData.count > WS_MAX_CONNECTIONS_PER_IP) {
    logger.warn(`WebSocket rate limit exceeded for IP: ${ip}`);
    ws.close(1008, 'Too many connections');
    return;
  }
  
  wsHandler.handleConnection(ws, wss);
});

// Initialize services and start server
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Validate required environment variables
    if (!process.env.AUTH_TOKEN) {
      throw new Error('AUTH_TOKEN environment variable is required. Please set it in your .env file or environment.');
    }
    // Initialize feature flags
    const featureFlags = require('./config/features');
    await featureFlags.initialize(storage.redis);
    
    // Initialize global metrics for monitoring
    global.metrics = metrics;
    logger.info('Metrics system initialized');
    
    // Initialize storage first
    await storage.initialize();
    
    // Initialize nellisApi to recover cookies
    await nellisApi.initialize();
    
    // Initialize auction monitor with WebSocket handler's broadcast method
    await auctionMonitor.initialize(wss, (auctionId) => {
      wsHandler.broadcastAuctionState(auctionId);
    });
    
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

// Only start server if this file is run directly
if (require.main === module) {
  startServer();
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    auctionMonitor.shutdown();
    await storage.close();
    process.exit(0);
  });
});

module.exports = { app, server, logger, startServer };