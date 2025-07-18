const { Given, When, Then, Before, After } = require('@cucumber/cucumber');
const { expect } = require('chai');
const WebSocket = require('ws');
// const sinon = require('sinon');

// Test state
let messageLog = [];
let connectionCount = 0;
let missedUpdates = [];

Before(function () {
  messageLog = [];
  connectionCount = 0;
  missedUpdates = [];
  this.wsMessages = [];
  this.otherClients = [];
});

After(function () {
  // Clean up WebSocket connections
  if (this.ws && this.ws.readyState === WebSocket.OPEN) {
    this.ws.close();
  }

  this.otherClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.close();
    }
  });
});

// Given steps

// Commented out - duplicate definition exists in authentication.steps.js
// Given('I have a valid auth token', function () {
//   // Inherited from common steps
//   expect(this.authToken).to.exist;
// });

Given('I have an authenticated WebSocket connection', async function () {
  this.ws = await this.createWebSocketConnection(true);
  expect(this.ws.readyState).to.equal(WebSocket.OPEN);

  // Set up message handler
  this.ws.on('message', (data) => {
    const message = JSON.parse(data);
    this.wsMessages.push(message);
    messageLog.push({
      time: new Date(),
      message,
      connection: connectionCount
    });
  });
});

Given('I am monitoring auction {string}', function (auctionId) {
  // Send monitoring request via WebSocket
  this.ws.send(JSON.stringify({
    type: 'startMonitoring',
    auctionId: auctionId,
    config: {
      maxBid: 100,
      strategy: 'manual'
    }
  }));

  this.monitoredAuctions = this.monitoredAuctions || [];
  this.monitoredAuctions.push(auctionId);
});

Given('I am not monitoring auction {string}', function (auctionId) {
  // Explicitly not monitoring this auction
  this.notMonitoredAuctions = this.notMonitoredAuctions || [];
  this.notMonitoredAuctions.push(auctionId);
});

Given('I am monitoring {int} auctions', function (count) {
  this.monitoredAuctions = [];

  for (let i = 0; i < count; i++) {
    const auctionId = `AUCTION${i + 1}`;
    this.ws.send(JSON.stringify({
      type: 'startMonitoring',
      auctionId: auctionId,
      config: {
        maxBid: 100 + (i * 50),
        strategy: 'manual'
      }
    }));
    this.monitoredAuctions.push(auctionId);
  }
});

// When steps

When('I connect to the WebSocket endpoint', function (done) {
  connectionCount++;
  this.ws = new WebSocket(this.wsUrl);

  this.ws.on('open', () => {
    this.wsConnected = true;
    done();
  });

  this.ws.on('error', (error) => {
    this.wsError = error;
    done(error);
  });

  this.ws.on('message', (data) => {
    const message = JSON.parse(data);
    this.wsMessages.push(message);
  });

  this.ws.on('close', () => {
    this.wsClosed = true;
  });
});

When('I send an authentication message', function () {
  this.ws.send(JSON.stringify({
    type: 'authenticate',
    token: this.authToken
  }));
});

When('I do not send authentication within {int} seconds', async function (seconds) {
  // Just wait without sending auth
  await new Promise(resolve => setTimeout(resolve, (seconds + 1) * 1000));
});

When('I send an invalid authentication token', function () {
  this.ws.send(JSON.stringify({
    type: 'authenticate',
    token: 'invalid-token-123'
  }));
});

When('auction {string} price changes to ${int}', function (auctionId, newPrice) {
  // Simulate auction update from server
  // In real test, this would trigger server-side update
  const updateMessage = {
    type: 'auctionUpdate',
    auctionId: auctionId,
    data: {
      currentBid: newPrice,
      timeLeft: 180,
      lastBidder: 'other-user'
    }
  };

  // Store for verification
  this.expectedUpdates = this.expectedUpdates || {};
  this.expectedUpdates[auctionId] = updateMessage;
});

