# Project Structure

The Auction Helper project is organized into three independent applications:

## Root Directory
```
auction-helper/
├── backend/          # Backend API service
├── dashboard/        # Web dashboard UI
├── extension/        # Chrome extension
├── docs/            # Project documentation
├── research/        # Research and analysis files
├── CLAUDE.md        # AI assistant guidelines
└── README.md        # Main project documentation
```

## Backend (`backend/`)
Standalone Node.js/Express API server
```
backend/
├── src/             # Source code
│   ├── index.js     # Entry point
│   ├── client/      # Client utilities
│   ├── config/      # Configuration
│   ├── container/   # Dependency injection
│   ├── interfaces/  # Service interfaces
│   ├── middleware/  # Express middleware
│   ├── routes/      # API routes
│   ├── services/    # Business logic
│   ├── utils/       # Utilities
│   └── validators/  # Input validation
├── tests/           # Test files
│   ├── unit/        # Unit tests
│   ├── integration/ # Integration tests
│   ├── e2e/         # End-to-end tests
│   └── bdd/         # BDD/Cucumber tests
├── package.json     # Dependencies
├── Dockerfile       # Container definition
├── docker-compose.yml
└── swagger.yaml     # API documentation
```

## Dashboard (`dashboard/`)
Standalone web application for monitoring
```
dashboard/
├── src/             # Frontend source
│   ├── index.html   # Main HTML
│   ├── app.js       # Application logic
│   └── settings.js  # Settings management
├── server.js        # Express server
├── package.json     # Dependencies
└── .env.example     # Environment template
```

## Extension (`extension/`)
Chrome extension for browser integration
```
extension/
├── src/             # Extension source
│   ├── background.js     # Service worker
│   ├── content-isolated.js # Content script
│   └── backend-client.js # Backend connection
├── popup/           # Extension popup
├── options/         # Extension options
├── manifest.json    # Extension manifest
└── README.md        # Extension docs
```

## Running the Applications

### Backend
```bash
cd backend
npm install
cp .env.example .env
npm run dev  # http://localhost:3000
```

### Dashboard
```bash
cd dashboard
npm install
cp .env.example .env
npm run dev  # http://localhost:3001
```

### Extension
1. Open Chrome/Edge
2. Go to Extensions page
3. Enable Developer Mode
4. Load unpacked from `extension/` directory