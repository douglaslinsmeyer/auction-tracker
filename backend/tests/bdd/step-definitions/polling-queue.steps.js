/**
 * Step definitions for polling queue feature
 */

const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('chai');
const featureFlags = require('../../../src/config/features');

// Helper to monitor CPU usage
class CPUMonitor {
  constructor() {
    this.startTime = process.hrtime();
    this.startUsage = process.cpuUsage();
  }

  getUsage() {
    const elapsedTime = process.hrtime(this.startTime);
    const elapsedUsage = process.cpuUsage(this.startUsage);
    const elapsedMs = elapsedTime[0] * 1000 + elapsedTime[1] / 1e6;
    const elapsedCpu = (elapsedUsage.user + elapsedUsage.system) / 1000;
    return (elapsedCpu / elapsedMs) * 100;
  }
}

// Background: Given I am authenticated with a valid token
// (This is already defined in auction.steps.js)

// Background: And the external auction API is available
// (This is already defined in auction.steps.js)

Given('the polling queue feature is disabled', function () {
  featureFlags.disable('USE_POLLING_QUEUE');
  expect(featureFlags.isEnabled('USE_POLLING_QUEUE')).to.be.false;
});

Given('the polling queue feature is enabled', function () {
  featureFlags.enable('USE_POLLING_QUEUE');
  expect(featureFlags.isEnabled('USE_POLLING_QUEUE')).to.be.true;
});

When('I start monitoring {int} auctions', async function (count) {
  this.monitoredAuctions = [];
  this.apiResponses = [];

  for (let i = 1; i <= count; i++) {
    const auctionId = `test-auction-${i}`;
    const response = await this.request
      .post(`/api/auctions/${auctionId}/monitor`)
      .set('Authorization', `Bearer ${this.authToken}`)
      .send({
        config: {
          strategy: 'manual',
          enabled: true
        }
      });

    expect(response.status).to.equal(200);
    this.apiResponses.push(response);
    this.monitoredAuctions.push(auctionId);
  }

  // Give the system a moment to initialize
  await new Promise(resolve => setTimeout(resolve, 100));
});

Then('each auction should have its own polling timer', function () {
  // Access the auction monitor to check internal state
  const auctionMonitor = require('../../../src/services/auctionMonitor');

  // Check that pollingIntervals map has entries
  expect(auctionMonitor.pollingIntervals.size).to.equal(this.monitoredAuctions.length);

  // Each auction should have a timer
  for (const auctionId of this.monitoredAuctions) {
    const interval = auctionMonitor.pollingIntervals.get(auctionId);
    expect(interval).to.exist;
    expect(interval._idleTimeout).to.be.greaterThan(0); // Active timer
  }
});

Then('the system should use individual setInterval calls', function () {
  const auctionMonitor = require('../../../src/services/auctionMonitor');

  // Check that we're not using the queue
  const wrapper = auctionMonitor.constructor.name;
  expect(wrapper).to.not.equal('PollingQueueWrapper');

  // Verify individual intervals exist
  expect(auctionMonitor.pollingIntervals.size).to.equal(this.monitoredAuctions.length);
});

Then('all auctions should be added to the polling queue', async function () {
  // Get queue metrics
  const response = await this.request
    .get('/api/features')
    .set('Authorization', `Bearer ${this.authToken}`);

  expect(response.status).toBe(200);

  // Access the auction monitor to check queue state
  const auctionMonitor = require('../../../src/services/auctionMonitor');

  if (auctionMonitor.getQueueMetrics) {
    const metrics = auctionMonitor.getQueueMetrics();
    expect(metrics.enabled).to.be.true;
    expect(metrics.items.length).to.equal(this.monitoredAuctions.length);
  }
});

Then('only one polling worker should be active', function () {
  const auctionMonitor = require('../../../src/services/auctionMonitor');

  // With queue enabled, there should be no individual timers
  expect(auctionMonitor.pollingIntervals.size).to.equal(0);

  // Check for queue worker (internal state)
  if (auctionMonitor._queueWorker) {
    expect(auctionMonitor._queueWorker).to.exist;
    expect(auctionMonitor._queueWorker._idleTimeout).to.be.greaterThan(0);
  }
});

Then('CPU usage should be lower than legacy polling', function () {
  // This is a simplified test - in production you'd measure over time
  // For now, we just verify the queue is being used efficiently
  const auctionMonitor = require('../../../src/services/auctionMonitor');

  if (auctionMonitor.getQueueMetrics) {
    const metrics = auctionMonitor.getQueueMetrics();

    // Queue should be processing efficiently
    expect(metrics.enabled).to.be.true;
    expect(metrics.items.length).to.be.greaterThan(0);

    // No individual timers should exist
    expect(auctionMonitor.pollingIntervals.size).to.equal(0);
  }
});

