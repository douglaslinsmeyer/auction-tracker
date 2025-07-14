// Mock for Nellis API
const { AuctionFactory } = require('../__support__/factories/auctionFactory');

class NellisApiMock {
  constructor() {
    this.auctions = new Map();
    this.responses = new Map();
    this.failureCount = 0;
    this.shouldFail = false;
    this.delay = 0;
  }

  // Configuration methods for testing
  setMockResponse(endpoint, response) {
    this.responses.set(endpoint, response);
  }

  setShouldFail(shouldFail, failureCount = Infinity) {
    this.shouldFail = shouldFail;
    this.failureCount = failureCount;
  }

  setDelay(ms) {
    this.delay = ms;
  }

  // API methods
  async getAuction(auctionId) {
    await this._simulateNetwork();

    if (this.shouldFail && this.failureCount > 0) {
      this.failureCount--;
      throw new Error('Network error: Unable to fetch auction');
    }

    if (this.responses.has(`auction-${auctionId}`)) {
      return this.responses.get(`auction-${auctionId}`);
    }

    // Return from cache or create new
    if (!this.auctions.has(auctionId)) {
      this.auctions.set(auctionId, AuctionFactory.create({ id: auctionId }));
    }

    return this.auctions.get(auctionId);
  }

  async placeBid(auctionId, amount, cookies) {
    await this._simulateNetwork();

    if (this.shouldFail && this.failureCount > 0) {
      this.failureCount--;
      throw new Error('Network error: Unable to place bid');
    }

    if (!cookies || !cookies.sessionId) {
      throw new Error('Authentication required');
    }

    const auction = await this.getAuction(auctionId);

    if (amount <= auction.currentBid) {
      return {
        success: false,
        error: 'Bid amount must be higher than current bid',
        currentBid: auction.currentBid,
        minimumBid: auction.currentBid + auction.minimumBid
      };
    }

    // Update auction
    auction.currentBid = amount;
    auction.bidHistory.push({
      amount,
      bidder: 'current_user',
      timestamp: new Date()
    });

    return {
      success: true,
      newBid: amount,
      message: 'Bid placed successfully',
      auction: auction
    };
  }

  async authenticate(cookies) {
    await this._simulateNetwork();

    if (this.shouldFail && this.failureCount > 0) {
      this.failureCount--;
      throw new Error('Authentication failed');
    }

    if (!cookies || !cookies.sessionId) {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      userId: 'mock-user-id',
      sessionId: cookies.sessionId
    };
  }

  async searchAuctions(query, options = {}) {
    await this._simulateNetwork();

    if (this.shouldFail && this.failureCount > 0) {
      this.failureCount--;
      throw new Error('Search failed');
    }

    const { limit = 10, offset = 0 } = options;
    const auctions = [];

    for (let i = 0; i < limit; i++) {
      auctions.push(AuctionFactory.create({
        title: `${query} Item ${i + offset + 1}`
      }));
    }

    return {
      results: auctions,
      total: 100,
      limit,
      offset
    };
  }

  async _simulateNetwork() {
    if (this.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }
  }

  // Test helpers
  _reset() {
    this.auctions.clear();
    this.responses.clear();
    this.failureCount = 0;
    this.shouldFail = false;
    this.delay = 0;
  }

  _getAuctions() {
    return new Map(this.auctions);
  }
}

// Create singleton instance
const nellisApiMock = new NellisApiMock();

module.exports = nellisApiMock;
module.exports.NellisApiMock = NellisApiMock;