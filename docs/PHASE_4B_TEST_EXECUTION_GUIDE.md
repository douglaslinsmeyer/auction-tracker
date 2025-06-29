# Phase 4b Test Execution Guide

## Running BDD Tests

### Run All BDD Tests
```bash
npm run test:bdd
```

### Run BDD Tests in Watch Mode
```bash
npm run test:bdd:watch
```

### Run Specific Feature
```bash
npx cucumber-js tests/bdd/features/auction-monitoring/core-monitoring.feature --require tests/bdd/step-definitions --require tests/bdd/support
```

### Run All Test Types (Unit + Integration + BDD + E2E)
```bash
npm run test:all
```

## Test Organization

### Feature Files
```
tests/bdd/features/
├── auction-monitoring/
│   └── core-monitoring.feature (9 scenarios)
├── bidding-strategies/
│   └── bidding-strategies.feature (15 scenarios)
├── authentication/
│   └── authentication.feature (16 scenarios)
├── websocket/
│   └── websocket-communication.feature (10 scenarios)
├── performance/
│   └── performance-reliability.feature (21 scenarios)
├── edge-cases/
│   └── edge-cases.feature (33 scenarios)
├── integration/
│   └── integration-flows.feature (20 scenarios)
└── test-infrastructure.feature (3 scenarios - for testing)
```

### Step Definitions
```
tests/bdd/step-definitions/
├── common.steps.js              # Shared steps
├── core-monitoring.steps.js     # Monitoring specific
├── bidding-strategies.steps.js  # Strategy behaviors
├── authentication.steps.js      # Auth flows
├── websocket-communication.steps.js # Real-time
├── performance-reliability.steps.js # Performance
└── test-infrastructure.steps.js # Test setup
```

## Running Tests by Priority

### High Priority (Core Features)
```bash
# Run individual features
npx cucumber-js tests/bdd/features/auction-monitoring/core-monitoring.feature --require tests/bdd/step-definitions --require tests/bdd/support
npx cucumber-js tests/bdd/features/bidding-strategies/bidding-strategies.feature --require tests/bdd/step-definitions --require tests/bdd/support
npx cucumber-js tests/bdd/features/authentication/authentication.feature --require tests/bdd/step-definitions --require tests/bdd/support
npx cucumber-js tests/bdd/features/websocket/websocket-communication.feature --require tests/bdd/step-definitions --require tests/bdd/support
```

### Medium Priority (Reliability)
```bash
npx cucumber-js tests/bdd/features/performance/performance-reliability.feature --require tests/bdd/step-definitions --require tests/bdd/support
npx cucumber-js tests/bdd/features/edge-cases/edge-cases.feature --require tests/bdd/step-definitions --require tests/bdd/support
```

### Low Priority (Integration)
```bash
npx cucumber-js tests/bdd/features/integration/integration-flows.feature --require tests/bdd/step-definitions --require tests/bdd/support
```

## Test Output Formats

### Progress Format (Default)
```bash
npm run test:bdd
```

### JSON Format (For Reports)
```bash
npx cucumber-js tests/bdd/features --require tests/bdd/step-definitions --require tests/bdd/support --format json:test-results.json
```

### Pretty Format (Detailed)
```bash
npx cucumber-js tests/bdd/features --require tests/bdd/step-definitions --require tests/bdd/support --format pretty
```

## Debugging Tests

### Run Single Scenario
```bash
npx cucumber-js tests/bdd/features/auction-monitoring/core-monitoring.feature:12 --require tests/bdd/step-definitions --require tests/bdd/support
```

### Run with Tags
```bash
# Add @focus tag to scenarios you want to run
npx cucumber-js tests/bdd/features --require tests/bdd/step-definitions --require tests/bdd/support --tags @focus
```

### Increase Timeout
```bash
# Set in hooks.js or via environment variable
CUCUMBER_TIMEOUT=60000 npm run test:bdd
```

## Expected Results

- **Total Features**: 8
- **Total Scenarios**: 139
- **High Priority**: 50 scenarios
- **Medium Priority**: 69 scenarios  
- **Low Priority**: 20 scenarios

## Common Issues and Solutions

### Issue: Tests Timeout
**Solution**: The tests use a 30-second default timeout. For longer operations, increase the timeout in `tests/bdd/support/world.js`

### Issue: Redis Connection Errors
**Solution**: Tests use ioredis mock automatically. No real Redis needed.

### Issue: Module Not Found
**Solution**: Ensure all step definitions use correct relative paths (../../../src/)

### Issue: Undefined Steps
**Solution**: Make sure to require all step definition files, including common.steps.js

## Integration with CI/CD

### GitHub Actions Example
```yaml
- name: Run BDD Tests
  run: npm run test:bdd
  
- name: Upload Test Results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: bdd-test-results
    path: test-results.json
```

## Next Steps

1. Run full test suite to establish baseline
2. Set up CI/CD pipeline with BDD tests
3. Configure test reporting
4. Monitor test execution times
5. Plan for Phase 5 integration testing