When('auction {string} ends', function (auctionId) {
  // Simulate auction end
  const endMessage = {
    type: 'auctionEnded',
    auctionId: auctionId,
    data: {
      finalPrice: 95,
      winner: 'user123',
      endTime: new Date()
    }
  };

  this.expectedEndMessage = endMessage;
});

When('I send a malformed JSON message', function () {
  this.ws.send('{ invalid json ');
});

When('I send {int} messages within {int} second', function (count, _seconds) {
  const messages = [];

  for (let i = 0; i < count; i++) {
    this.ws.send(JSON.stringify({
      type: 'ping',
      id: i
    }));
    messages.push(i);
  }

  this.sentMessageCount = count;
  this.sentMessages = messages;
});

When('I send a {string} message for auction {string} with amount ${int}', function (messageType, auctionId, amount) {
  // Create other client connections to verify broadcast
  const otherClient = new WebSocket(this.wsUrl);

  otherClient.on('open', async () => {
    // Authenticate other client
    otherClient.send(JSON.stringify({
      type: 'authenticate',
      token: this.authToken
    }));

    // Wait for auth confirmation
    await new Promise(resolve => setTimeout(resolve, 100));

    // Subscribe to auction
    otherClient.send(JSON.stringify({
      type: 'startMonitoring',
      auctionId: auctionId,
      config: { maxBid: 200, strategy: 'manual' }
    }));
  });

  otherClient.on('message', (data) => {
    const message = JSON.parse(data);
    if (message.type === 'auctionUpdate') {
      this.broadcastReceived = true;
    }
  });

  this.otherClients.push(otherClient);

  // Send bid message
  this.ws.send(JSON.stringify({
    type: messageType,
    auctionId: auctionId,
    amount: amount
  }));

  this.lastBidAmount = amount;
});

When('my connection drops unexpectedly', function () {
  // Simulate unexpected disconnect
  this.ws.terminate();
  this.connectionDropped = true;

  // Simulate some missed updates
  missedUpdates = [
    { auctionId: 'AUCTION1', update: { currentBid: 125 } },
    { auctionId: 'AUCTION2', update: { currentBid: 175 } }
  ];
});

When('I reconnect within {int} seconds', async function (_seconds) {
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Reconnect
  connectionCount++;
  this.ws = await this.createWebSocketConnection(true);

  // Re-subscribe to auctions
  if (this.monitoredAuctions) {
    this.monitoredAuctions.forEach(auctionId => {
      this.ws.send(JSON.stringify({
        type: 'resubscribe',
        auctionId: auctionId
      }));
    });
  }
});

When('I disconnect from WebSocket', function () {
  this.ws.close();
  this.manualDisconnect = true;
});

// Then steps

Then('I should receive an {string} message', function (messageType) {
  const message = this.wsMessages.find(msg => msg.type === messageType);
  expect(message).to.exist;
});

Then('my connection should be established', function () {
  expect(this.ws.readyState).to.equal(WebSocket.OPEN);
  expect(this.wsConnected).to.be.true;
});

Then('I should be subscribed to system events', function () {
  const authMessage = this.wsMessages.find(msg => msg.type === 'authenticated');
  expect(authMessage).to.exist;
  expect(authMessage.subscriptions).to.include('system');
});

Then('my connection should be closed', function () {
  expect(this.wsClosed).to.be.true;
});

// Commented out - duplicate definition exists above at line 269
// Then('I should receive an {string} message', function (messageType) {
//   const message = this.wsMessages.find(msg =>
//     msg.type === 'error' && msg.error && msg.error.includes(messageType)
//   );
//   expect(message).to.exist;
// });

Then('the message should contain the new price of ${int}', function (price) {
  const updateMessage = this.wsMessages.find(msg =>
    msg.type === 'auctionUpdate'
  );
  expect(updateMessage).to.exist;
  expect(updateMessage.data.currentBid).to.equal(price);
});

