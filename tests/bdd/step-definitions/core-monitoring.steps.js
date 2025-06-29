const { Given, When, Then, Before } = require('@cucumber/cucumber');
const { expect } = require('chai');
const sinon = require('sinon');
const AuctionFactory = require('../../__support__/factories/auctionFactory');
const auctionMonitor = require('../../../src/services/auctionMonitor');
const nellisApi = require('../../../src/services/nellisApi');
const storage = require('../../../src/services/storage');

// Store mocked auctions
let mockedAuctions = {};

Before(function() {
  // Reset mocked auctions before each scenario
  mockedAuctions = {};
  
  // Stub nellisApi.getAuctionData to return our test data
  if (!nellisApi.getAuctionData.restore) {
    sinon.stub(nellisApi, 'getAuctionData').callsFake(async (auctionId) => {
      if (mockedAuctions[auctionId]) {
        return mockedAuctions[auctionId];
      }
      throw new Error(`Auction ${auctionId} not found`);
    });
  }
});

// Given steps

Given('I am authenticated with the auction system', function() {
  // Authentication is handled in world setup
  expect(this.authToken).to.exist;
});

Given('the auction service is running', function() {
  expect(this.server).to.exist;
  expect(this.server.listening).to.be.true;
});

Given('auction {string} exists with current bid of ${int}', function(auctionId, currentBid) {
  mockedAuctions[auctionId] = AuctionFactory.create({
    id: auctionId,
    currentBid: currentBid,
    status: 'active'
  });
});

Given('I am monitoring auction {string}', async function(auctionId) {
  // Create auction if it doesn't exist
  if (!mockedAuctions[auctionId]) {
    mockedAuctions[auctionId] = AuctionFactory.create({ id: auctionId });
  }
  
  // Start monitoring via the service
  await auctionMonitor.addAuction(auctionId, {
    maxBid: 100,
    strategy: 'manual',
    autoBid: false
  });
  
  // Verify it's being monitored
  const auctions = auctionMonitor.getMonitoredAuctions();
  expect(auctions.some(a => a.id === auctionId)).to.be.true;
});

Given('I am monitoring auction {string} with max bid of ${int}', async function(auctionId, maxBid) {
  // Create auction if it doesn't exist
  if (!mockedAuctions[auctionId]) {
    mockedAuctions[auctionId] = AuctionFactory.create({ id: auctionId });
  }
  
  await auctionMonitor.addAuction(auctionId, {
    maxBid: maxBid,
    strategy: 'manual',
    autoBid: false
  });
});

Given('I am monitoring auction {string} in {string} state', async function(auctionId, state) {
  mockedAuctions[auctionId] = AuctionFactory.create({
    id: auctionId,
    status: state
  });
  
  await auctionMonitor.addAuction(auctionId, {
    maxBid: 100,
    strategy: 'manual',
    autoBid: false
  });
});

// When steps

When('I start monitoring auction {string} with max bid of ${int}', async function(auctionId, maxBid) {
  try {
    const response = await this.makeRequest('POST', `/api/auctions/${auctionId}/monitor`, {
      body: {
        config: {
          maxBid: maxBid,
          strategy: 'manual',
          autoBid: false
        }
      }
    });
    this.lastMonitorResponse = response;
  } catch (error) {
    this.lastError = error;
  }
});

When('I try to start monitoring auction {string} again', async function(auctionId) {
  try {
    const response = await this.makeRequest('POST', `/api/auctions/${auctionId}/monitor`, {
      body: {
        config: {
          maxBid: 200,
          strategy: 'manual',
          autoBid: false
        }
      }
    });
    this.lastMonitorResponse = response;
  } catch (error) {
    this.lastError = error;
  }
});

When('I stop monitoring auction {string}', async function(auctionId) {
  const response = await this.makeRequest('POST', `/api/auctions/${auctionId}/stop`);
  this.lastStopResponse = response;
});

When('I try to start monitoring auction {string}', async function(auctionId) {
  try {
    const response = await this.makeRequest('POST', `/api/auctions/${auctionId}/monitor`, {
      body: {
        config: {
          maxBid: 100,
          strategy: 'manual',
          autoBid: false
        }
      }
    });
    this.lastMonitorResponse = response;
  } catch (error) {
    this.lastError = error;
  }
});

When('I try to start monitoring auction {string} with invalid max bid of {int}', async function(auctionId, maxBid) {
  try {
    const response = await this.makeRequest('POST', `/api/auctions/${auctionId}/monitor`, {
      body: {
        config: {
          maxBid: maxBid,
          strategy: 'manual',
          autoBid: false
        }
      }
    });
    this.lastMonitorResponse = response;
  } catch (error) {
    this.lastError = error;
  }
});

When('the auction service restarts', async function() {
  // Simulate restart by shutting down and reinitializing
  auctionMonitor.shutdown();
  await auctionMonitor.initialize(null, () => {});
});

When('auction {string} transitions to {string} state', function(auctionId, newState) {
  if (mockedAuctions[auctionId]) {
    mockedAuctions[auctionId].status = newState;
    if (newState === 'ending') {
      mockedAuctions[auctionId].timeLeft = 30;
    } else if (newState === 'ended') {
      mockedAuctions[auctionId].timeLeft = 0;
      mockedAuctions[auctionId].endedAt = new Date();
    }
  }
});

