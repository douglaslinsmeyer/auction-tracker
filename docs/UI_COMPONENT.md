# Dashboard Component Documentation

## Overview

The Dashboard component is a standalone web application that provides a web UI for monitoring and controlling auctions. It was separated from the backend to enable:
- Independent deployment and scaling
- Easier frontend development workflow
- Multiple UI implementations if needed
- Better separation of concerns

## Architecture

### Component Interaction

```
┌─────────────────┐     WebSocket      ┌─────────────────┐     REST API      ┌─────────────────┐
│   Chrome Ext    │ ◄────────────────► │     Backend     │ ◄────────────────► │ Nellis Auction  │
└─────────────────┘                    └─────────────────┘                    └─────────────────┘
                                               ▲
                                               │ WebSocket
                                               ▼
                                       ┌─────────────────┐
                                       │    Dashboard    │
                                       └─────────────────┘
```

### Directory Structure

```
dashboard/
├── src/
│   ├── index.html      # Main application HTML
│   ├── app.js          # Application logic and WebSocket client
│   └── settings.js     # Settings management
├── assets/             # Static assets (currently empty)
├── dist/               # Production build output (if needed)
├── package.json        # Package configuration
├── README.md          # Component-specific documentation
└── .gitignore         # Git ignore rules
```

## Key Features

1. **Real-time Monitoring**
   - WebSocket connection for live auction updates
   - Automatic reconnection with exponential backoff
   - Connection status indicators

2. **Auction Management**
   - View all monitored auctions
   - Stop monitoring individual auctions
   - View bid history
   - Configure bidding strategies

3. **User Interface**
   - Responsive design with Tailwind CSS
   - Dark mode support
   - Mobile-friendly layout
   - Sidebar navigation

4. **Settings Management**
   - Default bidding configuration
   - Strategy preferences
   - Bid increment settings

## Development

### Running Locally

```bash
cd dashboard
npm run start  # Uses Python HTTP server
# OR
npm install && npm run serve  # Uses Node.js serve
```

### Configuration

The Dashboard automatically detects the backend location based on where it's served from. For development with a different backend location, modify `app.js`:

```javascript
const wsUrl = `ws://localhost:3000`;  // Change to your backend URL
```

## Deployment Options

### Option 1: Served by Backend (Default)

The backend automatically serves the Dashboard files if they exist. This is the simplest deployment option:

```bash
# Backend will serve from dashboard/src/ directory
npm start  # In backend directory
```

### Option 2: Separate Static Hosting

Deploy the Dashboard files to any static hosting service:

1. **Nginx Configuration**:
```nginx
server {
    listen 80;
    server_name dashboard.example.com;
    root /var/www/dashboard/src;
    index index.html;
    
    location / {
        try_files $uri $uri/ =404;
    }
}
```

2. **Environment Variables**:
```bash
# On backend server
SERVE_UI=false  # Disable UI serving from backend
```

3. **CORS Configuration**:
Ensure the backend allows the UI origin in CORS settings.

## Security Considerations

1. **Authentication**
   - Token-based authentication required
   - Tokens stored in localStorage
   - Prompt for token on first connection

2. **WebSocket Security**
   - Upgrade to WSS for production
   - Rate limiting on backend
   - Connection validation

3. **Content Security**
   - No inline scripts (except minimal routing)
   - External resources from trusted CDNs only
   - HTTPS recommended for production

## Future Enhancements

1. **Build Process**
   - Add webpack/vite for optimization
   - Bundle and minify assets
   - Environment-specific builds

2. **Features**
   - Export auction history
   - Advanced filtering and search
   - Notification preferences
   - Multi-language support

3. **Testing**
   - Add UI testing framework
   - E2E tests with Puppeteer
   - Visual regression testing