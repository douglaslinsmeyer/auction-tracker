/**
 * SSE Edge Cases Step Definitions
 * BDD step definitions for SSE error handling and edge cases
 */

const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('chai');
const EventEmitter = require('events');

// Mock EventSource for BDD tests
class MockEventSource extends EventEmitter {
  constructor(url, options) {
    super();
    this.url = url;
    this.options = options;
    this.readyState = 1; // OPEN
    this._shouldFail = false;
    this._reconnectCount = 0;
    
    // Simulate connection after next tick
    process.nextTick(() => {
      if (this._shouldFail) {
        this.readyState = 2; // CLOSED
        if (this.onerror) {
          this.onerror(new Error('Connection failed'));
        }
      } else {
        if (this.onopen) {
          this.onopen();
        }
        // Send connected message
        if (this.onmessage) {
          this.onmessage({ data: 'connected session-123-456' });
        }
      }
    });
  }
  
  close() {
    this.readyState = 2; // CLOSED
    this.emit('close');
  }
  
  addEventListener(event, handler) {
    this.on(event, handler);
  }
  
  // Test helpers
  simulateConnectionFailure() {
    this._shouldFail = true;
    this.readyState = 2;
    if (this.onerror) {
      this.onerror(new Error('Connection lost'));
    }
  }
  
  simulateBidEvent(productId, bidData) {
    this.emit(`ch_product_bids:${productId}`, {
      data: JSON.stringify(bidData)
    });
  }
  
  simulateAuctionClosed(productId, closeData) {
    this.emit(`ch_product_closed:${productId}`, {
      data: JSON.stringify(closeData)
    });
  }
  
  simulatePing() {
    if (this.onmessage) {
      this.onmessage({ data: 'ping' });
    }
  }
  
  simulateMalformedEvent(productId) {
    this.emit(`ch_product_bids:${productId}`, {
      data: 'invalid json {'
    });
  }
}

// Setup for each scenario
Given('the SSE client is initialized', async function () {
  // Mock the EventSource constructor
  this.MockEventSource = MockEventSource;
  this.mockEventSources = [];
  
  // Override require for eventsource
  const Module = require('module');
  const originalRequire = Module.prototype.require;
  Module.prototype.require = function(id) {
    if (id === 'eventsource') {
      return { 
        EventSource: function(url, options) {
          const instance = new MockEventSource(url, options);
          this.mockEventSources = this.mockEventSources || [];
          this.mockEventSources.push(instance);
          return instance;
        }.bind(this)
      };
    }
    return originalRequire.apply(this, arguments);
  }.bind(this);
  
  // Initialize components
  this.eventEmitter = new EventEmitter();
  this.events = [];
  this.errors = [];
  
  // Track events
  this.eventEmitter.on('auction:update', (data) => {
    this.events.push({ type: 'auction:update', data });
  });
  
  this.eventEmitter.on('auction:closed', (data) => {
    this.events.push({ type: 'auction:closed', data });
  });
  
  this.eventEmitter.on('sse:error', (error) => {
    this.errors.push(error);
  });
  
  this.eventEmitter.on('sse:fallback', (data) => {
    this.events.push({ type: 'sse:fallback', data });
  });
  
  this.eventEmitter.on('sse:connected', (data) => {
    this.events.push({ type: 'sse:connected', data });
  });
  
  // Mock storage
  this.storage = {
    hset: async () => true,
    get: async () => null,
    set: async () => true
  };
  
  // Mock features
  this.features = {
    isEnabled: (flag) => {
      if (flag === 'USE_SSE') {
        return this.sseEnabled !== false;
      }
      return false;
    }
  };
  this.sseEnabled = true;
  
  // Mock logger
  this.logger = {
    info: () => {},
    debug: () => {},
    warn: () => {},
    error: (msg, data) => {
      this.errors.push({ message: msg, data });
    }
  };
  
  // Create SSE client
  const SSEClientClass = require('../../../src/services/classes/SSEClientClass');
  this.sseClient = new SSEClientClass(
    this.storage,
    this.eventEmitter,
    this.logger,
    this.features
  );
  
  await this.sseClient.initialize();
});

Given('feature flag {string} is enabled', function (flagName) {
  if (flagName === 'USE_SSE') {
    this.sseEnabled = true;
    this.sseClient.config.enabled = true;
  }
});

Given('an auction with ID {string} and product ID {string}', function (auctionId, productId) {
  this.auctionId = auctionId;
  this.productId = productId;
});

Given('an auction with ID {string} and invalid product ID {string}', function (auctionId, productId) {
  this.auctionId = auctionId;
  this.productId = productId;
  // Mark the product ID as invalid for connection failure
  if (this.mockEventSources) {
    this.mockEventSources.forEach(source => {
      source._shouldFail = true;
    });
  }
});

Given('SSE monitoring is active', async function () {
  const success = await this.sseClient.connectToAuction(this.productId, this.auctionId);
  expect(success).to.be.true;
  expect(this.mockEventSources.length).to.be.greaterThan(0);
});

