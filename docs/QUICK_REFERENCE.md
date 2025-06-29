# Quick Reference Guide

## 🚀 Common Tasks

### Deployment Commands
```bash
# Development (with hot-reload)
./deploy.sh dev

# Production
./deploy.sh prod

# View logs
./deploy.sh logs

# Stop services
./deploy.sh stop

# Check status
./deploy.sh status

# Backup Redis
./deploy.sh backup

# Clean everything
./deploy.sh clean
```

### Docker Quick Commands
```bash
# Development (uses .env or .env.development)
docker-compose up

# Production (uses .env.production)
docker-compose --env-file .env.production up -d

# Rebuild images
docker-compose build --no-cache

# View container logs
docker-compose logs -f backend
```

### Adding a New Feature
```bash
# 1. Create feature flag
echo "USE_MY_FEATURE=false" >> .env

# 2. Create wrapper class
cat > src/services/classes/MyFeatureWrapper.js << 'EOF'
class MyFeatureWrapper extends BaseClass {
  method() {
    if (process.env.USE_MY_FEATURE === 'true') {
      // New implementation
    }
    return super.method();
  }
}
EOF

# 3. Write tests
npm run test:unit -- --testNamePattern="MyFeature"

# 4. Implement feature
# 5. Test with flag on/off
# 6. Document changes
```

### Running Tests
```bash
# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# BDD tests
npm run test:bdd

# Specific test file
npm test -- tests/unit/myTest.test.js

# With coverage
npm run test:coverage
```

### Feature Flag Management
```javascript
// Check flag in code
if (process.env.USE_POLLING_QUEUE === 'true') {
  // New behavior
}

// Toggle via environment
USE_POLLING_QUEUE=true npm start

// Toggle via Redis (if implemented)
redis-cli SET feature:polling_queue true
```

## 📁 Project Structure
```
src/
├── interfaces/          # Service contracts
├── container/          # DI container
├── services/
│   ├── classes/       # Class wrappers
│   ├── auctionMonitor.js  # Singleton
│   └── index.js       # Exports both
├── routes/            # API endpoints
├── utils/             # Utilities
└── middleware/        # Express middleware
```

## 🔧 Service Usage Patterns

### Legacy (Singleton)
```javascript
const auctionMonitor = require('./services/auctionMonitor');
auctionMonitor.addAuction('123', config);
```

### Modern (Class)
```javascript
const { AuctionMonitorClass } = require('./services');
const monitor = new AuctionMonitorClass(storage, api, logger);
monitor.addAuction('123', config);
```

### DI Container
```javascript
const { container } = require('./container/serviceRegistration');
const monitor = container.get('auctionMonitor');
monitor.addAuction('123', config);
```

## 🧪 Testing Patterns

### Feature Flag Testing
```javascript
describe('Feature', () => {
  describe('enabled', () => {
    beforeEach(() => {
      process.env.USE_FEATURE = 'true';
    });
    // Test new behavior
  });
  
  describe('disabled', () => {
    beforeEach(() => {
      process.env.USE_FEATURE = 'false';
    });
    // Test old behavior
  });
});
```

### Wrapper Testing
```javascript
it('should delegate to singleton', () => {
  const wrapper = new ServiceWrapper();
  const spy = sinon.spy(wrapper._singleton, 'method');
  wrapper.method();
  expect(spy).toHaveBeenCalled();
});
```

## 🚨 Common Issues

### Issue: Tests failing after changes
**Solution**: Update tests first, then make changes
```bash
npm test -- --watch
```

### Issue: Chrome extension not working
**Solution**: Check backward compatibility
```bash
npm run test:integration -- chromeExtensionCompatibility
```

### Issue: Performance regression
**Solution**: Check feature flags
```bash
# Disable all new features
USE_POLLING_QUEUE=false \
USE_CIRCUIT_BREAKER=false \
USE_STATE_MACHINE=false \
npm start
```

## 📊 Monitoring & Debugging

### Check Application Health
```bash
curl http://localhost:3000/health
```

### View Monitored Auctions
```bash
curl -H "Authorization: Bearer $AUTH_TOKEN" \
  http://localhost:3000/api/auctions
```

### WebSocket Testing
```javascript
// In browser console
const ws = new WebSocket('ws://localhost:3000/ws');
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'authenticate',
    token: 'your-auth-token'
  }));
};
ws.onmessage = (event) => console.log(JSON.parse(event.data));
```

## 🎯 Phase 3 Specific

### Polling Queue Implementation
```javascript
// Enable polling queue
USE_POLLING_QUEUE=true npm start

// Monitor queue metrics
const queue = container.get('pollingQueue');
console.log('Queue size:', queue.size());
console.log('Next poll:', queue.getNext());
```

### Circuit Breaker Testing
```javascript
// Force circuit to open
for (let i = 0; i < 10; i++) {
  try {
    await nellisApi.getAuctionData('invalid');
  } catch (e) {}
}

// Check circuit state
console.log('Circuit open:', breaker.isOpen());
```

## 📝 Documentation Updates

### After implementing feature:
1. Update `IMPLEMENTATION_PROGRESS.md`
2. Add to `ARCHITECTURE.md` if architectural
3. Update `TESTING_STRATEGY.md` with new patterns
4. Document in feature's wrapper class

### After fixing bug:
1. Add test case to prevent regression
2. Update `TECHNICAL_DEBT_REGISTER.md` if relevant
3. Note in `IMPLEMENTATION_PROGRESS.md`

## 🔗 Useful Links

- [Master Plan](./MASTER_IMPLEMENTATION_PLAN.md)
- [Architecture](./ARCHITECTURE.md)
- [Testing Strategy](./TESTING_STRATEGY.md)
- [API Docs](./api/README.md)

---

**Golden Rule**: If in doubt, wrap it, flag it, test it!