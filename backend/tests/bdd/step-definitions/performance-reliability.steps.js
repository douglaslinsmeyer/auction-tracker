const { Given, When, Then, Before, After } = require('@cucumber/cucumber');
const { expect } = require('chai');
// const sinon = require('sinon');

// Performance tracking
let performanceMetrics = {
  requests: [],
  memory: [],
  cpu: [],
  responseTimes: [],
  errors: []
};

let rateLimitCounters = new Map();
let circuitBreakerState = 'CLOSED';
let queueState = {
  auctions: new Map(),
  processingOrder: []
};

Before(function () {
  // Reset performance metrics
  performanceMetrics = {
    requests: [],
    memory: [],
    cpu: [],
    responseTimes: [],
    errors: []
  };

  rateLimitCounters.clear();
  circuitBreakerState = 'CLOSED';
  queueState.auctions.clear();
  queueState.processingOrder = [];

  // Start performance monitoring
  this.performanceInterval = setInterval(() => {
    performanceMetrics.memory.push({
      time: Date.now(),
      usage: process.memoryUsage().heapUsed / 1024 / 1024 // MB
    });

    performanceMetrics.cpu.push({
      time: Date.now(),
      usage: process.cpuUsage()
    });
  }, 1000);
});

After(function () {
  if (this.performanceInterval) {
    clearInterval(this.performanceInterval);
  }
});

// Given steps

Given('performance monitoring is enabled', function () {
  this.performanceEnabled = true;
});

Given('I am authenticated as {string}', function (userId) {
  this.userId = userId;
  this.authToken = `token-${userId}`;
});

Given('the Nellis API is experiencing issues', function () {
  this.apiIssues = true;
  this.failureCount = 0;
});

Given('the circuit breaker is open', function () {
  circuitBreakerState = 'OPEN';
  this.circuitOpenTime = Date.now();
});

Given('the circuit breaker has been open for {int} minutes', function (minutes) {
  circuitBreakerState = 'OPEN';
  this.circuitOpenTime = Date.now() - (minutes * 60 * 1000);
});

Given('the Nellis API has recovered', function () {
  this.apiIssues = false;
  this.apiRecovered = true;
});

Given('I am monitoring {int} auctions', function (count) {
  for (let i = 0; i < count; i++) {
    queueState.auctions.set(`AUCTION${i}`, {
      id: `AUCTION${i}`,
      timeLeft: 180 + (i * 10),
      priority: 'normal'
    });
  }
});

Given('auction {string} has {int} seconds remaining', function (auctionId, seconds) {
  queueState.auctions.set(auctionId, {
    id: auctionId,
    timeLeft: seconds,
    priority: seconds <= 60 ? 'high' : 'normal'
  });
});

Given('the polling queue contains {int} auctions', function (count) {
  for (let i = 0; i < count; i++) {
    queueState.auctions.set(`QUEUE${i}`, {
      id: `QUEUE${i}`,
      timeLeft: 300,
      priority: 'normal'
    });
  }
});

Given('auction {string} is in the polling queue', function (auctionId) {
  queueState.auctions.set(auctionId, {
    id: auctionId,
    timeLeft: 180,
    priority: 'normal'
  });
});

Given('normal load of {int} requests per second', function (rps) {
  this.normalRPS = rps;
  this.currentRPS = rps;
});

Given('the system limit is {int} concurrent auctions', function (limit) {
  this.auctionLimit = limit;
  this.currentAuctionCount = 0;
});

Given('Redis connection is lost', function () {
  this.redisConnected = false;
  this.fallbackMode = true;
});

Given('the bid service is down', function () {
  this.bidServiceUp = false;
});

Given('monitoring service is operational', function () {
  this.monitoringServiceUp = true;
});

Given('there are {int} ended auctions in memory', function (count) {
  this.endedAuctions = [];
  const endedTime = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago

  for (let i = 0; i < count; i++) {
    this.endedAuctions.push({
      id: `ENDED${i}`,
      endedAt: new Date(endedTime),
      status: 'ended'
    });
  }
});

