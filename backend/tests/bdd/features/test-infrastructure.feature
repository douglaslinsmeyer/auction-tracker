Feature: Test Infrastructure
  As a developer
  I want to verify the BDD test infrastructure
  So that I can write reliable tests

  Scenario: Basic test setup works
    Given the test environment is ready
    When I run a simple test
    Then the test should pass

  Scenario: Storage mock works correctly
    Given storage is initialized
    When I save data to storage
    Then I should be able to retrieve it

  Scenario: Server starts successfully
    Given the server is started
    When I check the server status
    Then it should be running