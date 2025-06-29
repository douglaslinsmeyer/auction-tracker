#!/usr/bin/env node
/**
 * Cross-platform test runner with environment variables
 */

const { spawn } = require('child_process');
const path = require('path');

// Set environment variables
process.env.ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || 'test-secret-key-for-unit-tests';
process.env.NODE_ENV = 'test';
process.env.AUTH_TOKEN = process.env.AUTH_TOKEN || 'test-auth-token';

// Get command and args from command line
const [,, command, ...args] = process.argv;

if (!command) {
  console.error('Usage: node scripts/test-with-env.js <command> [args...]');
  process.exit(1);
}

// Spawn the command
const child = spawn(command, args, {
  stdio: 'inherit',
  shell: true,
  env: process.env
});

// Exit with same code as child process
child.on('exit', (code) => {
  process.exit(code);
});