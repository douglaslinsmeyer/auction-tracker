#!/usr/bin/env node

/**
 * Development Test Runner (Node.js)
 * Cross-platform test runner for the auction-helper project
 * Usage: node scripts/run-all-tests.js [options]
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const process = require('process');

// ANSI color codes
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Default configuration
const config = {
  runUnit: true,
  runIntegration: true,
  runE2E: true,
  runBDD: true,
  runCoverage: false,
  parallel: false,
  verbose: false,
  watch: false,
  bailOnFailure: false,
  silent: false
};

// Parse command line arguments
function parseArguments() {
  const args = process.argv.slice(2);
  
  for (const arg of args) {
    switch (arg) {
      case '--unit-only':
        config.runUnit = true;
        config.runIntegration = false;
        config.runE2E = false;
        config.runBDD = false;
        break;
      case '--integration-only':
        config.runUnit = false;
        config.runIntegration = true;
        config.runE2E = false;
        config.runBDD = false;
        break;
      case '--e2e-only':
        config.runUnit = false;
        config.runIntegration = false;
        config.runE2E = true;
        config.runBDD = false;
        break;
      case '--bdd-only':
        config.runUnit = false;
        config.runIntegration = false;
        config.runE2E = false;
        config.runBDD = true;
        break;
      case '--no-unit':
        config.runUnit = false;
        break;
      case '--no-integration':
        config.runIntegration = false;
        break;
      case '--no-e2e':
        config.runE2E = false;
        break;
      case '--no-bdd':
        config.runBDD = false;
        break;
      case '--coverage':
        config.runCoverage = true;
        break;
      case '--parallel':
        config.parallel = true;
        break;
      case '--verbose':
        config.verbose = true;
        break;
      case '--watch':
        config.watch = true;
        break;
      case '--bail':
        config.bailOnFailure = true;
        break;
      case '--silent':
        config.silent = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('-')) {
          logError(`Unknown option: ${arg}`);
          console.log('Use --help for usage information');
          process.exit(1);
        }
    }
  }
}

// Helper functions
function log(level, message) {
  if (config.silent && level !== 'error') return;
  
  const timestamp = new Date().toISOString().substr(11, 8);
  const prefix = `[${timestamp}]`;
  
  switch (level) {
    case 'info':
      console.log(`${colors.blue}${prefix} [INFO]${colors.reset} ${message}`);
      break;
    case 'success':
      console.log(`${colors.green}${prefix} [SUCCESS]${colors.reset} ${message}`);
      break;
    case 'warning':
      console.log(`${colors.yellow}${prefix} [WARNING]${colors.reset} ${message}`);
      break;
    case 'error':
      console.log(`${colors.red}${prefix} [ERROR]${colors.reset} ${message}`);
      break;
  }
}

function logInfo(message) { log('info', message); }
function logSuccess(message) { log('success', message); }
function logWarning(message) { log('warning', message); }
function logError(message) { log('error', message); }

function logSection(title) {
  if (config.silent) return;
  console.log('');
  console.log(`${colors.blue}${'='.repeat(50)}${colors.reset}`);
  console.log(`${colors.blue} ${title}${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(50)}${colors.reset}`);
  console.log('');
}

function showHelp() {
  console.log('Development Test Runner (Node.js)');
  console.log('');
  console.log('Usage: node scripts/run-all-tests.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --unit-only        Run only unit tests');
  console.log('  --integration-only Run only integration tests');
  console.log('  --e2e-only         Run only E2E tests');
  console.log('  --bdd-only         Run only BDD tests');
  console.log('  --no-unit          Skip unit tests');
  console.log('  --no-integration   Skip integration tests');
  console.log('  --no-e2e           Skip E2E tests');
  console.log('  --no-bdd           Skip BDD tests');
  console.log('  --coverage         Generate coverage reports');
  console.log('  --parallel         Run test suites in parallel');
  console.log('  --verbose          Show verbose output');
  console.log('  --watch            Run tests in watch mode');
  console.log('  --bail             Stop on first test suite failure');
  console.log('  --silent           Minimal output');
  console.log('  --help, -h         Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/run-all-tests.js                 # Run all tests');
  console.log('  node scripts/run-all-tests.js --unit-only     # Run only unit tests');
  console.log('  node scripts/run-all-tests.js --no-e2e        # Run all tests except E2E');
  console.log('  node scripts/run-all-tests.js --coverage      # Run all tests with coverage');
  console.log('  node scripts/run-all-tests.js --watch         # Run tests in watch mode');
}

// Check project structure
function checkProjectRoot() {
  if (!fs.existsSync('backend') || !fs.existsSync('scripts') || !fs.existsSync('CLAUDE.md')) {
    logError('This script must be run from the project root directory');
    logInfo(`Current directory: ${process.cwd()}`);
    logInfo('Expected structure: project-root/backend/, project-root/scripts/, project-root/CLAUDE.md');
    process.exit(1);
  }
}

function checkBackend() {
  if (!fs.existsSync('backend') || !fs.existsSync('backend/package.json')) {
    logError('Backend directory not found or missing package.json');
    process.exit(1);
  }
}

// Install dependencies
function ensureDependencies() {
  logInfo('Checking backend dependencies...');
  process.chdir('backend');
  
  if (!fs.existsSync('node_modules') || 
      fs.statSync('package.json').mtime > fs.statSync('node_modules').mtime) {
    logInfo('Installing backend dependencies...');
    try {
      execSync('npm install', { 
        stdio: config.verbose ? 'inherit' : 'pipe',
        timeout: 300000 // 5 minutes
      });
    } catch (error) {
      logError('Failed to install dependencies');
      process.exit(1);
    }
  }
  
  process.chdir('..');
}

// Check services
function checkServices() {
  logInfo('Checking if Redis is available...');
  
  try {
    execSync('redis-cli ping', { stdio: 'pipe', timeout: 5000 });
    logSuccess('Redis is available');
  } catch (error) {
    logWarning('Redis not available - tests will use in-memory fallback');
  }
  
  if (config.runE2E) {
    logInfo('E2E tests enabled - backend server will be started by tests');
  }
}

// Run a single test suite
async function runTestSuite(suiteName, command, directory = 'backend') {
  return new Promise((resolve) => {
    logSection(`Running ${suiteName} Tests`);
    
    const originalDir = process.cwd();
    process.chdir(directory);
    
    if (config.verbose) {
      logInfo(`Command: ${command}`);
      logInfo(`Directory: ${process.cwd()}`);
    }
    
    const startTime = Date.now();
    
    const child = spawn('npm', command.split(' ').slice(1), {
      stdio: config.verbose ? 'inherit' : 'pipe',
      shell: true
    });
    
    let output = '';
    if (!config.verbose) {
      child.stdout?.on('data', (data) => output += data.toString());
      child.stderr?.on('data', (data) => output += data.toString());
    }
    
    child.on('close', (code) => {
      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000);
      
      process.chdir(originalDir);
      
      if (code === 0) {
        logSuccess(`${suiteName} tests passed (${duration}s)`);
        resolve(true);
      } else {
        logError(`${suiteName} tests failed (${duration}s)`);
        if (!config.verbose && output) {
          console.log(output);
        }
        resolve(false);
      }
    });
    
    child.on('error', (error) => {
      process.chdir(originalDir);
      logError(`Failed to run ${suiteName} tests: ${error.message}`);
      resolve(false);
    });
  });
}

// Run tests in parallel
async function runParallel() {
  logSection('Running Tests in Parallel');
  logWarning('Parallel execution may produce interleaved output');
  
  const promises = [];
  
  if (config.runUnit) {
    promises.push(runTestSuite('Unit', 'npm run test:unit', 'backend'));
  }
  
  if (config.runIntegration) {
    promises.push(runTestSuite('Integration', 'npm run test:integration', 'backend'));
  }
  
  if (config.runBDD) {
    promises.push(runTestSuite('BDD', 'npm run test:bdd', 'backend'));
  }
  
  // Run parallel tests
  const results = await Promise.all(promises);
  
  // Run E2E tests separately to avoid conflicts
  if (config.runE2E) {
    logInfo('E2E tests will run after parallel tests complete');
    const e2eResult = await runTestSuite('E2E', 'npm run test:e2e', 'backend');
    results.push(e2eResult);
  }
  
  const failedCount = results.filter(result => !result).length;
  
  if (failedCount > 0) {
    logError(`${failedCount} test suite(s) failed`);
    return false;
  } else {
    logSuccess('All test suites passed');
    return true;
  }
}

// Generate coverage
async function generateCoverage() {
  logSection('Generating Coverage Report');
  
  process.chdir('backend');
  
  try {
    execSync('npm run test:coverage', {
      stdio: config.verbose ? 'inherit' : 'pipe',
      timeout: 120000 // 2 minutes
    });
    
    logSuccess('Coverage report generated in backend/coverage/');
    
    const coverageFile = path.join('coverage', 'lcov-report', 'index.html');
    if (fs.existsSync(coverageFile)) {
      logInfo(`Coverage report available at: backend/${coverageFile}`);
      
      // Try to open coverage report
      try {
        if (process.platform === 'darwin') {
          execSync(`open ${coverageFile}`, { stdio: 'ignore' });
        } else if (process.platform === 'linux') {
          execSync(`xdg-open ${coverageFile}`, { stdio: 'ignore' });
        } else if (process.platform === 'win32') {
          execSync(`start ${coverageFile}`, { stdio: 'ignore', shell: true });
        }
        logInfo('Opening coverage report in browser...');
      } catch (error) {
        // Ignore errors when trying to open browser
      }
    }
    
    process.chdir('..');
    return true;
  } catch (error) {
    logError('Coverage generation failed');
    process.chdir('..');
    return false;
  }
}

// Watch mode
function runWatchMode() {
  logSection('Running Tests in Watch Mode');
  logInfo('Press Ctrl+C to exit watch mode');
  
  process.chdir('backend');
  
  const command = config.runUnit && !config.runIntegration && !config.runE2E && !config.runBDD 
    ? 'npm run test:watch'
    : 'npm test -- --watch';
  
  if (command !== 'npm run test:watch') {
    logWarning('Watch mode works best with unit tests only');
    logInfo(`Running: ${command}`);
  }
  
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    // User probably pressed Ctrl+C
  }
  
  process.chdir('..');
}

// Main execution
async function main() {
  const scriptStartTime = Date.now();
  
  parseArguments();
  
  logSection('Auction Helper - Development Test Runner (Node.js)');
  logInfo('Starting test execution...');
  
  // Preliminary checks
  checkProjectRoot();
  checkBackend();
  ensureDependencies();
  checkServices();
  
  // Handle watch mode
  if (config.watch) {
    runWatchMode();
    return;
  }
  
  let success = true;
  
  // Handle parallel execution
  if (config.parallel) {
    success = await runParallel();
  } else {
    // Sequential execution
    const failedSuites = [];
    
    if (config.runUnit) {
      const result = await runTestSuite('Unit', 'npm run test:unit', 'backend');
      if (!result) {
        failedSuites.push('Unit');
        if (config.bailOnFailure) process.exit(1);
      }
    }
    
    if (config.runIntegration) {
      const result = await runTestSuite('Integration', 'npm run test:integration', 'backend');
      if (!result) {
        failedSuites.push('Integration');
        if (config.bailOnFailure) process.exit(1);
      }
    }
    
    if (config.runBDD) {
      const result = await runTestSuite('BDD', 'npm run test:bdd', 'backend');
      if (!result) {
        failedSuites.push('BDD');
        if (config.bailOnFailure) process.exit(1);
      }
    }
    
    if (config.runE2E) {
      const result = await runTestSuite('E2E', 'npm run test:e2e', 'backend');
      if (!result) {
        failedSuites.push('E2E');
        if (config.bailOnFailure) process.exit(1);
      }
    }
    
    success = failedSuites.length === 0;
    
    const scriptEndTime = Date.now();
    const totalDuration = Math.round((scriptEndTime - scriptStartTime) / 1000);
    
    if (success) {
      logSuccess(`All tests completed successfully in ${totalDuration}s`);
    } else {
      logError(`Failed test suites: ${failedSuites.join(', ')} (total time: ${totalDuration}s)`);
    }
  }
  
  // Generate coverage if requested
  if (config.runCoverage && success) {
    const coverageSuccess = await generateCoverage();
    if (!coverageSuccess) {
      success = false;
    }
  }
  
  logSection('Test Execution Complete');
  if (success) {
    logSuccess('All requested tests have been executed successfully');
  } else {
    logError('Some tests failed');
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logError(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logError(`Unhandled rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

// Run main function
main().catch((error) => {
  logError(`Script failed: ${error.message}`);
  process.exit(1);
});