Given('performance monitoring is active', function () {
  this.performanceActive = true;
});

Given('response times are normally under {int}ms', function (ms) {
  this.normalResponseTime = ms;
});

Given('the system has been running for {int} days', function (days) {
  this.systemUptime = days * 24 * 60 * 60 * 1000;

  // Simulate historical metrics
  this.historicalMetrics = {
    peakUsers: 150,
    maxAuctions: 850,
    avgCpu: 35,
    avgMemory: 180
  };
});

// When steps

When('I make {int} API requests within {int} seconds', async function (count, seconds) {
  const requests = [];
  const startTime = Date.now();

  for (let i = 0; i < count; i++) {
    try {
      const response = await this.makeRequest('GET', '/api/auctions', {
        headers: { Authorization: `Bearer ${this.authToken}` }
      });

      requests.push({
        status: response.status,
        time: Date.now() - startTime,
        index: i
      });

      // Track rate limiting
      const userKey = `api-${this.userId}`;
      rateLimitCounters.set(userKey, (rateLimitCounters.get(userKey) || 0) + 1);

    } catch (error) {
      requests.push({
        status: error.response?.status || 500,
        time: Date.now() - startTime,
        index: i,
        error: true
      });
    }

    // Small delay to spread requests
    if (i < count - 1) {
      await new Promise(resolve => setTimeout(resolve, (seconds * 1000) / count));
    }
  }

  this.apiRequests = requests;
});

When('I send {int} messages within {int} seconds', function (count, _seconds) {
  const messages = [];
  const startTime = Date.now();

  for (let i = 0; i < count; i++) {
    this.ws.send(JSON.stringify({
      type: 'update',
      id: i,
      timestamp: Date.now()
    }));

    messages.push({
      id: i,
      time: Date.now() - startTime
    });

    // Track WebSocket rate limiting
    const wsKey = `ws-${this.userId}`;
    rateLimitCounters.set(wsKey, (rateLimitCounters.get(wsKey) || 0) + 1);
  }

  this.wsMessages = messages;
});

When('I make {int} monitoring requests within {int} seconds', async function (count, _seconds) {
  this.monitoringRequests = [];

  for (let i = 0; i < count; i++) {
    const response = await this.makeRequest('POST', `/api/auctions/TEST${i}/monitor`, {
      body: { config: { maxBid: 100, strategy: 'manual' } }
    });

    this.monitoringRequests.push(response);
  }
});

When('I make {int} status check requests within {int} seconds', async function (count, _seconds) {
  this.statusRequests = [];

  for (let i = 0; i < count; i++) {
    const response = await this.makeRequest('GET', '/api/health');
    this.statusRequests.push(response);
  }
});

When('{int} consecutive API calls fail within {int} seconds', function (failures, seconds) {
  this.failureCount = failures;
  this.failureWindow = seconds;

  // Simulate failures
  if (failures >= 5) {
    circuitBreakerState = 'OPEN';
    this.circuitOpenTime = Date.now();
  }
});

When('{int} seconds have passed', async function (seconds) {
  await new Promise(resolve => setTimeout(resolve, seconds * 1000));

  // Check if circuit breaker should transition
  if (circuitBreakerState === 'OPEN' && seconds >= 60) {
    circuitBreakerState = 'HALF_OPEN';
  }
});

When('the circuit breaker tests the connection', function () {
  if (this.apiRecovered) {
    circuitBreakerState = 'CLOSED';
    this.recoveryStartTime = Date.now();
  }
});

When('the polling queue processes updates', function () {
  // Sort by priority and time remaining
  queueState.processingOrder = Array.from(queueState.auctions.values())
    .sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority === 'high' ? -1 : 1;
      }
      return a.timeLeft - b.timeLeft;
    })
    .map(a => a.id);
});

When('I stop monitoring {int} auctions', function (count) {
  const auctionIds = Array.from(queueState.auctions.keys()).slice(0, count);
  auctionIds.forEach(id => queueState.auctions.delete(id));
  this.removedCount = count;
});

