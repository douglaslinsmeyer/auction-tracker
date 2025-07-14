class AuctionFactory {
  static create(overrides = {}) {
    const defaults = {
      id: this.generateId(),
      title: 'Test Auction Item',
      currentBid: 50,
      timeLeft: 300,
      status: 'active',
      createdAt: new Date(),
      endTime: new Date(Date.now() + 300000),
      minimumBid: 5,
      bidHistory: [],
      isMonitored: false
    };

    return { ...defaults, ...overrides };
  }

  static createEnding(overrides = {}) {
    return this.create({
      timeLeft: 30,
      endTime: new Date(Date.now() + 30000),
      ...overrides
    });
  }

  static createEnded(overrides = {}) {
    return this.create({
      status: 'ended',
      timeLeft: 0,
      endTime: new Date(Date.now() - 1000),
      endedAt: new Date(),
      ...overrides
    });
  }

  static createWithBids(bidCount = 3, overrides = {}) {
    const auction = this.create(overrides);
    const bidHistory = [];
    let currentBid = auction.currentBid;

    for (let i = 0; i < bidCount; i++) {
      currentBid += auction.minimumBid;
      bidHistory.push({
        amount: currentBid,
        bidder: `bidder${i + 1}`,
        timestamp: new Date(Date.now() - (bidCount - i) * 60000)
      });
    }

    auction.currentBid = currentBid;
    auction.bidHistory = bidHistory;
    return auction;
  }

  static generateId() {
    return 'AUC' + Math.random().toString(36).substr(2, 9).toUpperCase();
  }
}

module.exports = AuctionFactory;