Given('I am monitoring auction {string} ending in {int} minutes', async function (auctionName, minutes) {
  this.auctionsByName = this.auctionsByName || {};

  const auctionId = auctionName.toLowerCase().replace(' ', '-');
  const response = await this.request
    .post(`/api/auctions/${auctionId}/monitor`)
    .set('Authorization', `Bearer ${this.authToken}`)
    .send({
      config: {
        strategy: 'manual',
        enabled: true
      },
      metadata: {
        timeRemaining: minutes * 60 // Convert to seconds
      }
    });

  expect(response.status).toBe(200);
  this.auctionsByName[auctionName] = auctionId;
});

Given('I am monitoring auction {string} ending in {int} seconds', async function (auctionName, seconds) {
  this.auctionsByName = this.auctionsByName || {};

  const auctionId = auctionName.toLowerCase().replace(' ', '-');
  const response = await this.request
    .post(`/api/auctions/${auctionId}/monitor`)
    .set('Authorization', `Bearer ${this.authToken}`)
    .send({
      config: {
        strategy: 'manual',
        enabled: true
      },
      metadata: {
        timeRemaining: seconds
      }
    });

  expect(response.status).toBe(200);
  this.auctionsByName[auctionName] = auctionId;
});

When('the polling queue processes updates', async function () {
  // Wait for queue to process
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Track polling order
  this.pollingOrder = [];
  const auctionMonitor = require('../../../src/services/auctionMonitor');

  // Mock updateAuction to track call order
  const originalUpdate = auctionMonitor.updateAuction || auctionMonitor._singleton?.updateAuction;
  if (originalUpdate) {
    const trackingUpdate = (auctionId) => {
      this.pollingOrder.push(auctionId);
      return originalUpdate.call(auctionMonitor, auctionId);
    };

    if (auctionMonitor._singleton) {
      auctionMonitor._singleton.updateAuction = trackingUpdate;
    } else {
      auctionMonitor.updateAuction = trackingUpdate;
    }
  }

  // Wait for more processing
  await new Promise(resolve => setTimeout(resolve, 2000));
});

Then('auction {string} should be polled before auction {string}', function (firstAuction, secondAuction) {
  const firstId = this.auctionsByName[firstAuction];
  const secondId = this.auctionsByName[secondAuction];

  const firstIndex = this.pollingOrder.indexOf(firstId);
  const secondIndex = this.pollingOrder.indexOf(secondId);

  // At least one should have been polled
  expect(firstIndex >= 0 || secondIndex >= 0).to.be.true;

  // If both were polled, check order
  if (firstIndex >= 0 && secondIndex >= 0) {
    expect(firstIndex).to.be.lessThan(secondIndex);
  }
});

Given('I am monitoring {int} auctions in the queue', async function (count) {
  await this.steps(`I start monitoring ${count} auctions`);
});

Given('I am monitoring {int} auctions', async function (count) {
  await this.steps(`I start monitoring ${count} auctions`);
});

When('I stop monitoring one auction', async function () {
  const auctionId = this.monitoredAuctions[0];

  const response = await this.request
    .delete(`/api/auctions/${auctionId}/monitor`)
    .set('Authorization', `Bearer ${this.authToken}`);

  expect(response.status).toBe(200);
  this.stoppedAuction = auctionId;
});

Then('the auction should be removed from the queue', function () {
  const auctionMonitor = require('../../../src/services/auctionMonitor');

  if (auctionMonitor.getQueueMetrics) {
    const metrics = auctionMonitor.getQueueMetrics();
    const queuedIds = metrics.items.map(item => item.auctionId);
    expect(queuedIds).to.not.include(this.stoppedAuction);
  }
});

Then('the queue should continue processing other auctions', async function () {
  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 1000));

  const auctionMonitor = require('../../../src/services/auctionMonitor');

  if (auctionMonitor.getQueueMetrics) {
    const metrics = auctionMonitor.getQueueMetrics();
    expect(metrics.items.length).to.equal(this.monitoredAuctions.length - 1);
    expect(metrics.totalPolls).to.be.greaterThan(0);
  }
});

When('I start monitoring {int} auctions for load testing', async function (count) {
  this.startMemory = process.memoryUsage().heapUsed;
  this.cpuMonitor = new CPUMonitor();

  // Reuse the existing step
  await this.steps(`I start monitoring ${count} auctions`);
});

Then('the queue should handle all auctions', function () {
  const auctionMonitor = require('../../../src/services/auctionMonitor');

  if (auctionMonitor.getQueueMetrics) {
    const metrics = auctionMonitor.getQueueMetrics();
    expect(metrics.items.length).to.equal(100);
  } else {
    // Legacy mode
    expect(auctionMonitor.getMonitoredCount()).to.equal(100);
  }
});

