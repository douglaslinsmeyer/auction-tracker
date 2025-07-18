module.exports = {
  launch: {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  },
  server: {
    // Use our custom test server script for reliable cross-platform startup
    command: 'node scripts/start-test-server.js',
    port: 3000,
    // Increase timeout to 60 seconds for slower systems
    launchTimeout: 60000,
    debug: true,
    // Kill the server if port is already in use
    usedPortAction: 'kill'
  }
};