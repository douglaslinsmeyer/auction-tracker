/**
 * PollingQueueWrapper
 * Wraps AuctionMonitor to use a priority queue for polling instead of individual timers
 */

const AuctionMonitorClass = require('./AuctionMonitorClass');
const logger = require('../../utils/logger');
const featureFlags = require('../../config/features');

/**
 * Priority queue implementation for auction polling
 */
class PriorityQueue {
  constructor() {
    this.items = [];
  }

  enqueue(auctionId, priority, interval) {
    const item = {
      auctionId,
      priority,
      interval,
      nextPoll: Date.now() + interval,
      lastPoll: Date.now()
    };

    // Insert in priority order (lower nextPoll time = higher priority)
    const index = this.items.findIndex(i => i.nextPoll > item.nextPoll);
    if (index === -1) {
      this.items.push(item);
    } else {
      this.items.splice(index, 0, item);
    }
  }

  dequeue() {
    return this.items.shift();
  }

  peek() {
    return this.items[0];
  }

  remove(auctionId) {
    const index = this.items.findIndex(i => i.auctionId === auctionId);
    if (index !== -1) {
      this.items.splice(index, 1);
      return true;
    }
    return false;
  }

  update(auctionId, updates) {
    const item = this.items.find(i => i.auctionId === auctionId);
    if (item) {
      Object.assign(item, updates);
      // Re-sort after update
      this.items.sort((a, b) => a.nextPoll - b.nextPoll);
      return true;
    }
    return false;
  }

  size() {
    return this.items.length;
  }

  getDueItems(now = Date.now()) {
    const due = [];
    while (this.items.length > 0 && this.items[0].nextPoll <= now) {
      due.push(this.items.shift());
    }
    return due;
  }

  getAllItems() {
    return [...this.items];
  }
}

/**
 * PollingQueueWrapper - Enhances AuctionMonitor with queue-based polling
 */
class PollingQueueWrapper extends AuctionMonitorClass {
  constructor(storage, nellisApi, logger) {
    super(storage, nellisApi, logger);

    // Polling queue state
    this._queue = new PriorityQueue();
    this._queueWorker = null;
    this._queueInterval = 1000; // Check queue every second
    this._maxRequestsPerSecond = 10;
    this._requestCount = 0;
    this._requestCountReset = Date.now();

    // Metrics
    this._metrics = {
      totalPolls: 0,
      queueSize: 0,
      avgPollTime: 0,
      errors: 0
    };
  }

  /**
   * Initialize with queue support
   */
  async initialize(wss, broadcastHandler) {
    await super.initialize(wss, broadcastHandler);

    if (this._isQueueEnabled()) {
      this._startQueueWorker();
      logger.info('Polling queue initialized and worker started');
    }
  }

  /**
   * Add auction with queue support
   */
  async addAuction(auctionId, config, metadata) {
    const result = await super.addAuction(auctionId, config, metadata);

    if (result && this._isQueueEnabled()) {
      // Stop legacy polling timer if it exists
      this._stopLegacyPolling(auctionId);

      // Add to queue with priority based on time remaining
      const auction = this._singleton.monitoredAuctions.get(auctionId);
      const priority = this._calculatePriority(auction);
      const interval = this._calculateInterval(auction);

      this._queue.enqueue(auctionId, priority, interval);
      logger.info(`Auction ${auctionId} added to polling queue with priority ${priority}`);

      // Update metrics
      this._metrics.queueSize = this._queue.size();
    }

    return result;
  }

  /**
   * Remove auction with queue support
   */
  removeAuction(auctionId) {
    if (this._isQueueEnabled()) {
      this._queue.remove(auctionId);
      this._metrics.queueSize = this._queue.size();
      logger.info(`Auction ${auctionId} removed from polling queue`);
    }

    return super.removeAuction(auctionId);
  }

  /**
   * Update auction polling rate
   */
  updatePollingRate(auctionId, interval) {
    if (this._isQueueEnabled()) {
      const updated = this._queue.update(auctionId, {
        interval,
        nextPoll: Date.now() + interval
      });

      if (updated) {
        logger.info(`Updated polling rate for auction ${auctionId} to ${interval}ms`);
      }
    } else {
      // Fall back to legacy method if it exists
      if (this._singleton.adjustPollingRate) {
        this._singleton.adjustPollingRate(auctionId, interval);
      }
    }
  }

