# Gherkin Best Practices for Nellis Auction Helper

This document provides comprehensive guidelines for writing effective Gherkin scenarios for the Nellis Auction Helper project, based on Cucumber.io documentation and industry best practices.

## Table of Contents
1. [Gherkin Fundamentals](#gherkin-fundamentals)
2. [BDD Core Practices](#bdd-core-practices)
3. [Writing Effective Scenarios](#writing-effective-scenarios)
4. [Scenario Organization](#scenario-organization)
5. [Step Definition Best Practices](#step-definition-best-practices)
6. [Auction-Specific Examples](#auction-specific-examples)
7. [Common Anti-Patterns](#common-anti-patterns)
8. [Test Organization](#test-organization)

## Gherkin Fundamentals

### What is Gherkin?
Gherkin is a business-readable language for describing software behavior without detailing implementation. It serves as:
- **Living Documentation**: Always up-to-date specification of system behavior
- **Executable Specifications**: Scenarios that can be automated as tests
- **Communication Bridge**: Common language between business and technical stakeholders

### Core Keywords
```gherkin
Feature: High-level description of a software feature
  Rule: Business rule (optional, Gherkin v6+)
    Background: Steps that run before each scenario
    
    Scenario: Concrete example illustrating a business rule
      Given [initial context/preconditions]
      When [event or action]
      Then [expected outcome]
      And [additional condition]
      But [contrasting condition]
    
    Scenario Outline: Template with multiple data sets
      Given [parameterized step]
      When [action with <parameter>]
      Then [outcome with <result>]
      
      Examples:
        | parameter | result |
        | value1    | output1 |
        | value2    | output2 |
```

## BDD Core Practices

### The Three Amigos Approach
1. **Discovery**: Collaborative workshops to explore requirements
2. **Formulation**: Document examples in Gherkin format
3. **Automation**: Transform examples into automated tests

### Key Principles
- Focus on **behavior**, not implementation
- Use **concrete examples** to illustrate rules
- Maintain **shared understanding** across the team
- Work in **small iterations** for rapid feedback

## Writing Effective Scenarios

### 1. Use Declarative Style (Not Imperative)

❌ **Imperative (Bad)**:
```gherkin
Given I navigate to "https://nellisauction.com"
When I click on the "Login" button
And I type "user@example.com" in the "email" field
And I type "password123" in the "password" field
And I click the "Submit" button
Then I should see "Welcome" text
```

✅ **Declarative (Good)**:
```gherkin
Given I am a registered user
When I log in with valid credentials
Then I should see the dashboard
```

### 2. Keep Scenarios Concise
- Aim for 3-5 steps per scenario
- Single-digit step count (<10) maximum
- Each scenario should test one behavior

### 3. Write from the User's Perspective
```gherkin
Feature: Auction Bidding
  As an auction participant
  I want to place bids on items
  So that I can win auctions

  Scenario: Successful bid placement
    Given I am monitoring auction "12345"
    When I place a bid of $100
    Then my bid should be accepted
    And I should be the current high bidder
```

### 4. Use Business Language
- Avoid technical jargon
- Use domain-specific terminology
- Write for non-technical stakeholders

### 5. Be Specific About Outcomes
```gherkin
# ❌ Vague
Then the bid should work

# ✅ Specific
Then my bid of $100 should be accepted
And the auction high bid should be $100
And I should receive a bid confirmation
```

## Scenario Organization

### Feature File Structure
```
features/
├── auction_monitoring/
│   ├── start_monitoring.feature
│   ├── stop_monitoring.feature
│   └── monitor_multiple_auctions.feature
├── bidding/
│   ├── manual_bidding.feature
│   ├── aggressive_strategy.feature
│   └── last_second_strategy.feature
├── authentication/
│   ├── login.feature
│   └── cookie_sync.feature
└── step_definitions/
    ├── auction_steps.js
    ├── bidding_steps.js
    └── common_steps.js
```

### Using Tags Effectively
```gherkin
@smoke @critical
Feature: Core Auction Monitoring

  @authentication @security
  Scenario: Secure authentication required
    
  @bidding @last-second
  Scenario: Last second bid placement
    
  @integration @nellis-api
  Scenario: API connection handling
```

### Background for Shared Context
```gherkin
Feature: Auction Bidding Strategies

  Background:
    Given I am logged in as "test@example.com"
    And I have a maximum bid limit of $500
    And the following auction exists:
      | ID    | Title           | Current Bid |
      | 12345 | Vintage Camera  | $50        |
    
  Scenario: Aggressive bidding strategy
    Given I am using the aggressive bidding strategy
    When another user bids $75
    Then I should automatically bid $80
```

## Step Definition Best Practices

### 1. Use Cucumber Expressions
```javascript
// Prefer Cucumber Expressions
Given('I have {int} items in my watchlist', (itemCount) => {
  // implementation
});

// Over complex regex
Given(/^I have (\d+) items in my watchlist$/, (itemCount) => {
  // implementation
});
```

### 2. Create Custom Parameter Types
```javascript
defineParameterType({
  name: 'auctionId',
  regexp: /[A-Z0-9]{5,}/,
  transformer: id => new AuctionId(id)
});

// Usage in step
Given('I am monitoring auction {auctionId}', (auctionId) => {
  // auctionId is already transformed to AuctionId object
});
```

### 3. Organize by Domain
```javascript
// auction_steps.js
Given('an auction {string} exists', (auctionId) => {
  // Create auction
});

// bidding_steps.js  
When('I place a bid of ${float}', (amount) => {
  // Place bid
});

// assertion_steps.js
Then('I should be the high bidder', () => {
  // Verify high bidder status
});
```

### 4. Handle State Properly
```javascript
// Use world object for scenario state
Given('I am monitoring {int} auctions', function(count) {
  this.monitoredAuctions = [];
  // Setup monitoring
});

When('I stop monitoring all auctions', function() {
  this.monitoredAuctions.forEach(auction => {
    // Stop monitoring
  });
});
```

## Auction-Specific Examples

### Example 1: Auction Monitoring
```gherkin
Feature: 24/7 Auction Monitoring
  As an auction participant
  I want continuous monitoring of my auctions
  So that I don't miss bidding opportunities

  Scenario: Start monitoring an auction
    Given I am authenticated with Nellis Auction
    And auction "ABC123" exists with current bid $50
    When I start monitoring auction "ABC123"
    Then I should receive real-time updates
    And the auction should appear in my monitored list

  Scenario: Handle 30-second rule
    Given I am monitoring auction "XYZ789"
    And the auction has 25 seconds remaining
    When a new bid is placed
    Then the timer should reset to 30 seconds
    And I should receive an alert about the time extension
```

### Example 2: Bidding Strategies
```gherkin
Feature: Automated Bidding Strategies

  Scenario Outline: Execute bidding strategy
    Given I am monitoring auction "TEST123"
    And I have set my maximum bid to $<max_bid>
    And I am using the <strategy> strategy
    When the current bid is $<current_bid>
    And another user bids $<competitor_bid>
    Then my bid should be <my_action>

    Examples:
      | strategy     | max_bid | current_bid | competitor_bid | my_action         |
      | aggressive   | 200     | 50          | 75            | $80               |
      | aggressive   | 200     | 190         | 195           | $200              |
      | aggressive   | 200     | 195         | 205           | no bid placed     |
      | last_second  | 200     | 50          | 75            | wait for timing   |
      | manual       | 200     | 50          | 75            | wait for user     |
```

### Example 3: WebSocket Connection
```gherkin
Feature: Real-time WebSocket Updates

  Scenario: Maintain persistent connection
    Given I have an active WebSocket connection
    When 25 seconds pass without activity
    Then a heartbeat message should be sent
    And the connection should remain active

  Scenario: Handle connection failures
    Given I am monitoring 3 auctions
    When the WebSocket connection is lost
    Then reconnection should be attempted within 5 seconds
    And monitoring should resume for all 3 auctions
```

## Common Anti-Patterns

### 1. ❌ Testing Implementation Details
```gherkin
# Bad - Implementation specific
When I execute POST request to "/api/bid" with payload {"amount": 100}
Then the Redis cache should contain key "bid:12345"
```

### 2. ❌ Overusing Scenario Outlines
```gherkin
# Bad - Too many variations for UI tests
Scenario Outline: Click every button
  When I click the "<button>" button
  Then I should see "<page>"
  
  Examples: # 50+ rows of buttons
```

### 3. ❌ Mixing Abstraction Levels
```gherkin
# Bad - Inconsistent abstraction
Given I am logged in as a premium user
When I click the xpath "//button[@id='bid-button']"
Then the auction should process my premium bid
```

### 4. ❌ Long Scenarios
```gherkin
# Bad - Too many steps
Scenario: Complete auction process
  Given I register a new account
  And I verify my email
  And I add payment method
  And I search for cameras
  And I filter by vintage
  And I sort by ending soon
  When I find an interesting item
  And I research its value
  And I set a maximum bid
  And I enable notifications
  And I place my first bid
  And I monitor for updates
  And I respond to outbids
  Then I should eventually win
  # ... 20 more steps
```

## Test Organization

### Folder Structure Best Practices
```
nellis-auction-backend/
├── features/
│   ├── api/           # REST API features
│   ├── websocket/     # WebSocket features
│   ├── monitoring/    # Auction monitoring features
│   ├── bidding/       # Bidding strategy features
│   └── support/       # Shared support files
├── step-definitions/
│   ├── api/
│   ├── websocket/
│   ├── domain/
│   └── common/
└── support/
    ├── world.js       # Test context
    ├── hooks.js       # Before/After hooks
    └── helpers/       # Utility functions
```

### Integration with Existing Tests
1. **Unit Tests (TDD)**: Low-level, fast, isolated
2. **Integration Tests**: Component interaction
3. **BDD Scenarios**: High-level, user-focused behavior

### Running Scenarios
```bash
# Run all scenarios
npm run test:bdd

# Run specific tags
npm run test:bdd -- --tags "@smoke"
npm run test:bdd -- --tags "@bidding and not @slow"

# Run in watch mode
npm run test:bdd:watch
```

## Best Practices Summary

1. **Collaborate Early**: Write scenarios during discovery, not after implementation
2. **Focus on Value**: Describe what the system does for users, not how
3. **Keep It Simple**: 3-5 steps per scenario, clear business language
4. **Stay Declarative**: Hide implementation details in step definitions
5. **Organize Thoughtfully**: Group by feature/domain, use tags strategically
6. **Maintain Continuously**: Update scenarios as behavior changes
7. **Automate Wisely**: Not every scenario needs to be automated
8. **Review Regularly**: Scenarios are documentation - keep them current

## Project-Specific Guidelines

For the Nellis Auction Helper project:
1. Always consider the 30-second rule in auction timing scenarios
2. Test both connected and disconnected states for 24/7 monitoring
3. Include cookie synchronization in authentication scenarios
4. Consider rate limiting in high-frequency operation scenarios
5. Test circuit breaker behavior for API resilience
6. Verify WebSocket heartbeat for service worker persistence
7. Test all three bidding strategies with edge cases
8. Include multi-auction monitoring scenarios
9. Test storage fallback (Redis → in-memory)
10. Verify proper cleanup of completed auctions

Remember: Good Gherkin scenarios serve as living documentation that helps the entire team understand and verify system behavior.