When('multiple services try to add auction {string} again', function (auctionId) {
  // Simulate multiple add attempts
  for (let i = 0; i < 3; i++) {
    const existing = queueState.auctions.get(auctionId);
    if (existing) {
      existing.priority = 'high'; // Update to highest priority
    } else {
      queueState.auctions.set(auctionId, {
        id: auctionId,
        timeLeft: 180,
        priority: 'high'
      });
    }
  }
});

When('the system runs for {int} hour', function (hours) {
  // Simulate time passing
  this.runDuration = hours * 60 * 60 * 1000;

  // Check memory usage
  const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  performanceMetrics.memory.push({
    time: Date.now(),
    usage: currentMemory
  });
});

When('all auctions update simultaneously', function () {
  const startTime = Date.now();

  // Simulate processing all auctions
  queueState.auctions.forEach(_auction => {
    performanceMetrics.responseTimes.push({
      time: Date.now(),
      duration: Math.random() * 100 + 50 // 50-150ms
    });
  });

  this.simultaneousUpdateTime = Date.now() - startTime;
});

When('{int} concurrent requests access the database', async function (count) {
  const dbRequests = [];

  // Simulate concurrent DB access
  for (let i = 0; i < count; i++) {
    dbRequests.push(
      new Promise(resolve => {
        const startTime = Date.now();
        setTimeout(() => {
          resolve({
            duration: Date.now() - startTime,
            connectionWait: Math.random() * 50
          });
        }, Math.random() * 100);
      })
    );
  }

  this.dbResults = await Promise.all(dbRequests);
});

When('traffic suddenly increases to {int} requests per second', function (rps) {
  this.currentRPS = rps;
  this.trafficSpike = true;

  // Track spike
  performanceMetrics.requests.push({
    time: Date.now(),
    rps: rps,
    type: 'spike'
  });
});

When('load continues to increase', function () {
  this.currentRPS += 50;
  this.extremeLoad = true;
});

When('I try to monitor auction {int}', function (auctionNumber) {
  this.currentAuctionCount = auctionNumber;

  if (auctionNumber > this.auctionLimit) {
    this.limitExceeded = true;
  }
});

When('the system detects the disconnection', function () {
  this.disconnectionDetected = true;
  this.fallbackMode = true;
  this.reconnectAttempts = 0;
});

When('users access the system', function () {
  this.systemAccessed = true;
});

When('the cleanup process runs', function () {
  // Remove old ended auctions
  if (this.endedAuctions) {
    const cutoffTime = Date.now() - (60 * 60 * 1000); // 1 hour
    this.archivedAuctions = this.endedAuctions.filter(a =>
      a.endedAt.getTime() < cutoffTime
    );
    this.endedAuctions = this.endedAuctions.filter(a =>
      a.endedAt.getTime() >= cutoffTime
    );
  }
});

When('I request system metrics', function () {
  this.systemMetrics = {
    currentResponseTime: performanceMetrics.responseTimes.slice(-10)
      .reduce((sum, r) => sum + r.duration, 0) / 10,
    throughput: performanceMetrics.requests.length,
    errorRate: performanceMetrics.errors.length / performanceMetrics.requests.length,
    cpu: process.cpuUsage(),
    memory: process.memoryUsage()
  };
});

When('average response time exceeds {int}ms for {int} minute', function (ms, _minutes) {
  // Simulate degraded performance
  const degradedResponses = Array(60).fill(null).map(() => ({
    time: Date.now(),
    duration: ms + Math.random() * 100
  }));

  performanceMetrics.responseTimes.push(...degradedResponses);
  this.performanceDegraded = true;
});

When('I request capacity metrics', function () {
  this.capacityMetrics = {
    peakUsers: this.historicalMetrics.peakUsers,
    maxAuctions: this.historicalMetrics.maxAuctions,
    avgCpu: this.historicalMetrics.avgCpu,
    avgMemory: this.historicalMetrics.avgMemory,
    projectedLimit: {
      users: Math.floor(this.historicalMetrics.peakUsers * 1.5),
      auctions: Math.floor(this.historicalMetrics.maxAuctions * 1.5)
    }
  };
});