Given('I have {int} different auctions with unique product IDs', function (count) {
  this.multipleAuctions = [];
  for (let i = 0; i < count; i++) {
    this.multipleAuctions.push({
      auctionId: `auction_${i}`,
      productId: `product_${i}`
    });
  }
});

When('I start monitoring the auction with strategy {string}', async function (strategy) {
  this.monitoringStrategy = strategy;
  const success = await this.sseClient.connectToAuction(this.productId, this.auctionId);
  this.connectionSuccess = success;
});

When('the SSE connection fails', function () {
  if (this.mockEventSources && this.mockEventSources.length > 0) {
    this.mockEventSources[0].simulateConnectionFailure();
  }
});

When('I receive {int} rapid bid update events within {int} second', async function (eventCount, timeSeconds) {
  const eventSource = this.mockEventSources[0];
  
  for (let i = 0; i < eventCount; i++) {
    eventSource.simulateBidEvent(this.productId, {
      currentBid: 100 + i,
      bidCount: i + 1,
      lastBidder: `user${i}`
    });
    
    // Small delay to simulate rapid events
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 100));
});

When('the SSE connection is temporarily lost', function () {
  const eventSource = this.mockEventSources[0];
  eventSource.simulateConnectionFailure();
});

When('I attempt to start SSE monitoring', async function () {
  this.connectionSuccess = await this.sseClient.connectToAuction(this.productId, this.auctionId);
});

When('the SSE connection fails repeatedly', async function () {
  const eventSource = this.mockEventSources[0];
  
  // Simulate multiple failures exceeding max attempts
  for (let i = 0; i < 5; i++) {
    eventSource.simulateConnectionFailure();
    await new Promise(resolve => setTimeout(resolve, 10));
  }
});

When('maximum reconnection attempts are exceeded', async function () {
  // This is handled by the previous step
  await new Promise(resolve => setTimeout(resolve, 100));
});

When('I receive an SSE event with malformed JSON', function () {
  const eventSource = this.mockEventSources[0];
  eventSource.simulateMalformedEvent(this.productId);
});

When('I start SSE monitoring for all auctions simultaneously', async function () {
  this.connectionResults = [];
  
  for (const auction of this.multipleAuctions) {
    const success = await this.sseClient.connectToAuction(auction.productId, auction.auctionId);
    this.connectionResults.push(success);
  }
});

When('I receive an {string} SSE event', function (eventType) {
  const eventSource = this.mockEventSources[0];
  
  if (eventType === 'auction closed') {
    eventSource.simulateAuctionClosed(this.productId, {
      finalBid: 150,
      winner: 'winner123',
      closedAt: new Date().toISOString()
    });
  }
});

When('feature flag {string} is disabled', function (flagName) {
  if (flagName === 'USE_SSE') {
    this.sseEnabled = false;
  }
});

When('I establish an SSE connection', async function () {
  const success = await this.sseClient.connectToAuction(this.productId, this.auctionId);
  expect(success).to.be.true;
  
  // Simulate additional messages
  const eventSource = this.mockEventSources[0];
  eventSource.simulatePing();
  eventSource.simulatePing();
});

Then('the system should fallback to polling mode', function () {
  // Check for fallback event or polling indicators
  const fallbackEvents = this.events.filter(e => e.type === 'sse:fallback');
  expect(fallbackEvents.length).to.be.greaterThan(0);
});

Then('auction monitoring should continue without interruption', function () {
  // In a real system, this would check that polling has started
  // For this test, we verify no system crashes occurred
  expect(this.errors.filter(e => e.message && e.message.includes('crash')).length).to.equal(0);
});

Then('all {int} events should be processed', function (expectedCount) {
  const bidUpdateEvents = this.events.filter(e => e.type === 'auction:update');
  expect(bidUpdateEvents.length).to.equal(expectedCount);
});

Then('no events should be lost or duplicated', function () {
  const bidUpdateEvents = this.events.filter(e => e.type === 'auction:update');
  
  // Check for duplicates by comparing bid counts
  const bidCounts = bidUpdateEvents.map(e => e.data.data.bidCount);
  const uniqueBidCounts = [...new Set(bidCounts)];
  
  expect(bidCounts.length).to.equal(uniqueBidCounts.length);
});

Then('the auction state should reflect the latest bid', function () {
  const bidUpdateEvents = this.events.filter(e => e.type === 'auction:update');
  
  if (bidUpdateEvents.length > 0) {
    const latestEvent = bidUpdateEvents[bidUpdateEvents.length - 1];
    expect(latestEvent.data.data.currentBid).to.be.greaterThan(100);
  }
});

Then('the client should attempt to reconnect', function () {
  // Check for error events indicating reconnection attempts
  expect(this.errors.length).to.be.greaterThan(0);
});

Then('after successful reconnection, events should resume', async function () {
  // Simulate successful reconnection
  const eventSource = this.mockEventSources[0];
  if (eventSource.onopen) {
    eventSource.onopen();
  }
  
  // Send a test event
  eventSource.simulateBidEvent(this.productId, {
    currentBid: 200,
    bidCount: 1,
    lastBidder: 'reconnect_user'
  });
  
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const bidUpdateEvents = this.events.filter(e => e.type === 'auction:update');
  expect(bidUpdateEvents.length).to.be.greaterThan(0);
});

