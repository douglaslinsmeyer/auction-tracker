const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('chai');
const storage = require('../../../src/services/storage');

Given('the test environment is ready', function () {
  expect(this).to.exist;
  expect(this.baseUrl).to.exist;
});

When('I run a simple test', function () {
  this.testResult = 'passed';
});

Then('the test should pass', function () {
  expect(this.testResult).to.equal('passed');
});

Given('storage is initialized', function () {
  expect(storage.redis).to.exist;
  expect(storage.connected).to.be.true;
});

When('I save data to storage', async function () {
  await storage.saveAuction('test-auction', {
    id: 'test-auction',
    title: 'Test Auction',
    currentBid: 100
  });
});

Then('I should be able to retrieve it', async function () {
  const auction = await storage.getAuction('test-auction');
  expect(auction).to.exist;
  expect(auction.id).to.equal('test-auction');
  expect(auction.title).to.equal('Test Auction');
  expect(auction.currentBid).to.equal(100);
});

Given('the server is started', function () {
  expect(this.server).to.exist;
  expect(this.serverPort).to.be.a('number');
});

When('I check the server status', function () {
  this.serverListening = this.server.listening;
});

Then('it should be running', function () {
  expect(this.serverListening).to.be.true;
});