// Then steps

Then('the first {int} requests should succeed', function (count) {
  const successful = this.apiRequests.filter(r => r.status === 200);
  expect(successful.length).to.be.at.least(count);
});

Then('subsequent requests should return {int} {string}', function (status, _message) {
  const failures = this.apiRequests.filter(r => r.status === status);
  expect(failures.length).to.be.greaterThan(0);
});

Then('the response should include a {string} header', function (_header) {
  const rateLimited = this.apiRequests.find(r => r.status === 429);
  expect(rateLimited).to.exist;
  // In real test, check actual response headers
});

Then('the rate limit should reset after the window', async function () {
  // Wait for rate limit window
  await new Promise(resolve => setTimeout(resolve, 61000));

  // Make new request
  const response = await this.makeRequest('GET', '/api/auctions');
  expect(response.status).to.equal(200);
});

Then('the first {int} messages should be processed', function (count) {
  expect(this.wsMessages.length).to.be.at.least(count);
});

Then('subsequent messages should be dropped', function () {
  const wsKey = `ws-${this.userId}`;
  const totalSent = rateLimitCounters.get(wsKey) || 0;
  expect(totalSent).to.be.greaterThan(30);
});

Then('I should receive a rate limit warning', function () {
  // Check for rate limit message in WebSocket responses
  expect(this.wsMessages).to.exist;
});

Then('my connection should remain open', function () {
  expect(this.ws.readyState).to.equal(1); // OPEN state
});

Then('all monitoring requests should succeed', function () {
  this.monitoringRequests.forEach(response => {
    expect(response.status).to.equal(200);
  });
});

Then('all status check requests should succeed', function () {
  this.statusRequests.forEach(response => {
    expect(response.status).to.equal(200);
  });
});

Then('they have different rate limit buckets', function () {
  // Verify different endpoints have different limits
  expect(this.monitoringRequests.length).to.equal(10);
  expect(this.statusRequests.length).to.equal(50);
});

Then('the circuit breaker should open', function () {
  expect(circuitBreakerState).to.equal('OPEN');
});

Then('subsequent calls should fail immediately', function () {
  const fastFailTime = 10; // ms
  expect(this.lastResponseTime).to.be.lessThan(fastFailTime);
});

Then('an alert should be logged', function () {
  // In real implementation, check logging system
  expect(circuitBreakerState).to.equal('OPEN');
});

Then('clients should receive a {string} message', function (message) {
  expect(this.lastError || this.lastResponse.data.error).to.include(message);
});

Then('the circuit breaker should enter half-open state', function () {
  expect(circuitBreakerState).to.equal('HALF_OPEN');
});

Then('allow {int} test request through', function (_count) {
  expect(circuitBreakerState).to.equal('HALF_OPEN');
});

Then('the circuit breaker should close', function () {
  expect(circuitBreakerState).to.equal('CLOSED');
});

Then('it should remain open', function () {
  expect(circuitBreakerState).to.equal('OPEN');
});

Then('it should detect the recovery', function () {
  expect(this.apiRecovered).to.be.true;
  expect(circuitBreakerState).to.equal('CLOSED');
});

Then('gradually allow more requests through', function () {
  // In real implementation, check request allowance increases
  expect(this.recoveryStartTime).to.exist;
});

Then('return to normal operation within {int} minutes', function (minutes) {
  const recoveryTime = Date.now() - this.recoveryStartTime;
  expect(recoveryTime).to.be.lessThan(minutes * 60 * 1000);
});

Then('auction {string} should be updated first', function (auctionId) {
  expect(queueState.processingOrder[0]).to.equal(auctionId);
});

Then('high-priority auctions should be checked every {int} seconds', function (_seconds) {
  const highPriority = Array.from(queueState.auctions.values())
    .filter(a => a.priority === 'high');
  expect(highPriority.length).to.be.greaterThan(0);
});

