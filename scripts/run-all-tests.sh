#!/bin/bash

# Development Test Runner Script
# Runs all tests across the auction-helper project
# Usage: ./scripts/run-all-tests.sh [options]

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default options
RUN_UNIT=true
RUN_INTEGRATION=true
RUN_E2E=true
RUN_BDD=true
RUN_COVERAGE=false
PARALLEL=false
VERBOSE=false
WATCH=false
BAIL_ON_FAILURE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --unit-only)
      RUN_UNIT=true
      RUN_INTEGRATION=false
      RUN_E2E=false
      RUN_BDD=false
      shift
      ;;
    --integration-only)
      RUN_UNIT=false
      RUN_INTEGRATION=true
      RUN_E2E=false
      RUN_BDD=false
      shift
      ;;
    --e2e-only)
      RUN_UNIT=false
      RUN_INTEGRATION=false
      RUN_E2E=true
      RUN_BDD=false
      shift
      ;;
    --bdd-only)
      RUN_UNIT=false
      RUN_INTEGRATION=false
      RUN_E2E=false
      RUN_BDD=true
      shift
      ;;
    --no-unit)
      RUN_UNIT=false
      shift
      ;;
    --no-integration)
      RUN_INTEGRATION=false
      shift
      ;;
    --no-e2e)
      RUN_E2E=false
      shift
      ;;
    --no-bdd)
      RUN_BDD=false
      shift
      ;;
    --coverage)
      RUN_COVERAGE=true
      shift
      ;;
    --parallel)
      PARALLEL=true
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    --watch)
      WATCH=true
      shift
      ;;
    --bail)
      BAIL_ON_FAILURE=true
      shift
      ;;
    --help|-h)
      echo "Development Test Runner"
      echo ""
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --unit-only        Run only unit tests"
      echo "  --integration-only Run only integration tests"
      echo "  --e2e-only         Run only E2E tests"
      echo "  --bdd-only         Run only BDD tests"
      echo "  --no-unit          Skip unit tests"
      echo "  --no-integration   Skip integration tests"
      echo "  --no-e2e           Skip E2E tests"
      echo "  --no-bdd           Skip BDD tests"
      echo "  --coverage         Generate coverage reports"
      echo "  --parallel         Run test suites in parallel (experimental)"
      echo "  --verbose          Show verbose output"
      echo "  --watch            Run tests in watch mode"
      echo "  --bail             Stop on first test suite failure"
      echo "  --help, -h         Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0                 # Run all tests"
      echo "  $0 --unit-only     # Run only unit tests"
      echo "  $0 --no-e2e        # Run all tests except E2E"
      echo "  $0 --coverage      # Run all tests with coverage"
      echo "  $0 --watch         # Run tests in watch mode"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
}

# Check if we're in the project root
check_project_root() {
    if [[ ! -d "backend" ]] || [[ ! -d "scripts" ]] || [[ ! -f "CLAUDE.md" ]]; then
        log_error "This script must be run from the project root directory"
        log_info "Current directory: $(pwd)"
        log_info "Expected structure: project-root/backend/, project-root/scripts/, project-root/CLAUDE.md"
        exit 1
    fi
}

# Check if backend directory exists and has package.json
check_backend() {
    if [[ ! -d "backend" ]] || [[ ! -f "backend/package.json" ]]; then
        log_error "Backend directory not found or missing package.json"
        exit 1
    fi
}

# Install dependencies if needed
ensure_dependencies() {
    log_info "Checking backend dependencies..."
    cd backend
    if [[ ! -d "node_modules" ]] || [[ "package.json" -nt "node_modules" ]]; then
        log_info "Installing backend dependencies..."
        npm install
    fi
    cd ..
}

# Start required services
start_services() {
    log_info "Checking if Redis is available..."
    
    # Check if Redis is running
    if ! redis-cli ping >/dev/null 2>&1; then
        log_warning "Redis not available - tests will use in-memory fallback"
    else
        log_success "Redis is available"
    fi
    
    # For E2E tests, we might need to start the backend server
    if [[ "$RUN_E2E" == true ]]; then
        log_info "E2E tests enabled - backend server will be started by tests"
    fi
}

# Run a test suite and handle results
run_test_suite() {
    local suite_name=$1
    local command=$2
    local directory=${3:-"backend"}
    
    log_section "Running $suite_name Tests"
    
    cd "$directory"
    
    if [[ "$VERBOSE" == true ]]; then
        log_info "Command: $command"
        log_info "Directory: $(pwd)"
    fi
    
    local start_time=$(date +%s)
    
    if eval "$command"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log_success "$suite_name tests passed (${duration}s)"
        cd ..
        return 0
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log_error "$suite_name tests failed (${duration}s)"
        cd ..
        return 1
    fi
}

