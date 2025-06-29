module.exports = {
  launch: {
    headless: process.env.HEADLESS !== 'false' ? 'new' : false,
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
    command: 'npm start',
    port: 3001,
    launchTimeout: 30000,
    debug: true
  }
};