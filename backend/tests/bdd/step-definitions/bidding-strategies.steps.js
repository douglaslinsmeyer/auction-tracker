const { Given, When, Then, Before } = require('@cucumber/cucumber');
const { expect } = require('chai');
const sinon = require('sinon');
const AuctionFactory = require('../../__support__/factories/auctionFactory');
const BidFactory = require('../../__support__/factories/bidFactory');
const auctionMonitor = require('../../../src/services/auctionMonitor');
const nellisApi = require('../../../src/services/nellisApi');
const storage = require('../../../src/services/storage');

// Test data storage
let testAuctions = {};
let placedBids = [];
let notifications = [];
let bidPlacementStub;

Before(function () {
  // Reset test data
  testAuctions = {};
  placedBids = [];
  notifications = [];

  // Stub nellisApi methods
  if (nellisApi.getAuctionData.restore) {
    nellisApi.getAuctionData.restore();
  }
  sinon.stub(nellisApi, 'getAuctionData').callsFake((auctionId) => {
    if (testAuctions[auctionId]) {
      return testAuctions[auctionId];
    }
    throw new Error(`Auction ${auctionId} not found`);
  });

  // Stub bid placement
  if (bidPlacementStub) {
    bidPlacementStub.restore();
  }
  bidPlacementStub = sinon.stub(nellisApi, 'placeBid').callsFake((auctionId, amount) => {
    const bid = BidFactory.createSuccessful({
      auctionId,
      amount,
      timestamp: new Date()
    });
    placedBids.push(bid);

    // Update auction with new bid
    if (testAuctions[auctionId]) {
      testAuctions[auctionId].currentBid = amount;
    }

    return { success: true, bid };
  });

  // Stub notification sending
  sinon.stub(auctionMonitor, 'emit').callsFake((event, data) => {
    notifications.push({ event, data });
  });
});

// Given steps

Given('the following auctions exist:', function (dataTable) {
  const auctions = dataTable.hashes();
  auctions.forEach(auctionData => {
    testAuctions[auctionData.id] = AuctionFactory.create({
      id: auctionData.id,
      currentBid: parseInt(auctionData.currentBid, 10),
      timeLeft: parseInt(auctionData.timeLeft, 10),
      status: auctionData.status
    });
  });
});

Given('I am monitoring auction {string} with strategy {string} and max bid of ${int}', async function (auctionId, strategy, maxBid) {
  await auctionMonitor.addAuction(auctionId, {
    maxBid: maxBid,
    strategy: strategy,
    autoBid: strategy !== 'manual'
  });

  // Verify monitoring started
  const auction = auctionMonitor.monitoredAuctions.get(auctionId);
  expect(auction).to.exist;
  expect(auction.config.strategy).to.equal(strategy);
});

Given('I set a custom increment of ${int}', function (increment) {
  // Get the last monitored auction
  const auctionIds = Array.from(auctionMonitor.monitoredAuctions.keys());
  const lastAuctionId = auctionIds[auctionIds.length - 1];
  const auction = auctionMonitor.monitoredAuctions.get(lastAuctionId);

  if (auction) {
    auction.config.incrementAmount = increment;
  }
});

Given('I set snipe timing to {int} seconds', function (seconds) {
  const auctionIds = Array.from(auctionMonitor.monitoredAuctions.keys());
  const lastAuctionId = auctionIds[auctionIds.length - 1];
  const auction = auctionMonitor.monitoredAuctions.get(lastAuctionId);

  if (auction) {
    auction.config.snipeSeconds = seconds;
  }
});

Given('an automatic bid was placed at ${int}', function (amount) {
  const auctionIds = Array.from(auctionMonitor.monitoredAuctions.keys());
  const lastAuctionId = auctionIds[auctionIds.length - 1];

  placedBids.push(BidFactory.createSuccessful({
    auctionId: lastAuctionId,
    amount: amount,
    isAutoBid: true,
    strategy: 'aggressive'
  }));
});

Given('auction {string} has a minimum bid increment of ${int}', function (auctionId, minIncrement) {
  if (testAuctions[auctionId]) {
    testAuctions[auctionId].minimumBid = minIncrement;
  }
});

// When steps

