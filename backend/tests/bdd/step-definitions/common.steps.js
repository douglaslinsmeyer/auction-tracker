const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('chai');

// Common Given steps used across multiple features

Given('I am authenticated with the auction system', function () {
  // Authentication is handled in world setup
  expect(this.authToken).to.exist;
  this.isAuthenticated = true;
});

Given('the auction service is running', function () {
  expect(this.server).to.exist;
  expect(this.server.listening).to.be.true;
});

Given('I am authenticated', function () {
  expect(this.authToken).to.exist;
  this.isAuthenticated = true;
});

// Common error handling steps

Then('I should receive an error {string}', function (errorMessage) {
  const error = this.lastError || this.lastResponse;
  expect(error).to.exist;

  if (error.status) {
    expect(error.status).to.be.at.least(400);
  }

  const errorData = error.data || error;
  expect(errorData.error || errorData.message).to.include(errorMessage);
});

Then('the operation should succeed', function () {
  const response = this.lastResponse || this.lastMonitorResponse;
  expect(response).to.exist;
  expect(response.status).to.equal(200);
});

Then('the operation should fail', function () {
  const response = this.lastResponse || this.lastError;
  expect(response).to.exist;

  if (response.status) {
    expect(response.status).to.be.at.least(400);
  }
});

// Common request steps

When('I wait for {int} seconds', async function (seconds) {
  await new Promise(resolve => setTimeout(resolve, seconds * 1000));
});

When('I wait for {int} milliseconds', async function (milliseconds) {
  await new Promise(resolve => setTimeout(resolve, milliseconds));
});

// Common assertion helpers

Then('the response should have status {int}', function (statusCode) {
  const response = this.lastResponse || this.lastMonitorResponse || this.lastAuthResponse;
  expect(response).to.exist;
  expect(response.status).to.equal(statusCode);
});

Then('the response should contain {string}', function (content) {
  const response = this.lastResponse || this.lastMonitorResponse || this.lastAuthResponse;
  expect(response).to.exist;

  const responseText = JSON.stringify(response.data);
  expect(responseText).to.include(content);
});

Then('the response data should have property {string}', function (property) {
  const response = this.lastResponse || this.lastMonitorResponse || this.lastAuthResponse;
  expect(response).to.exist;
  expect(response.data).to.have.property(property);
});

Then('the response data property {string} should equal {string}', function (property, value) {
  const response = this.lastResponse || this.lastMonitorResponse || this.lastAuthResponse;
  expect(response).to.exist;
  expect(response.data[property]).to.equal(value);
});

Then('the response data property {string} should be {string}', function (property, type) {
  const response = this.lastResponse || this.lastMonitorResponse || this.lastAuthResponse;
  expect(response).to.exist;

  switch (type) {
    case 'true':
      expect(response.data[property]).to.be.true;
      break;
    case 'false':
      expect(response.data[property]).to.be.false;
      break;
    case 'null':
      expect(response.data[property]).to.be.null;
      break;
    case 'undefined':
      expect(response.data[property]).to.be.undefined;
      break;
    case 'array':
      expect(response.data[property]).to.be.an('array');
      break;
    case 'object':
      expect(response.data[property]).to.be.an('object');
      break;
    case 'string':
      expect(response.data[property]).to.be.a('string');
      break;
    case 'number':
      expect(response.data[property]).to.be.a('number');
      break;
    default:
      expect(response.data[property]).to.equal(type);
  }
});