#!/bin/bash

# Comprehensive test runner for all test suites
# Handles unit, integration, E2E, and BDD tests with proper error handling

set -e

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
VERBOSE=false

# Parse command line arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --no-unit) RUN_UNIT=false ;;
        --no-integration) RUN_INTEGRATION=false ;;
        --no-e2e) RUN_E2E=false ;;
        --no-bdd) RUN_BDD=false ;;
        --coverage) RUN_COVERAGE=true ;;
        --verbose) VERBOSE=true ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --no-unit         Skip unit tests"
            echo "  --no-integration  Skip integration tests"
            echo "  --no-e2e          Skip E2E tests"
            echo "  --no-bdd          Skip BDD tests"
            echo "  --coverage        Run with coverage"
            echo "  --verbose         Show detailed output"
            echo "  --help            Show this help message"
            exit 0
            ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# Function to run a test suite
run_test_suite() {
    local suite_name=$1
    local test_command=$2
    
    echo -e "\n${BLUE}Running ${suite_name} tests...${NC}"
    
    if $VERBOSE; then
        if $test_command; then
            echo -e "${GREEN}✓ ${suite_name} tests passed${NC}"
            return 0
        else
            echo -e "${RED}✗ ${suite_name} tests failed${NC}"
            return 1
        fi
    else
        # Capture output for non-verbose mode
        local output_file=$(mktemp)
        if $test_command > "$output_file" 2>&1; then
            echo -e "${GREEN}✓ ${suite_name} tests passed${NC}"
            rm -f "$output_file"
            return 0
        else
            echo -e "${RED}✗ ${suite_name} tests failed${NC}"
            echo -e "${YELLOW}Output:${NC}"
            cat "$output_file"
            rm -f "$output_file"
            return 1
        fi
    fi
}

# Track overall status
FAILED_SUITES=()
PASSED_SUITES=()

# Run unit tests
if $RUN_UNIT; then
    if run_test_suite "Unit" "npm run test:unit"; then
        PASSED_SUITES+=("Unit")
    else
        FAILED_SUITES+=("Unit")
    fi
fi

# Run integration tests
if $RUN_INTEGRATION; then
    if run_test_suite "Integration" "npm run test:integration"; then
        PASSED_SUITES+=("Integration")
    else
        FAILED_SUITES+=("Integration")
    fi
fi

# Run E2E tests (with special handling for server startup)
if $RUN_E2E; then
    echo -e "\n${BLUE}Preparing for E2E tests...${NC}"
    
    # Check if server is already running
    if lsof -i:3000 > /dev/null 2>&1; then
        echo -e "${YELLOW}Warning: Port 3000 is already in use. E2E tests may fail.${NC}"
    fi
    
    # Install Puppeteer browser if needed
    if ! npx puppeteer browsers list 2>/dev/null | grep -q chrome; then
        echo -e "${YELLOW}Installing Chrome browser for Puppeteer...${NC}"
        npx puppeteer browsers install chrome
    fi
    
    if run_test_suite "E2E" "npm run test:e2e"; then
        PASSED_SUITES+=("E2E")
    else
        FAILED_SUITES+=("E2E")
        echo -e "${YELLOW}Note: E2E tests require Chrome browser. Run 'npx puppeteer browsers install chrome' if not installed.${NC}"
    fi
fi

# Run BDD tests
if $RUN_BDD; then
    if run_test_suite "BDD" "npm run test:bdd"; then
        PASSED_SUITES+=("BDD")
    else
        FAILED_SUITES+=("BDD")
    fi
fi

# Summary
echo -e "\n${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"

if [ ${#PASSED_SUITES[@]} -gt 0 ]; then
    echo -e "${GREEN}Passed:${NC}"
    for suite in "${PASSED_SUITES[@]}"; do
        echo -e "  ${GREEN}✓ ${suite}${NC}"
    done
fi

if [ ${#FAILED_SUITES[@]} -gt 0 ]; then
    echo -e "${RED}Failed:${NC}"
    for suite in "${FAILED_SUITES[@]}"; do
        echo -e "  ${RED}✗ ${suite}${NC}"
    done
fi

# Coverage report
if $RUN_COVERAGE && [ ${#FAILED_SUITES[@]} -eq 0 ]; then
    echo -e "\n${BLUE}Generating coverage report...${NC}"
    npm run test:coverage
fi

# Exit with appropriate code
if [ ${#FAILED_SUITES[@]} -gt 0 ]; then
    exit 1
else
    echo -e "\n${GREEN}All tests passed!${NC}"
    exit 0
fi