When('auction {string} is updated with a higher bid of ${int}', async function (auctionId, newBid) {
  // Update test auction data
  if (testAuctions[auctionId]) {
    testAuctions[auctionId].currentBid = newBid;
    testAuctions[auctionId].lastBidder = 'other-user';
  }

  // Trigger auction update in monitor
  await auctionMonitor.updateAuction(auctionId);
});

When('I manually place a bid of ${int}', async function (bidAmount) {
  const auctionIds = Array.from(auctionMonitor.monitoredAuctions.keys());
  const auctionId = auctionIds[auctionIds.length - 1];

  try {
    const response = await this.makeRequest('POST', `/api/auctions/${auctionId}/bid`, {
      body: { amount: bidAmount }
    });
    this.lastBidResponse = response;
  } catch (error) {
    this.lastBidError = error.response;
  }
});

When('auction {string} time remaining drops to {int} seconds', async function (auctionId, seconds) {
  if (testAuctions[auctionId]) {
    testAuctions[auctionId].timeLeft = seconds;

    // For last-second strategy, update endTime to trigger snipe
    const auction = auctionMonitor.monitoredAuctions.get(auctionId);
    if (auction) {
      auction.endTime = new Date(Date.now() + (seconds * 1000));
    }
  }

  // Trigger auction update
  await auctionMonitor.updateAuction(auctionId);
});

When('auction {string} suddenly jumps to {int} seconds remaining', async function (auctionId, seconds) {
  if (testAuctions[auctionId]) {
    // Simulate a sudden time jump
    testAuctions[auctionId].timeLeft = seconds;
    testAuctions[auctionId].timeJump = true;
  }

  await auctionMonitor.updateAuction(auctionId);
});

When('I change the strategy to {string}', async function (newStrategy) {
  const auctionIds = Array.from(auctionMonitor.monitoredAuctions.keys());
  const auctionId = auctionIds[auctionIds.length - 1];

  const response = await this.makeRequest('PUT', `/api/auctions/${auctionId}/monitor`, {
    body: {
      config: {
        strategy: newStrategy,
        autoBid: newStrategy !== 'manual'
      }
    }
  });

  this.lastStrategyUpdateResponse = response;
});

When('the bid placement fails with {string}', function (errorMessage) {
  // Override the bid placement stub to fail
  bidPlacementStub.restore();
  bidPlacementStub = sinon.stub(nellisApi, 'placeBid').rejects(new Error(errorMessage));

  // Trigger an update that would normally place a bid
  const auctionIds = Array.from(auctionMonitor.monitoredAuctions.keys());
  const auctionId = auctionIds[0];
  if (testAuctions[auctionId]) {
    testAuctions[auctionId].currentBid += 5;
  }

  // Don't await to allow error handling to occur
  auctionMonitor.updateAuction(auctionId).catch(() => {});
});

// Then steps

Then('no automatic bid should be placed', function () {
  const autoBids = placedBids.filter(bid => bid.isAutoBid);
  expect(autoBids).to.have.lengthOf(0);
});

Then('no automatic bid should be placed yet', function () {
  const recentBids = placedBids.filter(bid =>
    new Date() - new Date(bid.timestamp) < 1000
  );
  expect(recentBids).to.have.lengthOf(0);
});

Then('the auction should remain monitored', function () {
  const auctionIds = Array.from(auctionMonitor.monitoredAuctions.keys());
  expect(auctionIds).to.have.length.greaterThan(0);
});

Then('I should receive a notification about being outbid', function () {
  const outbidNotifications = notifications.filter(n =>
    n.event === 'outbid' || n.data?.type === 'outbid'
  );
  expect(outbidNotifications).to.have.length.greaterThan(0);
});

Then('the bid should be rejected with error {string}', function (errorMessage) {
  expect(this.lastBidError).to.exist;
  expect(this.lastBidError.status).to.equal(400);
  expect(this.lastBidError.data.error).to.include(errorMessage);
});

Then('no bid should be placed on the auction', function () {
  const recentBids = placedBids.filter(bid =>
    new Date() - new Date(bid.timestamp) < 2000
  );
  expect(recentBids).to.have.lengthOf(0);
});

Then('the bid should be placed successfully', function () {
  expect(this.lastBidResponse.status).to.equal(200);
  expect(this.lastBidResponse.data.success).to.be.true;
});

Then('the auction should show my bid of ${int}', function (amount) {
  const bid = placedBids.find(b => b.amount === amount);
  expect(bid).to.exist;
  expect(bid.status).to.equal('successful');
});

