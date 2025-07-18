#!/usr/bin/env node

/**
 * Cross-platform test server startup script for E2E tests
 * Ensures server starts properly with test configuration
 */

const { spawn } = require('child_process');
const http = require('http');

// Set test environment variables
process.env.AUTH_TOKEN = 'test-auth-token';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';  // Reduce noise during tests
process.env.ENABLE_TEST_LOGS = 'false';

// Function to check if server is ready
function checkServerReady(port, retries = 60) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const check = () => {
      attempts++;
      
      const req = http.get(`http://localhost:${port}/health`, (res) => {
        if (res.statusCode === 200) {
          console.log('Test server is ready');
          resolve();
        } else {
          retry();
        }
      });
      
      req.on('error', () => {
        retry();
      });
      
      req.setTimeout(1000);
    };
    
    const retry = () => {
      if (attempts >= retries) {
        reject(new Error(`Server failed to start after ${retries} attempts`));
      } else {
        setTimeout(check, 1000);
      }
    };
    
    check();
  });
}

// Start the server
console.log('Starting test server...');
const serverProcess = spawn('npm', ['start'], {
  stdio: 'inherit',
  shell: true,
  env: process.env
});

// Wait for server to be ready
checkServerReady(3000)
  .then(() => {
    console.log('Test server started successfully');
    // Keep the process running
    process.on('SIGINT', () => {
      console.log('Shutting down test server...');
      serverProcess.kill();
      process.exit(0);
    });
  })
  .catch((error) => {
    console.error('Failed to start test server:', error);
    serverProcess.kill();
    process.exit(1);
  });