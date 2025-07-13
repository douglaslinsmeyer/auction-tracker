# Chrome Extension Update Guide for Kubernetes Deployment

## Issue
The Chrome extension is configured to connect directly to the backend service at `http://localhost:3000`, but with the Kubernetes deployment, all traffic should go through the Gateway at `http://localhost`.

## Solution

### Option 1: Update Extension Settings (Recommended for Existing Installation)
1. Click on the Nellis Auction Helper extension icon
2. Click the gear icon (⚙️) to open Settings
3. In the "Backend Configuration" section:
   - Change Backend URL from `http://localhost:3000` to `http://localhost`
   - Keep the Auth Token as `dev-token`
4. Click "Test Connection" to verify
5. Click "Save Settings"

### Option 2: Reload Extension with Updated Code
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Find "Nellis Auction Helper" and click "Remove"
4. Click "Load unpacked" and select the `extension` folder
5. The extension will now use the updated default configuration

## Technical Changes Made

### 1. Updated Default Configuration (`extension/src/config.js`)
```javascript
BACKEND: {
  DEFAULT_URL: 'http://localhost',           // Changed from http://localhost:3000
  DEFAULT_TOKEN: 'dev-token',
  DEFAULT_WS_URL: 'ws://localhost/ws'        // Changed from ws://localhost:3000
}
```

### 2. Fixed WebSocket Connection (`extension/src/backend-client.js`)
```javascript
// Now correctly appends /ws path for Gateway routing
const wsUrl = this.baseUrl.replace(/^http/, 'ws') + CONFIG.WS.PATH;
```

### 3. Updated Options Page Placeholder
The backend URL input now shows `http://localhost` as the placeholder instead of `http://localhost:3000`.

## Verification

After updating, you should see in the extension's background page console:
- WebSocket connecting to `ws://localhost/ws` (not `ws://localhost:3000`)
- API calls going to `http://localhost/api/*` (not `http://localhost:3000/api/*`)

## Troubleshooting

If the extension still can't connect:
1. Check that the Gateway is running: `kubectl get pods -n nginx-gateway`
2. Verify Gateway service is accessible: `curl http://localhost/health`
3. Check extension permissions in manifest.json include `http://localhost:*/*`
4. Look at the extension's background page console for specific errors