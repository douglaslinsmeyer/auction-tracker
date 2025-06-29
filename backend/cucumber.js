/**
 * Cucumber configuration
 */

module.exports = {
  default: {
    paths: [
      'tests/bdd/features/**/*.feature'
    ],
    require: [
      'tests/bdd/step-definitions/**/*.steps.js',
      'tests/bdd/support/**/*.js'
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
      'tests/bdd/features/**/*.feature'
    ],
    require: [
      'tests/bdd/step-definitions/**/*.steps.js',
      'tests/bdd/support/**/*.js'
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