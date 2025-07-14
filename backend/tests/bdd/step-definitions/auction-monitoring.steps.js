/**
 * Step definitions for auction monitoring features
 */

const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('chai');
const WebSocket = require('ws');

// Given steps

Given('I am authenticated with a valid token', function () {
  // Token is already set in world.authToken via setup
  expect(this.authToken).to.exist;
});

Given('the external auction API is available', function () {
  // This is handled by the @mock-api hook
  // In real tests, we could check API availability here
});

Given('I have a WebSocket connection', async function () {
  this.ws = await this.createWebSocketConnection(true);
  expect(this.ws).to.exist;
  expect(this.ws.readyState).to.equal(WebSocket.OPEN);
});

Given('I am already monitoring auction {string}', async function (auctionId) {
  // Start monitoring via API first
  const response = await this.makeRequest('POST', `/api/auctions/${auctionId}/monitor`, {
    body: {
      maxBid: 100,
      strategy: 'manual',
      autoBid: false
    }
  });

  expect(response.status).to.equal(200);
  this.monitoredAuctions.set(auctionId, {
    maxBid: 100,
    strategy: 'manual',
    autoBid: false
  });
});

Given('I am not authenticated', function () {
  this.authToken = null;
});

Given('I have already monitored {int} auctions in the last minute', async function (count) {
  // Simulate monitoring multiple auctions quickly
  for (let i = 1; i <= count; i++) {
    await this.makeRequest('POST', `/api/auctions/${i}/monitor`, {
      body: {
        maxBid: 50,
        strategy: 'manual',
        autoBid: false
      }
    });
  }
});

// When steps

When('I send a startMonitoring message for auction {string} with config:', async function (auctionId, dataTable) {
  const config = dataTable.rowsHash();

  const message = {
    type: 'startMonitoring',
    auctionId: auctionId,
    config: {
      maxBid: parseInt(config.maxBid, 10),
      strategy: config.strategy,
      autoBid: config.autoBid === 'true'
    }
  };

  this.ws.send(JSON.stringify(message));

  // Wait for response
  this.lastWsMessage = await this.waitForMessage(this.ws, null, 5000);
});

When('I make a POST request to {string} with body:', async function (path, bodyString) {
  const body = JSON.parse(bodyString);
  // Wrap in config property if this is a monitoring endpoint
  const requestBody = path.includes('/monitor') ? { config: body } : body;
  await this.makeRequest('POST', path, { body: requestBody });
});

When('I make a POST request to {string} without auth token', async function (path) {
  const savedToken = this.authToken;
  this.authToken = null;

  await this.makeRequest('POST', path, {
    body: {
      maxBid: 100,
      strategy: 'manual'
    }
  });

  this.authToken = savedToken;
});

When('I try to monitor another auction {string}', async function (auctionId) {
  await this.makeRequest('POST', `/api/auctions/${auctionId}/monitor`, {
    body: {
      maxBid: 50,
      strategy: 'manual',
      autoBid: false
    }
  });
});

// Then steps

Then('I should receive a {string} message', function (messageType) {
  expect(this.lastWsMessage).to.exist;
  expect(this.lastWsMessage.type).to.equal(messageType);
});

Then('I should receive an error message {string}', function (errorCode) {
  expect(this.lastWsMessage).to.exist;
  expect(this.lastWsMessage.type).to.equal('error');
  expect(this.lastWsMessage.code).to.equal(errorCode);
});

Then('the auction {string} should be in the monitored list', async function (auctionId) {
  const response = await this.makeRequest('GET', '/api/auctions');
  expect(response.status).to.equal(200);

  const auctions = response.data.data;
  const auction = auctions.find(a => a.id === auctionId);
  expect(auction).to.exist;
});

Then('the auction should have the correct configuration', async function () {
  const response = await this.makeRequest('GET', '/api/auctions');
  const auction = response.data.data[0];

  expect(auction.config).to.exist;
  expect(auction.config.maxBid).to.be.a('number');
  expect(auction.config.strategy).to.be.oneOf(['manual', 'increment', 'aggressive', 'sniping']);
  expect(auction.config.autoBid).to.be.a('boolean');
});

Then('the response status should be {int}', function (expectedStatus) {
  this.assertResponseStatus(expectedStatus);
});

Then('the response should contain:', function (dataTable) {
  const expected = dataTable.rowsHash();
  const data = this.getResponseData();

  for (const [key, value] of Object.entries(expected)) {
    if (value === 'true') {
      expect(data[key]).to.be.true;
    } else if (value === 'false') {
      expect(data[key]).to.be.false;
    } else {
      expect(data[key]).to.equal(value);
    }
  }
});

Then('the auction {string} should still have its original configuration', async function (auctionId) {
  const response = await this.makeRequest('GET', `/api/auctions/${auctionId}`);
  const auction = response.data.data;

  const originalConfig = this.monitoredAuctions.get(auctionId);
  expect(auction.config.maxBid).to.equal(originalConfig.maxBid);
  expect(auction.config.strategy).to.equal(originalConfig.strategy);
  expect(auction.config.autoBid).to.equal(originalConfig.autoBid);
});

Then('the response should contain validation errors for:', function (dataTable) {
  const data = this.getResponseData();
  expect(data.error).to.exist;
  expect(data.details).to.be.an('array');

  const expectedErrors = dataTable.hashes();
  for (const expectedError of expectedErrors) {
    const actualError = data.details.find(e => e.path.includes(expectedError.field));
    expect(actualError).to.exist;
    expect(actualError.message.toLowerCase()).to.include(expectedError.error.toLowerCase());
  }
});

Then('the auction {string} should be saved in Redis', async function (auctionId) {
  const testRedis = require('../__support__/testRedis');
  const exists = await testRedis.exists(`auction:${auctionId}`);
  expect(exists).to.be.true;
});

Then('the Redis data should include:', async function (dataTable) {
  const expected = dataTable.rowsHash();
  const auctionId = expected.id;

  const testRedis = require('../__support__/testRedis');
  const data = await testRedis.get(`auction:${auctionId}`);

  expect(data).to.exist;
  expect(data.id).to.equal(expected.id);
  expect(data.config.maxBid).to.equal(parseInt(expected.maxBid, 10));
  expect(data.config.strategy).to.equal(expected.strategy);
});