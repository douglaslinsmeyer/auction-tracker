# Contributing to Auction Tracker

Thank you for your interest in contributing to the Auction Tracker project! This document provides guidelines and instructions for contributing.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Code Style](#code-style)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [CI/CD Pipeline](#cicd-pipeline)

## Code of Conduct

Please note that this project adheres to a Code of Conduct. By participating, you are expected to uphold this code:

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/auction-tracker.git`
3. Add the upstream remote: `git remote add upstream https://github.com/douglaslinsmeyer/auction-tracker.git`
4. Create a new branch: `git checkout -b feature/your-feature-name`

## Development Setup

### Prerequisites
- Node.js 18+ (Backend requires 18+, Dashboard requires 14+)
- Docker and Docker Compose
- Redis (or use Docker)
- Chrome/Chromium (for extension development)

### Initial Setup

```bash
# Install backend dependencies
cd backend
npm ci

# Install dashboard dependencies
cd ../dashboard
npm ci

# Copy environment files
cp backend/.env.example backend/.env
cp dashboard/.env.example dashboard/.env

# Start services with Docker
docker-compose up
```

### Development Workflow

1. **Backend Development**
   ```bash
   cd backend
   npm run dev  # Starts with nodemon for hot-reload
   ```

2. **Dashboard Development**
   ```bash
   cd dashboard
   npm run dev  # Starts development server
   ```

3. **Extension Development**
   - Load unpacked extension from `extension/` directory in Chrome
   - Make changes and reload extension

## Making Changes

### Branch Naming Convention
- Feature: `feature/short-description`
- Bug Fix: `fix/issue-number-description`
- Refactor: `refactor/component-name`
- Docs: `docs/what-you-updated`

### Commit Messages
Follow conventional commits format:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Example: `feat: add real-time bid notifications`

## Code Style

### General Rules
1. **Use the project's logger** - Never use `console.log()` directly
   ```javascript
   // ❌ BAD
   console.log('User logged in');
   
   // ✅ GOOD
   logger.info('User logged in', { userId: user.id });
   ```

2. **Follow ESLint rules** - Run `npm run lint` before committing

3. **Use Prettier for formatting** - Run `npm run format` before committing

4. **No hardcoded secrets** - Use environment variables

### JavaScript Style Guide
- Use ES6+ features
- Prefer `const` over `let`, avoid `var`
- Use async/await over callbacks
- Use meaningful variable names
- Add JSDoc comments for functions

### Error Handling
```javascript
// Always handle errors appropriately
try {
  const result = await someAsyncOperation();
  return result;
} catch (error) {
  logger.error('Operation failed', { error: error.message, stack: error.stack });
  throw new AppError('Operation failed', 500);
}
```

## Testing

### Running Tests

```bash
# Backend tests
cd backend
npm test                 # All tests
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests
npm run test:e2e        # End-to-end tests
npm run test:coverage   # With coverage report

# Dashboard tests
cd dashboard
npm test
```

### Writing Tests
- Write tests for all new features
- Maintain >80% code coverage
- Use descriptive test names
- Mock external dependencies
- Test both success and error cases

Example test structure:
```javascript
describe('AuctionMonitor', () => {
  describe('placeBid', () => {
    it('should place a bid successfully when user is authenticated', async () => {
      // Test implementation
    });
    
    it('should throw error when bid amount is invalid', async () => {
      // Test implementation
    });
  });
});
```

## Submitting Changes

### Pre-submission Checklist
1. **Code Quality**
   ```bash
   npm run lint        # No linting errors
   npm run format      # Code is formatted
   npm test           # All tests pass
   ```

2. **Documentation**
   - Update README if needed
   - Add/update JSDoc comments
   - Update API documentation (swagger.yaml)

3. **Security**
   - No hardcoded secrets
   - No security vulnerabilities (`npm audit`)
   - Sanitize user inputs

### Pull Request Process

1. **Update your branch**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Push your changes**
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Create Pull Request**
   - Use the PR template
   - Link related issues
   - Add screenshots if UI changes
   - Request review from maintainers

4. **Address Review Feedback**
   - Make requested changes
   - Push new commits (don't force-push during review)
   - Reply to review comments

## CI/CD Pipeline

### Automated Checks
When you submit a PR, the following checks run automatically:

1. **Linting** - ESLint checks for code quality
2. **Tests** - Unit, integration, and E2E tests
3. **Security** - Dependency vulnerabilities scan
4. **Docker Build** - Ensures images build correctly
5. **Code Coverage** - Maintains >80% coverage

### Pipeline Status
All checks must pass before merging. If a check fails:
1. Click on the failed check for details
2. Fix the issue locally
3. Push the fix to your branch

### Local CI Validation
Run these commands locally to ensure CI will pass:
```bash
# Simulate CI pipeline locally
npm run lint
npm test
npm run test:coverage
docker-compose build
```

## Getting Help

If you need help:
1. Check existing issues and PRs
2. Read the documentation in `/docs`
3. Ask in PR comments
4. Create an issue for discussion

## Recognition

Contributors are recognized in:
- Project README
- Release notes
- Contributors page

Thank you for contributing to Auction Tracker! 🚀