When('the auction API becomes unavailable', function() {
  // Stub the API to throw errors
  nellisApi.getAuctionData.restore();
  sinon.stub(nellisApi, 'getAuctionData').rejects(new Error('API unavailable'));
});

When('the auction API becomes available again', function() {
  // Restore normal API behavior
  nellisApi.getAuctionData.restore();
  sinon.stub(nellisApi, 'getAuctionData').callsFake(async (auctionId) => {
    if (mockedAuctions[auctionId]) {
      return mockedAuctions[auctionId];
    }
    throw new Error(`Auction ${auctionId} not found`);
  });
});

// Then steps

Then('auction {string} should be actively monitored', function(auctionId) {
  const auction = auctionMonitor.monitoredAuctions.get(auctionId);
  expect(auction).to.exist;
  expect(auction.status).to.not.equal('error');
});

Then('I should receive real-time updates for auction {string}', function(auctionId) {
  expect(this.lastMonitorResponse.status).to.equal(200);
  expect(this.lastMonitorResponse.data.message).to.include('Started monitoring');
});

Then('the auction data should be persisted in storage', async function() {
  const auctionId = Object.keys(mockedAuctions)[0];
  const storedAuction = await storage.getAuction(auctionId);
  expect(storedAuction).to.exist;
  expect(storedAuction.id).to.equal(auctionId);
});

Then('I should be monitoring {int} auctions', function(count) {
  expect(auctionMonitor.monitoredAuctions.size).to.equal(count);
});

Then('each auction should update independently', function() {
  // Verify each auction has its own polling interval
  const auctionIds = Array.from(auctionMonitor.monitoredAuctions.keys());
  auctionIds.forEach(id => {
    expect(auctionMonitor.pollingIntervals.has(id)).to.be.true;
  });
});

Then('auction {string} should not be monitored', function(auctionId) {
  const auction = auctionMonitor.monitoredAuctions.get(auctionId);
  expect(auction).to.not.exist;
});

Then('I should not receive updates for auction {string}', function(auctionId) {
  expect(auctionMonitor.pollingIntervals.has(auctionId)).to.be.false;
});

Then('the auction should be removed from storage', async function() {
  const auctionId = Object.keys(mockedAuctions)[0];
  const storedAuction = await storage.getAuction(auctionId);
  expect(storedAuction).to.be.null;
});

Then('I should receive an error {string}', function(errorMessage) {
  expect(this.lastResponse.status).to.be.at.least(400);
  expect(this.lastResponse.data.error).to.include(errorMessage);
});

Then('auction {string} should remain monitored with original settings', function(auctionId) {
  const auction = auctionMonitor.monitoredAuctions.get(auctionId);
  expect(auction).to.exist;
  expect(auction.maxBid).to.equal(100); // Original max bid
});

Then('I should receive a validation error {string}', function(errorMessage) {
  expect(this.lastResponse.status).to.equal(400);
  expect(this.lastResponse.data.error).to.include(errorMessage);
});

Then('auction {string} should still be monitored', function(auctionId) {
  const auction = auctionMonitor.monitoredAuctions.get(auctionId);
  expect(auction).to.exist;
});

Then('all settings should be preserved', function() {
  const auctions = Array.from(auctionMonitor.monitoredAuctions.values());
  auctions.forEach(auction => {
    expect(auction.maxBid).to.exist;
    expect(auction.strategy).to.exist;
  });
});

Then('the auction state should be updated to {string}', function(state) {
  const auctionId = Object.keys(mockedAuctions)[0];
  const auction = auctionMonitor.monitoredAuctions.get(auctionId);
  expect(auction.status).to.equal(state);
});

Then('the appropriate bidding strategy should activate', function() {
  // This would be tested more thoroughly in bidding strategy tests
  const auctionId = Object.keys(mockedAuctions)[0];
  const auction = auctionMonitor.monitoredAuctions.get(auctionId);
  expect(auction.strategy).to.exist;
});

Then('monitoring should stop automatically', function() {
  const auctionId = Object.keys(mockedAuctions)[0];
  const auction = auctionMonitor.monitoredAuctions.get(auctionId);
  expect(auction).to.not.exist;
});

Then('final results should be recorded', async function() {
  const auctionId = Object.keys(mockedAuctions)[0];
  const storedAuction = await storage.getAuction(auctionId);
  expect(storedAuction).to.exist;
  expect(storedAuction.endedAt).to.exist;
});

Then('auction {string} should remain in monitored list', function(auctionId) {
  expect(auctionMonitor.monitoredAuctions.has(auctionId)).to.be.true;
});

Then('an error state should be recorded', function() {
  const auctionId = Object.keys(mockedAuctions)[0];
  const auction = auctionMonitor.monitoredAuctions.get(auctionId);
  expect(auction.lastError).to.exist;
});

Then('monitoring should resume automatically', function() {
  // In a real test, we'd wait and verify polling resumes
  const auctionId = Object.keys(mockedAuctions)[0];
  expect(auctionMonitor.pollingIntervals.has(auctionId)).to.be.true;
});

Then('no monitoring should be started', function() {
  expect(this.lastResponse.status).to.be.at.least(400);
  // Verify no new auctions were added
  const currentCount = auctionMonitor.monitoredAuctions.size;
  expect(currentCount).to.equal(0);
});

module.exports = { mockedAuctions };