  /**
   * Shutdown with queue cleanup
   */
  shutdown() {
    if (this._queueWorker) {
      clearInterval(this._queueWorker);
      this._queueWorker = null;
      logger.info('Polling queue worker stopped');
    }

    super.shutdown();
  }

  /**
   * Get queue metrics
   */
  getQueueMetrics() {
    return {
      ...this._metrics,
      enabled: this._isQueueEnabled(),
      items: this._queue.getAllItems().map(item => ({
        auctionId: item.auctionId,
        nextPoll: new Date(item.nextPoll).toISOString(),
        interval: item.interval
      }))
    };
  }

  // Private methods

  _isQueueEnabled() {
    return featureFlags.isEnabled('USE_POLLING_QUEUE');
  }

  _startQueueWorker() {
    if (this._queueWorker) { return; }

    this._queueWorker = setInterval(() => {
      this._processQueue();
    }, this._queueInterval);

    logger.info('Polling queue worker started');
  }

  async _processQueue() {
    try {
      // Rate limiting
      if (this._shouldResetRateLimit()) {
        this._requestCount = 0;
        this._requestCountReset = Date.now();
      }

      // Get due items
      const now = Date.now();
      const dueItems = this._queue.getDueItems(now);

      // Process due items (respecting rate limit)
      for (const item of dueItems) {
        if (this._requestCount >= this._maxRequestsPerSecond) {
          // Reschedule for next second
          item.nextPoll = this._requestCountReset + 1000;
          this._queue.enqueue(item.auctionId, item.priority, item.interval);
          continue;
        }

        // Process the poll
        await this._pollAuction(item);
        this._requestCount++;

        // Reschedule for next poll
        item.nextPoll = now + item.interval;
        item.lastPoll = now;
        this._queue.enqueue(item.auctionId, item.priority, item.interval);
      }

      // Update metrics
      this._metrics.queueSize = this._queue.size();

    } catch (error) {
      logger.error('Error processing polling queue:', error);
      this._metrics.errors++;
    }
  }

  async _pollAuction(item) {
    const startTime = Date.now();

    try {
      // Use the singleton's updateAuction method
      await this._singleton.updateAuction(item.auctionId);

      // Update metrics
      this._metrics.totalPolls++;
      const pollTime = Date.now() - startTime;
      this._metrics.avgPollTime =
        (this._metrics.avgPollTime * (this._metrics.totalPolls - 1) + pollTime) /
        this._metrics.totalPolls;

    } catch (error) {
      logger.error(`Error polling auction ${item.auctionId}:`, error);
      this._metrics.errors++;

      // Adjust interval on repeated failures
      if (item.consecutiveErrors) {
        item.consecutiveErrors++;
        item.interval = Math.min(item.interval * 2, 60000); // Max 1 minute
      } else {
        item.consecutiveErrors = 1;
      }
    }
  }

  _calculatePriority(auction) {
    if (!auction || !auction.data) { return 1000; }

    const { timeRemaining, isWinning } = auction.data;

    // Higher priority (lower number) for:
    // - Auctions ending soon
    // - Auctions we're not winning
    let priority = timeRemaining || 999999;

    if (!isWinning) {
      priority = priority * 0.8; // 20% higher priority
    }

    return Math.floor(priority);
  }

  _calculateInterval(auction) {
    if (!auction || !auction.data) {
      return this._singleton.defaultPollingInterval || 6000;
    }

    const { timeRemaining } = auction.data;

    // More frequent polling as auction ends
    if (timeRemaining < 30) { return 2000; } // 2 seconds
    if (timeRemaining < 60) { return 3000; } // 3 seconds
    if (timeRemaining < 300) { return 5000; } // 5 seconds
    if (timeRemaining < 600) { return 10000; } // 10 seconds

    return this._singleton.defaultPollingInterval || 6000;
  }

  _stopLegacyPolling(auctionId) {
    // Access the singleton's polling intervals map
    if (this._singleton.pollingIntervals) {
      const interval = this._singleton.pollingIntervals.get(auctionId);
      if (interval) {
        clearInterval(interval);
        this._singleton.pollingIntervals.delete(auctionId);
        logger.info(`Stopped legacy polling for auction ${auctionId}`);
      }
    }
  }

  _shouldResetRateLimit() {
    return Date.now() - this._requestCountReset >= 1000;
  }

  /**
   * Static factory method
   */
  static getInstance(storage, nellisApi, logger) {
    return new PollingQueueWrapper(storage, nellisApi, logger);
  }
}

module.exports = PollingQueueWrapper;