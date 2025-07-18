/**
 * Test cleanup utilities to prevent "Cannot log after tests are done" errors
 * Tracks and cleans up resources created during tests
 */

class TestCleanupManager {
  constructor() {
    this.resources = {
      timers: new Set(),
      intervals: new Set(),
      sockets: new Set(),
      servers: new Set(),
      eventSources: new Set(),
      promises: new Set()
    };
  }

  /**
   * Track a timeout for cleanup
   */
  setTimeout(callback, delay) {
    const timer = setTimeout(() => {
      this.resources.timers.delete(timer);
      callback();
    }, delay);
    this.resources.timers.add(timer);
    return timer;
  }

  /**
   * Track an interval for cleanup
   */
  setInterval(callback, delay) {
    const interval = setInterval(callback, delay);
    this.resources.intervals.add(interval);
    return interval;
  }

  /**
   * Clear a specific timeout
   */
  clearTimeout(timer) {
    clearTimeout(timer);
    this.resources.timers.delete(timer);
  }

  /**
   * Clear a specific interval
   */
  clearInterval(interval) {
    clearInterval(interval);
    this.resources.intervals.delete(interval);
  }

  /**
   * Track a WebSocket for cleanup
   */
  trackWebSocket(ws) {
    this.resources.sockets.add(ws);

    // Auto-remove when closed
    const originalClose = ws.close.bind(ws);
    ws.close = () => {
      originalClose();
      this.resources.sockets.delete(ws);
    };

    return ws;
  }

  /**
   * Track a server for cleanup
   */
  trackServer(server) {
    this.resources.servers.add(server);
    return server;
  }

  /**
   * Track an EventSource for cleanup
   */
  trackEventSource(eventSource) {
    this.resources.eventSources.add(eventSource);

    // Auto-remove when closed
    if (eventSource.close) {
      const originalClose = eventSource.close.bind(eventSource);
      eventSource.close = () => {
        originalClose();
        this.resources.eventSources.delete(eventSource);
      };
    }

    return eventSource;
  }

  /**
   * Track a promise that should complete before test ends
   */
  trackPromise(promise) {
    this.resources.promises.add(promise);

    // Auto-remove when resolved/rejected
    promise
      .then(() => this.resources.promises.delete(promise))
      .catch(() => this.resources.promises.delete(promise));

    return promise;
  }

  /**
   * Clean up all tracked resources
   */
  async cleanup() {
    // Clear all timers
    this.resources.timers.forEach(timer => clearTimeout(timer));
    this.resources.timers.clear();

    // Clear all intervals
    this.resources.intervals.forEach(interval => clearInterval(interval));
    this.resources.intervals.clear();

    // Close all WebSockets
    const socketClosePromises = Array.from(this.resources.sockets).map(ws => {
      return new Promise(resolve => {
        if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
          ws.once('close', resolve);
          ws.close();
        } else {
          resolve();
        }
      });
    });
    await Promise.all(socketClosePromises);
    this.resources.sockets.clear();

    // Close all servers
    const serverClosePromises = Array.from(this.resources.servers).map(server => {
      return new Promise(resolve => {
        if (server.listening) {
          server.close(resolve);
        } else {
          resolve();
        }
      });
    });
    await Promise.all(serverClosePromises);
    this.resources.servers.clear();

    // Close all EventSources
    this.resources.eventSources.forEach(es => {
      if (es.close) {
        es.close();
      }
    });
    this.resources.eventSources.clear();

    // Wait for all tracked promises
    const pendingPromises = Array.from(this.resources.promises);
    if (pendingPromises.length > 0) {
      // Give promises 5 seconds to complete
      await Promise.race([
        Promise.all(pendingPromises),
        new Promise(resolve => setTimeout(resolve, 5000))
      ]);
    }
    this.resources.promises.clear();
  }

  /**
   * Setup hooks for Jest
   */
  setupJestHooks() {
    beforeEach(() => {
      // Clear any resources from previous tests
      this.cleanup();
    });

    afterEach(async () => {
      await this.cleanup();
    });

    afterAll(async () => {
      await this.cleanup();
    });
  }
}

// Export singleton instance
module.exports = new TestCleanupManager();