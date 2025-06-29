# Phase 5: Chrome Extension Integration Testing Plan

## Overview

While we have backend integration tests that validate Chrome extension compatibility, we need comprehensive end-to-end tests that validate the complete system with the actual Chrome extension.

## Current State

### ✅ What We Have
1. **Backend Integration Tests** (`/tests/integration/chromeExtensionCompatibility.test.js`)
   - Tests singleton service patterns
   - Validates API compatibility
   - Tests WebSocket patterns
   
2. **E2E Test Infrastructure** 
   - Puppeteer setup configured
   - Jest configuration ready (`jest.config.puppeteer.js`)
   - E2E test directory structure

3. **BDD Scenarios**
   - Chrome extension scenarios in integration flows
   - WebSocket communication tests
   - API contract validation

### ❌ What We Need
1. Actual Chrome extension loading in Puppeteer
2. Extension popup interaction tests
3. Content script injection tests
4. Full user journey tests

## Implementation Plan

### Phase 5.1: Extension E2E Test Setup

#### 1. Configure Puppeteer for Extension Testing
```javascript
// tests/e2e/helpers/extensionLoader.js
const puppeteer = require('puppeteer');
const path = require('path');

async function launchBrowserWithExtension() {
  const pathToExtension = path.join(__dirname, '../../../nellis-auction-helper');
  
  const browser = await puppeteer.launch({
    headless: false, // Extensions require headful mode
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--no-sandbox'
    ]
  });
  
  return browser;
}
```

#### 2. Extension Helper Utilities
```javascript
// tests/e2e/helpers/extensionHelpers.js
async function getExtensionId(browser) {
  // Get extension ID from chrome://extensions
}

async function openExtensionPopup(browser, extensionId) {
  // Open extension popup in new tab
}

async function waitForServiceWorker(browser) {
  // Ensure service worker is initialized
}
```

### Phase 5.2: Core Test Scenarios

#### 1. Extension Installation & Setup
```javascript
// tests/e2e/extension/installation.test.js
describe('Chrome Extension Installation', () => {
  test('Extension loads successfully', async () => {
    // Verify extension appears in browser
    // Check service worker status
    // Verify popup opens
  });
  
  test('First-time setup flow', async () => {
    // Open popup
    // Enter auth token
    // Verify connection to backend
    // Check WebSocket establishment
  });
});
```

#### 2. Authentication Flow
```javascript
// tests/e2e/extension/authentication.test.js
describe('Extension Authentication', () => {
  test('Login through extension popup', async () => {
    // Enter credentials in popup
    // Verify backend authentication
    // Check session persistence
    // Verify cookie sync
  });
  
  test('Session persistence across browser restart', async () => {
    // Login
    // Close browser
    // Reopen with extension
    // Verify still authenticated
  });
});
```

#### 3. Auction Monitoring E2E
```javascript
// tests/e2e/extension/monitoring.test.js
describe('Auction Monitoring via Extension', () => {
  test('Start monitoring from Nellis page', async () => {
    // Navigate to Nellis auction page
    // Verify content script injection
    // Click extension monitor button
    // Set parameters in popup
    // Verify backend receives request
    // Check real-time updates
  });
  
  test('Monitor multiple auctions', async () => {
    // Add multiple auctions
    // Verify dashboard updates
    // Check WebSocket messages
    // Verify state synchronization
  });
});
```

#### 4. Bidding Strategies E2E
```javascript
// tests/e2e/extension/bidding.test.js
describe('Bidding Through Extension', () => {
  test('Manual bid placement', async () => {
    // Monitor auction
    // Place bid through popup
    // Verify bid on Nellis
    // Check backend state
  });
  
  test('Aggressive strategy activation', async () => {
    // Set aggressive strategy
    // Simulate being outbid
    // Verify automatic bid
    // Check notifications
  });
});
```

#### 5. Real-time Updates
```javascript
// tests/e2e/extension/realtime.test.js
describe('Real-time Communication', () => {
  test('WebSocket updates reflect in popup', async () => {
    // Open popup
    // Trigger backend update
    // Verify popup updates
    // Check update latency
  });
  
  test('Multiple device synchronization', async () => {
    // Open extension in two browsers
    // Make change in one
    // Verify sync in other
  });
});
```

### Phase 5.3: Performance & Reliability Tests

#### 1. Load Testing
- Multiple auctions monitoring simultaneously
- WebSocket connection stability
- Memory usage over time
- Service worker lifecycle

#### 2. Error Recovery
- Backend disconnection handling
- Network failure recovery
- Session expiration handling
- Graceful degradation

### Phase 5.4: Compatibility Testing

#### 1. Browser Versions
- Chrome stable
- Chrome beta
- Chrome canary
- Different OS platforms

#### 2. Extension Permissions
- Minimal permissions test
- Permission request flow
- Host permission handling

## Test Data Management

### Mock Nellis Auction Site
```javascript
// tests/e2e/mocks/nellisServer.js
// Local server that mimics Nellis auction pages
// Controllable auction states
// Predictable test data
```

### Test Auction Factory
```javascript
// tests/e2e/factories/testAuctions.js
// Generate test auction pages
// Control auction timing
// Simulate bid updates
```

## CI/CD Integration

### GitHub Actions Workflow
```yaml
name: Chrome Extension E2E Tests
on: [push, pull_request]

jobs:
  e2e-extension:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Chrome
        uses: browser-actions/setup-chrome@latest
        
      - name: Build Extension
        run: |
          cd nellis-auction-helper
          npm install
          npm run build
          
      - name: Start Backend
        run: |
          cd nellis-auction-backend
          docker-compose up -d
          
      - name: Run E2E Tests
        run: |
          cd nellis-auction-backend
          npm run test:e2e:extension
```

## Success Criteria

### Functional Requirements
- [ ] All user journeys work end-to-end
- [ ] WebSocket communication is reliable
- [ ] State synchronization is accurate
- [ ] Error handling is graceful

### Performance Requirements
- [ ] Popup opens in < 500ms
- [ ] Updates received in < 100ms
- [ ] Memory usage stable over time
- [ ] No service worker crashes

### Compatibility Requirements
- [ ] Works on Chrome 90+
- [ ] Handles permission changes
- [ ] Survives browser updates
- [ ] Cross-platform compatibility

## Implementation Timeline

### Week 1: Setup & Basic Tests
- Configure Puppeteer for extension
- Create helper utilities
- Implement installation tests
- Basic authentication tests

### Week 2: Core Functionality
- Auction monitoring tests
- Bidding strategy tests
- Real-time update tests
- Error handling tests

### Week 3: Advanced Scenarios
- Multi-device tests
- Performance tests
- Compatibility tests
- CI/CD integration

## Next Steps

1. **Verify Extension Location**: Ensure `nellis-auction-helper` path is correct
2. **Create Test Structure**: Set up directories and base files
3. **Mock Nellis Site**: Create controllable test environment
4. **Implement Core Tests**: Start with installation and auth
5. **Iterate and Expand**: Add more scenarios based on findings