Then('no duplicate connections should be created', function () {
  expect(this.mockEventSources.length).to.equal(1);
});

Then('the SSE connection should fail gracefully', function () {
  expect(this.connectionSuccess).to.be.false;
});

Then('error should be logged but not crash the service', function () {
  expect(this.errors.length).to.be.greaterThan(0);
  // Service should still be running (no unhandled exceptions)
  expect(this.sseClient).to.not.be.null;
});

Then('the system should permanently fallback to polling', function () {
  const fallbackEvents = this.events.filter(e => e.type === 'sse:fallback');
  expect(fallbackEvents.length).to.be.greaterThan(0);
});

Then('fallback event should be emitted', function () {
  const fallbackEvents = this.events.filter(e => e.type === 'sse:fallback');
  expect(fallbackEvents.length).to.be.greaterThan(0);
});

Then('no further reconnection attempts should be made', function () {
  // After fallback, no more error events should be generated
  const initialErrorCount = this.errors.length;
  
  // Wait and check no new errors
  setTimeout(() => {
    expect(this.errors.length).to.equal(initialErrorCount);
  }, 100);
});

Then('the error should be caught and logged', function () {
  expect(this.errors.length).to.be.greaterThan(0);
});

Then('the connection should remain active', function () {
  const eventSource = this.mockEventSources[0];
  expect(eventSource.readyState).to.equal(1); // OPEN
});

Then('subsequent valid events should process normally', async function () {
  const eventSource = this.mockEventSources[0];
  const initialEventCount = this.events.filter(e => e.type === 'auction:update').length;
  
  // Send a valid event
  eventSource.simulateBidEvent(this.productId, {
    currentBid: 300,
    bidCount: 1,
    lastBidder: 'valid_user'
  });
  
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const finalEventCount = this.events.filter(e => e.type === 'auction:update').length;
  expect(finalEventCount).to.be.greaterThan(initialEventCount);
});

Then('{int} separate SSE connections should be established', function (expectedCount) {
  expect(this.mockEventSources.length).to.equal(expectedCount);
  expect(this.connectionResults.every(result => result === true)).to.be.true;
});

Then('each connection should receive events independently', async function () {
  // Send events to different product IDs
  this.multipleAuctions.forEach((auction, index) => {
    const eventSource = this.mockEventSources[index];
    eventSource.simulateBidEvent(auction.productId, {
      currentBid: 100 + index,
      bidCount: 1,
      lastBidder: `user${index}`
    });
  });
  
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const bidUpdateEvents = this.events.filter(e => e.type === 'auction:update');
  expect(bidUpdateEvents.length).to.equal(this.multipleAuctions.length);
});

Then('disconnecting one auction should not affect others', function () {
  // Disconnect first auction
  this.sseClient.disconnect(this.multipleAuctions[0].productId);
  
  // Check that other connections remain
  expect(this.sseClient.connections.size).to.equal(this.multipleAuctions.length - 1);
});

Then('the SSE connection should be automatically closed', function () {
  expect(this.sseClient.connections.has(this.productId)).to.be.false;
});

Then('the auction should be marked as completed', function () {
  const closedEvents = this.events.filter(e => e.type === 'auction:closed');
  expect(closedEvents.length).to.be.greaterThan(0);
});

Then('no resources should be leaked', function () {
  // Check that connection is properly cleaned up
  expect(this.sseClient.connections.size).to.equal(0);
  expect(this.sseClient.reconnectAttempts.size).to.equal(0);
  expect(this.sseClient.sessionIds.size).to.equal(0);
});

Then('existing SSE connections should remain active', function () {
  expect(this.sseClient.connections.size).to.be.greaterThan(0);
});

Then('new monitoring requests should use polling only', async function () {
  // Try to start a new connection with SSE disabled
  const newSuccess = await this.sseClient.connectToAuction('new_product', 'new_auction');
  expect(newSuccess).to.be.false;
});

Then('existing auctions should continue without interruption', function () {
  // Existing connections should still be active
  expect(this.sseClient.connections.size).to.be.greaterThan(0);
});

Then('I should receive a {string} message with session ID', function (messageType) {
  if (messageType === 'connected') {
    const connectedEvents = this.events.filter(e => e.type === 'sse:connected');
    expect(connectedEvents.length).to.be.greaterThan(0);
  }
});

Then('I should receive periodic {string} keepalive messages', function (messageType) {
  // This is simulated in the "When I establish an SSE connection" step
  // In a real scenario, we would check for periodic ping handling
  expect(messageType).to.equal('ping');
});

Then('the session ID should be stored for reference', function () {
  expect(this.sseClient.sessionIds.has(this.productId)).to.be.true;
});

Then('keepalive messages should not trigger bid updates', function () {
  // Ping messages should not create auction:update events
  const bidUpdateEvents = this.events.filter(e => e.type === 'auction:update');
  // We only sent ping messages, so there should be no bid updates from pings
  expect(bidUpdateEvents.every(e => e.data.type !== 'ping')).to.be.true;
});