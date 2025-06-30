# Development Scripts

This directory contains development and deployment scripts for the auction-helper project.

## Test Scripts

### `run-all-tests.sh` (Primary)
**Bash script for running all test suites** - This is the primary development test runner.

```bash
# Run all tests
./scripts/run-all-tests.sh

# Run specific test types
./scripts/run-all-tests.sh --unit-only
./scripts/run-all-tests.sh --integration-only
./scripts/run-all-tests.sh --e2e-only
./scripts/run-all-tests.sh --bdd-only

# Skip specific tests
./scripts/run-all-tests.sh --no-e2e
./scripts/run-all-tests.sh --no-bdd

# Additional options
./scripts/run-all-tests.sh --coverage        # Generate coverage reports
./scripts/run-all-tests.sh --parallel        # Run tests in parallel (experimental)
./scripts/run-all-tests.sh --watch          # Run in watch mode
./scripts/run-all-tests.sh --verbose        # Show detailed output
./scripts/run-all-tests.sh --bail           # Stop on first failure
```

### `run-all-tests.js` (Alternative)
Node.js alternative for environments where bash is not available.

```bash
# Run all tests
node scripts/run-all-tests.js

# Same options as bash version
node scripts/run-all-tests.js --unit-only
node scripts/run-all-tests.js --coverage
node scripts/run-all-tests.js --parallel
node scripts/run-all-tests.js --watch
node scripts/run-all-tests.js --silent      # Minimal output
```

## NPM Script Integration

### From Project Root
```bash
# Direct bash script execution (preferred)
./scripts/run-all-tests.sh              # Run all tests
./scripts/run-all-tests.sh --unit-only  # Unit tests only
./scripts/run-all-tests.sh --no-e2e     # Skip E2E (faster)
./scripts/run-all-tests.sh --coverage   # All tests with coverage
```

### From Backend Directory
```bash
cd backend

# Individual test suites
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:bdd
npm run test:coverage

# All tests via script
npm run test:all              # Executes bash script
```

## Features

### Automatic Environment Detection
- **Project structure validation**: Ensures scripts run from correct directory
- **Dependency checking**: Verifies npm packages are installed
- **Service availability**: Checks for Redis availability (with graceful fallback)
- **Test environment setup**: Configures proper environment variables

### Test Execution
- **Sequential execution** (default): Runs test suites one after another
- **Parallel execution** (experimental): Runs compatible test suites simultaneously
- **Watch mode**: Continuous testing with file change detection
- **Coverage reporting**: Generates HTML and console coverage reports

### Output Management
- **Colored output**: Easy-to-read success/failure indicators
- **Execution timing**: Shows duration for each test suite
- **Verbose mode**: Detailed command output for debugging
- **Silent mode**: Minimal output for CI/CD environments

### Error Handling
- **Graceful failures**: Continues execution unless `--bail` is specified
- **Detailed error reporting**: Shows which test suites failed
- **Service fallbacks**: Handles missing Redis gracefully
- **Dependency resolution**: Automatic npm install when needed

## Test Suites

### Unit Tests
- **Location**: `backend/tests/unit/`
- **Purpose**: Individual component testing
- **Speed**: Fast (~10-30 seconds)
- **Dependencies**: None (mocked)

### Integration Tests
- **Location**: `backend/tests/integration/`
- **Purpose**: Component interaction testing
- **Speed**: Medium (~30-60 seconds)
- **Dependencies**: Redis (optional), Express server

### End-to-End (E2E) Tests
- **Location**: `backend/tests/e2e/`
- **Purpose**: Full system testing with browser automation
- **Speed**: Slow (~60-120 seconds)
- **Dependencies**: Puppeteer, Chrome/Chromium
- **Note**: Chrome extensions cannot run in headless mode

### Behavior-Driven Development (BDD) Tests
- **Location**: `backend/tests/bdd/`
- **Purpose**: Feature-based testing with Gherkin syntax
- **Speed**: Medium (~30-90 seconds)
- **Dependencies**: Cucumber.js, Jest

## Environment Configuration

### Required Environment Variables
```bash
NODE_ENV=test                 # Automatically set by scripts
ENABLE_TEST_LOGS=false       # Suppress logging during tests
AUTH_TOKEN=test-auth-token   # Test authentication token
```

### Optional Environment Variables
```bash
REDIS_URL=redis://localhost:6379  # Redis connection (optional)
LOG_LEVEL=error                   # Logging level for tests
HEADLESS=true                     # Puppeteer headless mode
```

## Troubleshooting

### Common Issues

#### "Redis not available" Warning
- **Cause**: Redis server not running
- **Impact**: Tests use in-memory fallback (still functional)
- **Solution**: Start Redis with `redis-server` or ignore warning

#### "Chrome extensions cannot be loaded in headless mode"
- **Cause**: E2E tests trying to load extension in headless Chrome
- **Impact**: Extension-specific E2E tests are skipped
- **Solution**: Set `HEADLESS=false` environment variable

#### "Cannot log after tests are done"
- **Cause**: Console.log statements in test code after Jest completion
- **Impact**: CI/CD pipeline failures
- **Solution**: Use proper loggers (see logging guidelines)

#### Permission Denied on Scripts
- **Cause**: Script files not executable
- **Solution**: `chmod +x scripts/run-all-tests.sh`

### Performance Optimization

#### Fast Development Testing
```bash
# Skip slower test suites during development
npm run test:quick              # Skip E2E and BDD
npm run test:unit               # Unit tests only
```

#### Parallel Execution
```bash
# Experimental parallel execution
npm run test:parallel
```

#### Watch Mode for Development
```bash
# Continuous testing
npm run test:watch
```

## CI/CD Integration

### GitHub Actions
```yaml
- name: Run All Tests
  run: npm run test:all

- name: Generate Coverage
  run: npm run test:coverage
```

### Docker Testing
```bash
# Test in Docker environment
docker-compose -f docker-compose.test.yml up
```

## Contributing

When adding new test scripts:

1. **Follow naming conventions**: `test:type` for npm scripts
2. **Add help documentation**: Include `--help` option
3. **Handle errors gracefully**: Don't fail hard on non-critical issues  
4. **Support both platforms**: Test on both Unix and Windows
5. **Update this README**: Document new options and features