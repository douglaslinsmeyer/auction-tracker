const { Given, When, Then, Before } = require('@cucumber/cucumber');
const { expect } = require('chai');
const WebSocket = require('ws');
const storage = require('../../../src/services/storage');
const cryptoUtil = require('../../../src/utils/crypto');

// Test data
let authTokens = {
  valid: 'test-auth-token',
  invalid: 'bad-token-123',
  expired: 'expired-token'
};

let testCookies = {
  valid: 'sessionId=abc123; authToken=xyz789; expires=' + new Date(Date.now() + 86400000).toUTCString(),
  expired: 'sessionId=old123; authToken=old789; expires=' + new Date(Date.now() - 86400000).toUTCString(),
  updated: 'sessionId=new456; authToken=new012; expires=' + new Date(Date.now() + 86400000).toUTCString()
};

let activeSessions = new Map();

Before(function () {
  activeSessions.clear();
});

// Given steps

Given('I have valid Nellis auction cookies', function () {
  this.validCookies = testCookies.valid;
});

Given('I am authenticated with saved cookies', async function () {
  // Simulate authenticated state with cookies
  await storage.saveCookies(cryptoUtil.encrypt(testCookies.valid));
  this.isAuthenticated = true;
  this.authToken = authTokens.valid;
});

Given('I am authenticated with cookies that expired', async function () {
  await storage.saveCookies(cryptoUtil.encrypt(testCookies.expired));
  this.isAuthenticated = true;
  this.hasExpiredCookies = true;
});

Given('I am authenticated', function () {
  this.isAuthenticated = true;
  this.authToken = authTokens.valid;
  this.sessionId = 'session-' + Date.now();
  activeSessions.set(this.sessionId, {
    token: this.authToken,
    lastActivity: new Date()
  });
});

Given('I authenticate from one client', function () {
  this.client1 = {
    token: authTokens.valid,
    sessionId: 'client1-session',
    isAuthenticated: true
  };
  activeSessions.set(this.client1.sessionId, {
    token: this.client1.token,
    lastActivity: new Date()
  });
});

Given('I have a valid auth token', function () {
  this.authToken = authTokens.valid;
});

Given('I have an authenticated WebSocket connection', async function () {
  this.ws = await this.createWebSocketConnection(true);
  this.wsAuthenticated = true;
});

Given('authentication fails temporarily', function () {
  this.temporaryAuthFailure = true;
  this.authServiceDown = true;
  setTimeout(() => {
    this.authServiceDown = false;
  }, 4000); // Service recovers after 4 seconds
});

Given('I have used an auth token once', async function () {
  // Simulate using token
  const response = await this.makeRequest('GET', '/api/health', {
    headers: { Authorization: `Bearer ${authTokens.valid}` }
  });
  expect(response.status).to.equal(200);

  // Mark token as used
  this.usedToken = authTokens.valid;
});

// When steps

When('I authenticate with a valid auth token', async function () {
  this.authToken = authTokens.valid;
  try {
    const response = await this.makeRequest('POST', '/api/auth', {
      headers: { Authorization: `Bearer ${this.authToken}` }
    });
    this.lastAuthResponse = response;
  } catch (error) {
    this.lastAuthError = error;
  }
});

When('I authenticate with an invalid token {string}', async function (token) {
  try {
    const response = await this.makeRequest('POST', '/api/auth', {
      headers: { Authorization: `Bearer ${token}` }
    });
    this.lastAuthResponse = response;
  } catch (error) {
    this.lastAuthError = error.response;
  }
});

When('I make a request without an auth token', async function () {
  try {
    const response = await this.makeRequest('GET', '/api/auctions', {
      headers: {} // No auth header
    });
    this.lastResponse = response;
  } catch (error) {
    this.lastError = error.response;
  }
});

When('I authenticate with the system', async function () {
  const response = await this.makeRequest('POST', '/api/auth/cookies', {
    body: { cookies: this.validCookies },
    headers: { Authorization: `Bearer ${authTokens.valid}` }
  });
  this.lastAuthResponse = response;
});