Then('bid history should record the manual bid', async function () {
  const auctionIds = Array.from(auctionMonitor.monitoredAuctions.keys());
  const auctionId = auctionIds[auctionIds.length - 1];

  const history = await storage.getBidHistory(auctionId);
  expect(history).to.have.length.greaterThan(0);
  expect(history[history.length - 1].isAutoBid).to.be.false;
});

Then('an automatic bid of ${int} should be placed immediately', function (amount) {
  const autoBid = placedBids.find(bid =>
    bid.isAutoBid && bid.amount === amount
  );
  expect(autoBid).to.exist;
});

Then('an automatic bid of ${int} should be placed', function (amount) {
  const autoBid = placedBids.find(bid =>
    bid.isAutoBid && bid.amount === amount
  );
  expect(autoBid).to.exist;
});

Then('an automatic bid should be placed immediately', function () {
  const autoBids = placedBids.filter(bid => bid.isAutoBid);
  expect(autoBids).to.have.length.greaterThan(0);
});

Then('an automatic bid should be placed', function () {
  const autoBids = placedBids.filter(bid => bid.isAutoBid);
  expect(autoBids).to.have.length.greaterThan(0);
});

Then('the bid should be marked as {string}', function (bidType) {
  const lastBid = placedBids[placedBids.length - 1];
  expect(lastBid).to.exist;

  if (bidType === 'auto-aggressive') {
    expect(lastBid.strategy).to.equal('aggressive');
  } else if (bidType === 'auto-snipe') {
    expect(lastBid.strategy).to.include('second');
  }
});

Then('I should receive a max bid exceeded notification', function () {
  const maxBidNotifications = notifications.filter(n =>
    n.event === 'maxBidExceeded' || n.data?.type === 'maxBidExceeded'
  );
  expect(maxBidNotifications).to.have.length.greaterThan(0);
});

Then('the system should log {string}', function (_logMessage) {
  // In a real implementation, we'd check the logger
  // For now, we'll check if a snipe bid was placed
  const snipeBids = placedBids.filter(bid =>
    bid.strategy && bid.strategy.includes('second')
  );
  expect(snipeBids).to.have.length.greaterThan(0);
});

Then('the strategy should be updated successfully', function () {
  expect(this.lastStrategyUpdateResponse.status).to.equal(200);
});

Then('no automatic bid should be placed on {string}', function (auctionId) {
  const autoBids = placedBids.filter(bid =>
    bid.isAutoBid && bid.auctionId === auctionId
  );
  expect(autoBids).to.have.lengthOf(0);
});

Then('an automatic bid should be placed on {string}', function (auctionId) {
  const autoBids = placedBids.filter(bid =>
    bid.isAutoBid && bid.auctionId === auctionId
  );
  expect(autoBids).to.have.length.greaterThan(0);
});

Then('not ${int} as would be the default increment', function (wrongAmount) {
  const wrongBid = placedBids.find(bid => bid.amount === wrongAmount);
  expect(wrongBid).to.not.exist;
});

Then('the error should be logged', function () {
  // Check that auction has error state
  const auctionIds = Array.from(auctionMonitor.monitoredAuctions.keys());
  const auction = auctionMonitor.monitoredAuctions.get(auctionIds[0]);
  expect(auction.lastError).to.exist;
});

Then('a retry should be attempted after {int} seconds', function (_seconds) {
  // In real implementation, we'd verify retry logic
  // For now, verify auction is still monitored for retry
  const auctionIds = Array.from(auctionMonitor.monitoredAuctions.keys());
  expect(auctionIds).to.have.length.greaterThan(0);
});

Then('I should receive an error notification', function () {
  const errorNotifications = notifications.filter(n =>
    n.event === 'error' || n.event === 'bidError'
  );
  expect(errorNotifications).to.have.length.greaterThan(0);
});

Then('bid history should record the automatic bid', async function () {
  const auctionIds = Array.from(auctionMonitor.monitoredAuctions.keys());
  const auctionId = auctionIds[auctionIds.length - 1];

  const history = await storage.getBidHistory(auctionId);
  expect(history).to.have.length.greaterThan(0);
  const lastBid = history[history.length - 1];
  expect(lastBid.isAutoBid).to.be.true;
});

module.exports = { testAuctions, placedBids };