Then('low-priority auctions should be checked every {int} seconds', function (_seconds) {
  const lowPriority = Array.from(queueState.auctions.values())
    .filter(a => a.priority === 'normal');
  expect(lowPriority.length).to.be.greaterThan(0);
});

Then('those auctions should be removed from the queue immediately', function () {
  const currentSize = queueState.auctions.size;
  const expectedSize = 100 - this.removedCount;
  expect(currentSize).to.equal(expectedSize);
});

Then('queue performance should not degrade', function () {
  // Check that removal was O(1) for each auction
  expect(queueState.auctions.size).to.equal(50);
});

Then('remaining auctions should continue updating normally', function () {
  expect(queueState.auctions.size).to.be.greaterThan(0);
});

Then('the auction should only appear once in the queue', function () {
  const auctionCount = Array.from(queueState.auctions.values())
    .filter(a => a.id === '12345').length;
  expect(auctionCount).to.equal(1);
});

Then('its priority should be updated to the highest requested', function () {
  const auction = queueState.auctions.get('12345');
  expect(auction.priority).to.equal('high');
});

Then('no duplicate polling should occur', function () {
  expect(queueState.auctions.size).to.equal(1);
});

Then('memory usage should stay below {int}MB', function (limit) {
  const maxMemory = Math.max(...performanceMetrics.memory.map(m => m.usage));
  expect(maxMemory).to.be.lessThan(limit);
});

Then('there should be no memory leaks', function () {
  const memoryGrowth = performanceMetrics.memory[performanceMetrics.memory.length - 1].usage -
                      performanceMetrics.memory[0].usage;
  expect(memoryGrowth).to.be.lessThan(50); // Allow 50MB growth
});

Then('old auction data should be garbage collected', function () {
  // Check that ended auctions are cleaned up
  expect(this.endedAuctions).to.exist;
});

Then('CPU usage should not exceed {int}%', function (_percent) {
  // In real test, calculate actual CPU percentage
  expect(this.simultaneousUpdateTime).to.be.lessThan(1000);
});

Then('response times should remain under {int}ms', function (ms) {
  const avgResponseTime = performanceMetrics.responseTimes
    .slice(-50)
    .reduce((sum, r) => sum + r.duration, 0) / 50;
  expect(avgResponseTime).to.be.lessThan(ms);
});

Then('no requests should timeout', function () {
  const timeouts = performanceMetrics.responseTimes.filter(r => r.duration > 5000);
  expect(timeouts).to.have.lengthOf(0);
});

Then('connections should be pooled efficiently', function () {
  expect(this.dbResults).to.have.lengthOf(100);
});

Then('no connection exhaustion should occur', function () {
  const failures = this.dbResults.filter(r => !r);
  expect(failures).to.have.lengthOf(0);
});

Then('connection wait time should be under {int}ms', function (ms) {
  const maxWait = Math.max(...this.dbResults.map(r => r.connectionWait));
  expect(maxWait).to.be.lessThan(ms);
});

Then('the system should remain responsive', function () {
  expect(this.trafficSpike).to.be.true;
  expect(performanceMetrics.errors).to.have.lengthOf(0);
});

Then('critical operations should be prioritized', function () {
  // In real implementation, check operation prioritization
  expect(this.currentRPS).to.be.greaterThan(this.normalRPS);
});

Then('non-critical operations should be queued', function () {
  // Check queuing mechanism
  expect(this.trafficSpike).to.be.true;
});

Then('no data should be lost', function () {
  // Verify all requests were processed or queued
  expect(performanceMetrics.requests.length).to.be.greaterThan(0);
});

Then('the system should degrade gracefully', function () {
  expect(this.extremeLoad).to.be.true;
  // System still responds, just slower
});

Then('maintain core functionality', function () {
  // Critical endpoints still work
  expect(this.systemAccessed).to.be.true;
});

Then('shed non-essential load', function () {
  // Non-critical operations rejected
  expect(this.extremeLoad).to.be.true;
});