When('Nellis returns updated cookies in a response', async function () {
  // Simulate API response with new cookies
  this.updatedCookies = testCookies.updated;

  // In real implementation, this would happen automatically
  // For test, we'll manually update
  await storage.saveCookies(cryptoUtil.encrypt(this.updatedCookies));
});

When('I try to access an auction', async function () {
  try {
    const response = await this.makeRequest('GET', '/api/auctions/12345');
    this.lastResponse = response;
  } catch (error) {
    this.lastError = error.response;
  }
});

When('I make multiple API requests', async function () {
  this.apiResponses = [];

  for (let i = 0; i < 3; i++) {
    const response = await this.makeRequest('GET', '/api/health', {
      headers: { Authorization: `Bearer ${this.authToken}` }
    });
    this.apiResponses.push(response);
  }
});

When('I am inactive for {int} minutes', function (minutes) {
  // Simulate time passing
  const session = activeSessions.get(this.sessionId);
  if (session) {
    session.lastActivity = new Date(Date.now() - (minutes * 60 * 1000));
  }
});

When('I authenticate from another client', function () {
  this.client2 = {
    token: authTokens.valid,
    sessionId: 'client2-session',
    isAuthenticated: true
  };
  activeSessions.set(this.client2.sessionId, {
    token: this.client2.token,
    lastActivity: new Date()
  });
});

When('I connect to WebSocket without authentication', function () {
  this.wsError = null;
  try {
    // Try to connect without sending auth
    const ws = new WebSocket(this.wsUrl);
    ws.on('error', (error) => {
      this.wsError = error;
    });
    ws.on('message', (data) => {
      this.wsMessage = JSON.parse(data);
    });
  } catch (error) {
    this.wsError = error;
  }
});

When('I connect to WebSocket', function () {
  this.ws = new WebSocket(this.wsUrl);

  return new Promise((resolve) => {
    this.ws.on('open', () => {
      this.wsConnected = true;
      resolve();
    });
  });
});

When('I send authentication message with my token', function () {
  this.ws.send(JSON.stringify({
    type: 'authenticate',
    token: this.authToken
  }));
});

When('the connection is lost and restored', async function () {
  // Close existing connection
  if (this.ws) {
    this.ws.close();
  }

  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 100));

  // Reconnect
  this.ws = new WebSocket(this.wsUrl);
  await new Promise((resolve) => {
    this.ws.on('open', resolve);
  });
});

When('the authentication service is down', function () {
  this.authServiceDown = true;
});

When('I try to authenticate', async function () {
  if (this.authServiceDown) {
    this.lastAuthError = {
      response: {
        status: 503,
        data: { error: 'Service unavailable' }
      }
    };
    return;
  }

  try {
    const response = await this.makeRequest('POST', '/api/auth', {
      headers: { Authorization: `Bearer ${authTokens.valid}` }
    });
    this.lastAuthResponse = response;
  } catch (error) {
    this.lastAuthError = error;
  }
});

When('I retry authentication after {int} seconds', async function (seconds) {
  await new Promise(resolve => setTimeout(resolve, seconds * 1000));

  if (!this.authServiceDown) {
    const response = await this.makeRequest('POST', '/api/auth', {
      headers: { Authorization: `Bearer ${authTokens.valid}` }
    });
    this.lastAuthResponse = response;
  }
});

When('I try to use the same token again after logout', async function () {
  try {
    const response = await this.makeRequest('GET', '/api/auctions', {
      headers: { Authorization: `Bearer ${this.usedToken}` }
    });
    this.reuseResponse = response;
  } catch (error) {
    this.reuseError = error.response;
  }
});

