/**
 * Cucumber configuration
 */

module.exports = {
  default: {
    paths: [
      'tests/features/auction-monitoring/**/*.feature', 
      'tests/features/bidding-strategies/**/*.feature',
      'tests/features/performance/**/*.feature'
    ],
    require: [
      'tests/step-definitions/**/*.steps.js',
      'tests/features/step_definitions/**/*.steps.js',
      'tests/support/**/*.js'
    ],
    format: [
      'progress-bar',
      'json:coverage/cucumber-report.json',
      'html:coverage/cucumber-report.html'
    ],
    formatOptions: {
      snippetInterface: 'async-await'
    },
  },
  
  // CI configuration with more detailed output
  ci: {
    paths: [
      'tests/features/auction-monitoring/**/*.feature', 
      'tests/features/bidding-strategies/**/*.feature',
      'tests/features/performance/**/*.feature'
    ],
    require: [
      'tests/step-definitions/**/*.steps.js',
      'tests/features/step_definitions/**/*.steps.js',
      'tests/support/**/*.js'
    ],
    format: [
      'progress',
      'json:coverage/cucumber-report.json',
      'junit:coverage/cucumber-junit.xml'
    ],
    formatOptions: {
      snippetInterface: 'async-await'
    },
    publishQuiet: true,
    retry: 1
  }
};