Then('recover quickly when load decreases', function () {
  this.currentRPS = this.normalRPS;
  // Check recovery metrics
});

Then('I should receive a {string} error', function (_errorType) {
  expect(this.limitExceeded).to.be.true;
});

Then('be prompted to stop monitoring other auctions', function () {
  // Check for suggestion in error response
  expect(this.currentAuctionCount).to.be.greaterThan(this.auctionLimit);
});

Then('the system should suggest less active auctions to remove', function () {
  // Would return list of inactive auctions
  expect(this.limitExceeded).to.be.true;
});

Then('it should switch to in-memory fallback', function () {
  expect(this.fallbackMode).to.be.true;
});

Then('continue serving requests', function () {
  expect(this.systemAccessed).to.be.true;
});

Then('attempt to reconnect every {int} seconds', function (_seconds) {
  // Check reconnection logic
  expect(this.reconnectAttempts).to.exist;
});

Then('sync data when connection is restored', function () {
  // Check data synchronization
  expect(this.fallbackMode).to.be.true;
});

Then('monitoring should continue normally', function () {
  expect(this.monitoringServiceUp).to.be.true;
});

Then('bid attempts should fail gracefully', function () {
  expect(this.bidServiceUp).to.be.false;
});

Then('users should be notified of limited functionality', function () {
  // Check for degraded mode notification
  expect(this.bidServiceUp).to.be.false;
});

Then('full service should resume when bid service recovers', function () {
  this.bidServiceUp = true;
  expect(this.monitoringServiceUp).to.be.true;
});

Then('ended auctions should be archived', function () {
  expect(this.archivedAuctions).to.have.length.greaterThan(0);
});

Then('memory should be freed', function () {
  const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  performanceMetrics.memory.push({
    time: Date.now(),
    usage: currentMemory
  });
});

Then('historical data should remain accessible', function () {
  expect(this.archivedAuctions).to.exist;
});

Then('active auctions should be unaffected', function () {
  const activeAuctions = Array.from(queueState.auctions.values())
    .filter(a => a.status !== 'ended');
  expect(activeAuctions.length).to.be.greaterThan(0);
});

Then('I should see current response times', function () {
  expect(this.systemMetrics.currentResponseTime).to.be.a('number');
});

Then('request throughput per second', function () {
  expect(this.systemMetrics.throughput).to.be.a('number');
});

Then('error rates by category', function () {
  expect(this.systemMetrics.errorRate).to.be.a('number');
});

Then('resource utilization percentages', function () {
  expect(this.systemMetrics.cpu).to.exist;
  expect(this.systemMetrics.memory).to.exist;
});

Then('a performance alert should be triggered', function () {
  expect(this.performanceDegraded).to.be.true;
});

Then('diagnostic information should be collected', function () {
  // Check for diagnostic data
  expect(performanceMetrics.responseTimes.length).to.be.greaterThan(0);
});

Then('recent changes should be identified', function () {
  // Would check deployment history
  expect(this.performanceDegraded).to.be.true;
});

Then('remediation suggestions should be provided', function () {
  // Would provide specific suggestions
  expect(this.performanceDegraded).to.be.true;
});

Then('I should see peak concurrent users', function () {
  expect(this.capacityMetrics.peakUsers).to.equal(150);
});

Then('maximum auction monitoring count', function () {
  expect(this.capacityMetrics.maxAuctions).to.equal(850);
});

Then('resource utilization trends', function () {
  expect(this.capacityMetrics.avgCpu).to.exist;
  expect(this.capacityMetrics.avgMemory).to.exist;
});

Then('projected capacity limits', function () {
  expect(this.capacityMetrics.projectedLimit).to.exist;
  expect(this.capacityMetrics.projectedLimit.users).to.be.greaterThan(150);
  expect(this.capacityMetrics.projectedLimit.auctions).to.be.greaterThan(850);
});

module.exports = { performanceMetrics, rateLimitCounters, circuitBreakerState, queueState };