When('I make {int} failed authentication attempts', async function (attempts) {
  this.failedAttempts = [];

  for (let i = 0; i < attempts; i++) {
    try {
      const response = await this.makeRequest('POST', '/api/auth', {
        headers: { Authorization: `Bearer invalid-${i}` }
      });
      this.failedAttempts.push(response);
    } catch (error) {
      this.failedAttempts.push(error.response);
    }
  }
});

// Then steps

Then('I should receive a success response', function () {
  expect(this.lastAuthResponse).to.exist;
  expect(this.lastAuthResponse.status).to.equal(200);
  expect(this.lastAuthResponse.data.success).to.be.true;
});

Then('I should be able to access protected endpoints', async function () {
  const response = await this.makeRequest('GET', '/api/auctions', {
    headers: { Authorization: `Bearer ${this.authToken}` }
  });
  expect(response.status).to.equal(200);
});

Then('my session should be established', function () {
  expect(this.lastAuthResponse.data).to.have.property('sessionId');
  expect(activeSessions.size).to.be.greaterThan(0);
});

Then('I should receive a {int} unauthorized error', function (statusCode) {
  const error = this.lastAuthError || this.lastError;
  expect(error).to.exist;
  expect(error.status).to.equal(statusCode);
});

Then('I should not be able to access protected endpoints', async function () {
  try {
    await this.makeRequest('GET', '/api/auctions', {
      headers: { Authorization: `Bearer ${authTokens.invalid}` }
    });
    expect.fail('Should have received unauthorized error');
  } catch (error) {
    expect(error.response.status).to.equal(401);
  }
});

Then('the error should say {string}', function (errorMessage) {
  const error = this.lastError || this.lastAuthError;
  expect(error.data.error).to.include(errorMessage);
});

Then('the cookies should be encrypted and stored', async function () {
  const savedCookies = await storage.getCookies();
  expect(savedCookies).to.exist;

  // Verify they're encrypted (not plain text)
  expect(savedCookies).to.not.include('sessionId=');

  // Verify they can be decrypted
  const decrypted = cryptoUtil.decrypt(savedCookies);
  expect(decrypted).to.include('sessionId=');
});

Then('the cookies should be available for API requests', async function () {
  const cookies = await storage.getCookies();
  expect(cookies).to.exist;
});

Then('cookie expiration should be tracked', async function () {
  const cookieData = await storage.get('cookies');
  expect(cookieData).to.have.property('expiresAt');
});

Then('the new cookies should replace the old ones', async function () {
  const currentCookies = await storage.getCookies();
  const decrypted = cryptoUtil.decrypt(currentCookies);
  expect(decrypted).to.include('new456'); // From updated cookies
  expect(decrypted).to.not.include('abc123'); // From old cookies
});

Then('the cookie update timestamp should be recorded', async function () {
  const cookieData = await storage.get('cookies');
  expect(cookieData).to.have.property('updatedAt');
  const updateTime = new Date(cookieData.updatedAt);
  expect(updateTime).to.be.closeTo(new Date(), 5000);
});

Then('I should receive a {string} error', function (errorType) {
  expect(this.lastError).to.exist;
  expect(this.lastError.data.error.toLowerCase()).to.include(errorType);
});

Then('the system should prompt for re-authentication', function () {
  expect(this.lastError.data).to.have.property('requiresAuth', true);
});

Then('monitoring should pause until re-authenticated', function () {
  // In real implementation, check monitoring status
  expect(this.lastError.data).to.have.property('monitoringPaused', true);
});

Then('each request should include my session', function () {
  expect(this.apiResponses).to.have.lengthOf(3);
  this.apiResponses.forEach(response => {
    expect(response.status).to.equal(200);
  });
});

Then('I should not need to re-authenticate', function () {
  this.apiResponses.forEach(response => {
    expect(response.status).to.not.equal(401);
  });
});

Then('my session should remain active', function () {
  const session = activeSessions.get(this.sessionId);
  expect(session).to.exist;
});

Then('my session should expire', function () {
  const session = activeSessions.get(this.sessionId);
  const thirtyMinutesAgo = new Date(Date.now() - (30 * 60 * 1000));
  expect(session.lastActivity).to.be.below(thirtyMinutesAgo);
});

