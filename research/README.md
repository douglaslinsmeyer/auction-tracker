# Network Monitoring and Analysis Research

This folder contains experimental tools and scripts for analyzing the Nellis Auction website's network behavior, API patterns, and authentication mechanisms.

## Files

### nellis-network-monitor.js
A Node.js script that monitors and logs network requests made by the Nellis Auction website. This tool helps understand:
- API endpoints and their usage patterns
- Request/response formats
- Authentication flow
- WebSocket connections

**Usage:**
```bash
node nellis-network-monitor.js
```

### nellis-api-analyzer.js
An analysis tool that examines captured network data to identify:
- Common API patterns
- Request frequencies
- Data structures
- Authentication requirements

**Usage:**
```bash
node nellis-api-analyzer.js
```

### nellis-playwright-monitor.js
A Playwright-based browser automation tool that:
- Navigates the Nellis Auction website
- Captures real browser network traffic
- Logs authentication tokens and cookies
- Records API interactions during typical user flows

**Usage:**
```bash
node nellis-playwright-monitor.js
```

### install-chrome-deps.sh
A utility script that installs Chrome/Chromium dependencies required for Playwright on Linux systems. This is particularly useful for headless environments or Docker containers.

**Usage:**
```bash
chmod +x install-chrome-deps.sh
./install-chrome-deps.sh
```

## Purpose

These tools were created to:
1. Understand the Nellis Auction API structure and behavior
2. Analyze authentication mechanisms
3. Identify optimal polling strategies
4. Debug integration issues between the Chrome extension and backend service

## Note

These are research and development tools not intended for production use. They are used to gather information for improving the auction monitoring system's reliability and efficiency.