# Run tests in parallel (experimental)
run_parallel() {
    log_section "Running Tests in Parallel (Experimental)"
    log_warning "Parallel execution may produce interleaved output"
    
    local pids=()
    local results=()
    
    # Start background jobs
    if [[ "$RUN_UNIT" == true ]]; then
        (run_test_suite "Unit" "npm run test:unit" "backend") &
        pids+=($!)
    fi
    
    if [[ "$RUN_INTEGRATION" == true ]]; then
        (run_test_suite "Integration" "npm run test:integration" "backend") &
        pids+=($!)
    fi
    
    if [[ "$RUN_BDD" == true ]]; then
        (run_test_suite "BDD" "npm run test:bdd" "backend") &
        pids+=($!)
    fi
    
    # E2E tests should run separately as they may conflict
    if [[ "$RUN_E2E" == true ]]; then
        log_info "E2E tests will run after parallel tests complete"
    fi
    
    # Wait for parallel jobs
    for pid in "${pids[@]}"; do
        if wait "$pid"; then
            results+=(0)
        else
            results+=(1)
        fi
    done
    
    # Run E2E tests separately
    if [[ "$RUN_E2E" == true ]]; then
        if run_test_suite "E2E" "npm run test:e2e" "backend"; then
            results+=(0)
        else
            results+=(1)
        fi
    fi
    
    # Check results
    local failed=0
    for result in "${results[@]}"; do
        if [[ "$result" != "0" ]]; then
            failed=$((failed + 1))
        fi
    done
    
    if [[ "$failed" -gt 0 ]]; then
        log_error "$failed test suite(s) failed"
        return 1
    else
        log_success "All test suites passed"
        return 0
    fi
}

# Generate coverage report
generate_coverage() {
    log_section "Generating Coverage Report"
    
    cd backend
    
    if [[ "$VERBOSE" == true ]]; then
        npm run test:coverage
    else
        npm run test:coverage --silent
    fi
    
    if [[ $? -eq 0 ]]; then
        log_success "Coverage report generated in backend/coverage/"
        
        # Open coverage report if available
        if command -v xdg-open >/dev/null 2>&1; then
            log_info "Opening coverage report in browser..."
            xdg-open coverage/lcov-report/index.html >/dev/null 2>&1 &
        elif command -v open >/dev/null 2>&1; then
            log_info "Opening coverage report in browser..."
            open coverage/lcov-report/index.html >/dev/null 2>&1 &
        else
            log_info "Coverage report available at: backend/coverage/lcov-report/index.html"
        fi
    else
        log_error "Coverage generation failed"
        cd ..
        return 1
    fi
    
    cd ..
    return 0
}

# Watch mode
run_watch_mode() {
    log_section "Running Tests in Watch Mode"
    log_info "Press Ctrl+C to exit watch mode"
    
    cd backend
    
    if [[ "$RUN_UNIT" == true ]] && [[ "$RUN_INTEGRATION" == false ]] && [[ "$RUN_E2E" == false ]] && [[ "$RUN_BDD" == false ]]; then
        npm run test:watch
    else
        log_warning "Watch mode works best with unit tests only"
        log_info "Running: npm test -- --watch"
        npm test -- --watch
    fi
    
    cd ..
}

# Main execution
main() {
    local script_start_time=$(date +%s)
    
    log_section "Auction Helper - Development Test Runner"
    log_info "Starting test execution..."
    
    # Preliminary checks
    check_project_root
    check_backend
    ensure_dependencies
    start_services
    
    # Handle watch mode
    if [[ "$WATCH" == true ]]; then
        run_watch_mode
        return $?
    fi
    
    # Handle parallel execution
    if [[ "$PARALLEL" == true ]]; then
        if run_parallel; then
            local script_end_time=$(date +%s)
            local total_duration=$((script_end_time - script_start_time))
            log_success "All tests completed successfully in ${total_duration}s"
        else
            local script_end_time=$(date +%s)
            local total_duration=$((script_end_time - script_start_time))
            log_error "Some tests failed (total time: ${total_duration}s)"
            exit 1
        fi
    else
        # Sequential execution
        local failed_suites=()
        
        # Run each test suite
        if [[ "$RUN_UNIT" == true ]]; then
            if ! run_test_suite "Unit" "npm run test:unit" "backend"; then
                failed_suites+=("Unit")
                [[ "$BAIL_ON_FAILURE" == true ]] && exit 1
            fi
        fi
        
        if [[ "$RUN_INTEGRATION" == true ]]; then
            if ! run_test_suite "Integration" "npm run test:integration" "backend"; then
                failed_suites+=("Integration")
                [[ "$BAIL_ON_FAILURE" == true ]] && exit 1
            fi
        fi
        
        if [[ "$RUN_BDD" == true ]]; then
            if ! run_test_suite "BDD" "npm run test:bdd" "backend"; then
                failed_suites+=("BDD")
                [[ "$BAIL_ON_FAILURE" == true ]] && exit 1
            fi
        fi
        
        if [[ "$RUN_E2E" == true ]]; then
            if ! run_test_suite "E2E" "npm run test:e2e" "backend"; then
                failed_suites+=("E2E")
                [[ "$BAIL_ON_FAILURE" == true ]] && exit 1
            fi
        fi
        
        # Report results
        local script_end_time=$(date +%s)
        local total_duration=$((script_end_time - script_start_time))
        
        if [[ ${#failed_suites[@]} -eq 0 ]]; then
            log_success "All tests completed successfully in ${total_duration}s"
        else
            log_error "Failed test suites: ${failed_suites[*]} (total time: ${total_duration}s)"
            exit 1
        fi
    fi
    
    # Generate coverage if requested
    if [[ "$RUN_COVERAGE" == true ]]; then
        if ! generate_coverage; then
            exit 1
        fi
    fi
    
    log_section "Test Execution Complete"
    log_success "All requested tests have been executed"
}

# Run main function
main "$@"