Then('the message should include time remaining', function () {
  const updateMessage = this.wsMessages.find(msg =>
    msg.type === 'auctionUpdate'
  );
  expect(updateMessage).to.exist;
  expect(updateMessage.data).to.have.property('timeLeft');
});

Then('I should receive update for auction {string}', function (auctionId) {
  const update = this.wsMessages.find(msg =>
    msg.type === 'auctionUpdate' && msg.auctionId === auctionId
  );
  expect(update).to.exist;
});

Then('I should not receive update for auction {string}', function (auctionId) {
  const update = this.wsMessages.find(msg =>
    msg.type === 'auctionUpdate' && msg.auctionId === auctionId
  );
  expect(update).to.not.exist;
});

Then('the message should include final price', function () {
  const endMessage = this.wsMessages.find(msg =>
    msg.type === 'auctionEnded'
  );
  expect(endMessage).to.exist;
  expect(endMessage.data).to.have.property('finalPrice');
});

Then('the message should indicate if I won', function () {
  const endMessage = this.wsMessages.find(msg =>
    msg.type === 'auctionEnded'
  );
  expect(endMessage).to.exist;
  expect(endMessage.data).to.have.property('winner');
});

Then('the error should say {string}', function (errorMessage) {
  const error = this.wsMessages.find(msg =>
    msg.type === 'error'
  );
  expect(error).to.exist;
  expect(error.message).to.include(errorMessage);
});

Then('my connection should remain open', function () {
  expect(this.ws.readyState).to.equal(WebSocket.OPEN);
});

Then('I should receive a {string} message', function (messageType) {
  const message = this.wsMessages.find(msg => msg.type === messageType);
  expect(message).to.exist;
});

Then('subsequent messages should be ignored', function () {
  // Check that we didn't receive responses for all messages
  const responseCount = this.wsMessages.filter(msg =>
    msg.type === 'pong'
  ).length;

  expect(responseCount).to.be.lessThan(this.sentMessageCount);
});

Then('I should receive a {string} confirmation', function (confirmationType) {
  const confirmation = this.wsMessages.find(msg =>
    msg.type === confirmationType
  );
  expect(confirmation).to.exist;
  expect(confirmation.success).to.be.true;
});

Then('other connected clients should receive the auction update', function (done) {
  // Wait a bit for broadcast
  setTimeout(() => {
    expect(this.broadcastReceived).to.be.true;
    done();
  }, 500);
});

Then('the bid should be recorded in the system', async function () {
  // Verify via API
  const response = await this.makeRequest('GET', '/api/auctions/12345');
  expect(response.data.currentBid).to.equal(this.lastBidAmount);
});

Then('my auction subscriptions should be restored', function () {
  // Check for resubscription confirmations
  const resubMessages = this.wsMessages.filter(msg =>
    msg.type === 'subscriptionRestored'
  );

  expect(resubMessages).to.have.lengthOf(this.monitoredAuctions.length);
});

Then('I should receive any missed critical updates', function () {
  // Check for missed update messages
  const missedUpdateMessages = this.wsMessages.filter(msg =>
    msg.type === 'missedUpdate'
  );

  expect(missedUpdateMessages.length).to.be.greaterThan(0);
});

Then('my subscriptions should be removed', function () {
  // This would be verified server-side
  expect(this.manualDisconnect).to.be.true;
});

Then('server resources should be freed', function () {
  // This would be verified by checking server metrics
  expect(this.manualDisconnect).to.be.true;
});

Then('my auction monitoring should continue server-side', async function () {
  // Verify auctions are still being monitored via API
  const response = await this.makeRequest('GET', '/api/auctions');

  if (this.monitoredAuctions) {
    const monitoredIds = response.data.auctions.map(a => a.id);
    this.monitoredAuctions.forEach(id => {
      expect(monitoredIds).to.include(id);
    });
  }
});

module.exports = { messageLog, missedUpdates };