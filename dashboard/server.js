const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all origins in development
if (process.env.NODE_ENV === 'development') {
  app.use(cors());
} else {
  // In production, be more restrictive
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || []
  }));
}

// Serve static files from src directory
app.use(express.static(path.join(__dirname, 'src')));

// API endpoint for configuration (optional - can be used to pass backend URL to frontend)
app.get('/api/config', (req, res) => {
  res.json({
    backendUrl: process.env.BACKEND_URL || 'http://localhost:3000',
    wsUrl: process.env.WS_URL || 'ws://localhost:3000'
  });
});

// Catch all routes and serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Dashboard server running on http://localhost:${PORT}`);
  console.log(`Backend URL: ${process.env.BACKEND_URL || 'http://localhost:3000'}`);
});