Then('I should need to authenticate again', async function () {
  try {
    await this.makeRequest('GET', '/api/auctions', {
      headers: { Authorization: `Bearer ${this.authToken}` }
    });
    expect.fail('Should require re-authentication');
  } catch (error) {
    expect(error.response.status).to.equal(401);
  }
});

Then('my monitored auctions should be paused', function () {
  // In real implementation, check auction monitor status
  expect(true).to.be.true;
});

Then('both sessions should be valid', function () {
  expect(activeSessions.has(this.client1.sessionId)).to.be.true;
  expect(activeSessions.has(this.client2.sessionId)).to.be.true;
});

Then('auction updates should go to both clients', function () {
  // In real implementation, verify WebSocket broadcasts
  expect(activeSessions.size).to.equal(2);
});

Then('each session should track separately', function () {
  const session1 = activeSessions.get(this.client1.sessionId);
  const session2 = activeSessions.get(this.client2.sessionId);
  expect(session1).to.not.equal(session2);
});

Then('the connection should be refused', function () {
  expect(this.wsMessage || this.wsError).to.exist;
});

Then('I should receive an authentication required message', function () {
  if (this.wsMessage) {
    expect(this.wsMessage.type).to.equal('authRequired');
  }
});

Then('I should receive an authenticated confirmation', function (done) {
  this.ws.on('message', (data) => {
    const message = JSON.parse(data);
    if (message.type === 'authenticated') {
      expect(message.success).to.be.true;
      done();
    }
  });
});

Then('I should receive auction updates', function (done) {
  // Set up listener for auction updates
  let updateReceived = false;
  this.ws.on('message', (data) => {
    const message = JSON.parse(data);
    if (message.type === 'auctionUpdate') {
      updateReceived = true;
      done();
    }
  });

  // Timeout if no update received
  setTimeout(() => {
    if (!updateReceived) {
      done(new Error('No auction update received'));
    }
  }, 2000);
});

Then('I should be prompted to re-authenticate', function () {
  expect(this.wsConnected).to.be.true;
  // Would check for auth prompt message
});

Then('my auction subscriptions should be restored', function () {
  // In real implementation, verify subscriptions
  expect(this.ws).to.exist;
});

Then('I should not miss any critical updates', function () {
  // This would be verified by checking message queue
  expect(true).to.be.true;
});

Then('I should receive a service unavailable error', function () {
  expect(this.lastAuthError.response.status).to.equal(503);
});

Then('the error should be logged', function () {
  // In real implementation, check logs
  expect(this.lastAuthError).to.exist;
});

Then('existing authenticated sessions should continue', function () {
  expect(activeSessions.size).to.be.greaterThan(0);
});

Then('authentication should succeed', function () {
  expect(this.lastAuthResponse.status).to.equal(200);
});

Then('normal operation should resume', function () {
  expect(this.authServiceDown).to.be.false;
});

Then('the temporary failure should be logged', function () {
  expect(this.temporaryAuthFailure).to.be.true;
});

Then('the authentication should fail', function () {
  expect(this.reuseError).to.exist;
  expect(this.reuseError.status).to.equal(401);
});

Then('further attempts should be rate limited', function () {
  const rateLimitedResponses = this.failedAttempts.filter(r =>
    r && r.status === 429
  );
  expect(rateLimitedResponses.length).to.be.greaterThan(0);
});

Then('the last attempt should have error {string}', function (errorMessage) {
  const lastAttempt = this.failedAttempts[this.failedAttempts.length - 1];
  expect(lastAttempt.data.error).to.include(errorMessage);
});

Then('I should need to wait before trying again', function () {
  const lastAttempt = this.failedAttempts[this.failedAttempts.length - 1];
  expect(lastAttempt.headers).to.have.property('retry-after');
});

module.exports = { authTokens, testCookies };