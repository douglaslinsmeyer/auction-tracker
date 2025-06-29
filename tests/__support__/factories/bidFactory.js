const AuctionFactory = require('./auctionFactory');
const UserFactory = require('./userFactory');

class BidFactory {
  static create(overrides = {}) {
    const defaults = {
      id: this.generateId(),
      auctionId: AuctionFactory.generateId(),
      amount: 100,
      userId: UserFactory.generateId(),
      timestamp: new Date(),
      status: 'pending',
      isAutoBid: false,
      strategy: 'manual'
    };
    
    return { ...defaults, ...overrides };
  }
  
  static createSuccessful(overrides = {}) {
    return this.create({
      status: 'successful',
      confirmedAt: new Date(),
      ...overrides
    });
  }
  
  static createFailed(reason = 'Outbid', overrides = {}) {
    return this.create({
      status: 'failed',
      failureReason: reason,
      failedAt: new Date(),
      ...overrides
    });
  }
  
  static createAutoBid(strategy, overrides = {}) {
    return this.create({
      isAutoBid: true,
      strategy,
      ...overrides
    });
  }
  
  static createBidSequence(auctionId, count = 5, startAmount = 50) {
    const bids = [];
    let currentAmount = startAmount;
    
    for (let i = 0; i < count; i++) {
      currentAmount += 5;
      bids.push(this.create({
        auctionId,
        amount: currentAmount,
        userId: `USR${i}`,
        timestamp: new Date(Date.now() - (count - i) * 30000),
        status: i === count - 1 ? 'successful' : 'outbid'
      }));
    }
    
    return bids;
  }
  
  static generateId() {
    return 'BID' + Math.random().toString(36).substr(2, 9).toUpperCase();
  }
}

module.exports = BidFactory;