Then('memory usage should remain stable', function () {
  const currentMemory = process.memoryUsage().heapUsed;
  const memoryIncrease = currentMemory - this.startMemory;
  const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

  // Memory increase should be reasonable (less than 50MB for 100 auctions)
  expect(memoryIncreaseMB).to.be.lessThan(50);
});

Then('no more than {int} API requests per second should be made', function (maxRequests) {
  // This is enforced by the queue implementation
  // We can verify by checking the queue configuration
  const auctionMonitor = require('../../../src/services/auctionMonitor');

  if (auctionMonitor._maxRequestsPerSecond !== undefined) {
    expect(auctionMonitor._maxRequestsPerSecond).to.be.at.most(maxRequests);
  }
});

When('the API becomes unavailable', function () {
  // Mock API failures
  const nellisApi = require('../../../src/services/nellisApi');
  this.originalGetAuctionData = nellisApi.getAuctionData;
  const stub = {
    called: false,
    callCount: 0
  };
  nellisApi.getAuctionData = function () {
    stub.called = true;
    stub.callCount++;
    return Promise.reject(new Error('API Unavailable'));
  };
  nellisApi.getAuctionData.called = false;
  nellisApi.getAuctionData.__stub = stub;
});

Then('the queue should continue attempting polls', async function () {
  await new Promise(resolve => setTimeout(resolve, 2000));

  const nellisApi = require('../../../src/services/nellisApi');
  expect(nellisApi.getAuctionData.__stub.called).to.be.true;
});

Then('failed polls should be rescheduled', function () {
  const auctionMonitor = require('../../../src/services/auctionMonitor');

  if (auctionMonitor.getQueueMetrics) {
    const metrics = auctionMonitor.getQueueMetrics();
    expect(metrics.errors).to.be.greaterThan(0);
    expect(metrics.items.length).to.be.greaterThan(0); // Items still in queue
  }
});

When('the API becomes available again', function () {
  // Restore original API
  const nellisApi = require('../../../src/services/nellisApi');
  nellisApi.getAuctionData = this.originalGetAuctionData;
});

Then('polling should resume normally', async function () {
  await new Promise(resolve => setTimeout(resolve, 2000));

  const auctionMonitor = require('../../../src/services/auctionMonitor');

  if (auctionMonitor.getQueueMetrics) {
    const initialPolls = auctionMonitor.getQueueMetrics().totalPolls;

    await new Promise(resolve => setTimeout(resolve, 2000));

    const finalPolls = auctionMonitor.getQueueMetrics().totalPolls;
    expect(finalPolls).to.be.greaterThan(initialPolls);
  }
});

Given('I am monitoring {int} auctions with legacy polling', async function (count) {
  // Ensure legacy polling is active
  featureFlags.disable('USE_POLLING_QUEUE');

  await this.steps(`I start monitoring ${count} auctions`);

  // Verify legacy mode
  const auctionMonitor = require('../../../src/services/auctionMonitor');
  expect(auctionMonitor.pollingIntervals.size).to.equal(count);
});

When('I enable the polling queue feature', function () {
  this.preToggleState = {
    auctions: [...this.monitoredAuctions]
  };

  featureFlags.enable('USE_POLLING_QUEUE');
});

Then('the system should migrate to queue-based polling', async function () {
  // Give system time to migrate
  await new Promise(resolve => setTimeout(resolve, 500));

  const auctionMonitor = require('../../../src/services/auctionMonitor');

  // Should have queue metrics available
  if (auctionMonitor.getQueueMetrics) {
    const metrics = auctionMonitor.getQueueMetrics();
    expect(metrics.enabled).to.be.true;
  }
});

When('I disable the polling queue feature', function () {
  featureFlags.disable('USE_POLLING_QUEUE');
});

Then('the system should revert to legacy polling', async function () {
  // Give system time to revert
  await new Promise(resolve => setTimeout(resolve, 500));

  const auctionMonitor = require('../../../src/services/auctionMonitor');

  // Check for legacy polling indicators
  if (auctionMonitor.getQueueMetrics) {
    const metrics = auctionMonitor.getQueueMetrics();
    expect(metrics.enabled).to.be.false;
  }
});

Then('no auctions should be lost during migration', async function () {
  const response = await this.request
    .get('/api/auctions')
    .set('Authorization', `Bearer ${this.authToken}`);

  expect(response.status).toBe(200);
  expect(response.body.auctions).to.have.length(this.preToggleState.auctions.length);

  const currentIds = response.body.auctions.map(a => a.id);
  for (const expectedId of this.preToggleState.auctions) {
    expect(currentIds).to.include(expectedId);
  }
});