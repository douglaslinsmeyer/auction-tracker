#!/bin/bash

# BDD Test Execution Script
# Runs all BDD features with proper organization

echo "========================================="
echo "Running Nellis Auction Backend BDD Tests"
echo "========================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results directory
RESULTS_DIR="test-results/bdd"
mkdir -p $RESULTS_DIR

# Function to run a feature and track results
run_feature() {
    local feature_name=$1
    local feature_path=$2
    
    echo -e "\n${YELLOW}Running: $feature_name${NC}"
    echo "Path: $feature_path"
    
    # Run the feature and capture result
    if npx cucumber-js "$feature_path" \
        --require tests/bdd/step-definitions \
        --require tests/bdd/support \
        --format json:$RESULTS_DIR/${feature_name}.json \
        --format progress \
        2>&1 | tee $RESULTS_DIR/${feature_name}.log; then
        echo -e "${GREEN}✓ $feature_name passed${NC}"
        return 0
    else
        echo -e "${RED}✗ $feature_name failed${NC}"
        return 1
    fi
}

# Track overall results
TOTAL=0
PASSED=0
FAILED=0

# High Priority Features
echo -e "\n${YELLOW}=== HIGH PRIORITY FEATURES ===${NC}"

run_feature "core-monitoring" "tests/bdd/features/auction-monitoring/core-monitoring.feature"
((TOTAL++)); [ $? -eq 0 ] && ((PASSED++)) || ((FAILED++))

run_feature "bidding-strategies" "tests/bdd/features/bidding-strategies/bidding-strategies.feature"
((TOTAL++)); [ $? -eq 0 ] && ((PASSED++)) || ((FAILED++))

run_feature "authentication" "tests/bdd/features/authentication/authentication.feature"
((TOTAL++)); [ $? -eq 0 ] && ((PASSED++)) || ((FAILED++))

run_feature "websocket" "tests/bdd/features/websocket/websocket-communication.feature"
((TOTAL++)); [ $? -eq 0 ] && ((PASSED++)) || ((FAILED++))

# Medium Priority Features
echo -e "\n${YELLOW}=== MEDIUM PRIORITY FEATURES ===${NC}"

run_feature "performance" "tests/bdd/features/performance/performance-reliability.feature"
((TOTAL++)); [ $? -eq 0 ] && ((PASSED++)) || ((FAILED++))

run_feature "edge-cases" "tests/bdd/features/edge-cases/edge-cases.feature"
((TOTAL++)); [ $? -eq 0 ] && ((PASSED++)) || ((FAILED++))

# Low Priority Features
echo -e "\n${YELLOW}=== LOW PRIORITY FEATURES ===${NC}"

run_feature "integration" "tests/bdd/features/integration/integration-flows.feature"
((TOTAL++)); [ $? -eq 0 ] && ((PASSED++)) || ((FAILED++))

# Generate summary report
echo -e "\n========================================="
echo "BDD TEST SUMMARY"
echo "========================================="
echo -e "Total Features: $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "Success Rate: $(( PASSED * 100 / TOTAL ))%"
echo "========================================="

# Generate HTML report if all tests pass
if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed! Generating HTML report...${NC}"
    npx cucumber-html-reporter \
        --source $RESULTS_DIR/*.json \
        --dest $RESULTS_DIR \
        --name "Nellis Auction Backend BDD Tests" \
        --title "BDD Test Report" \
        2>/dev/null || echo "HTML reporter not installed"
else
    echo -e "\n${RED}Some tests failed. Check logs in $RESULTS_DIR${NC}"
    exit 1
fi

echo -e "\n✨ BDD test execution complete!"