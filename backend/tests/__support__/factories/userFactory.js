class UserFactory {
  static create(overrides = {}) {
    const defaults = {
      id: this.generateId(),
      email: `test${Date.now()}@example.com`,
      maxBid: 500,
      strategy: 'manual',
      isAuthenticated: true,
      cookies: this.generateCookies(),
      preferences: {
        notifications: true,
        autoBid: false,
        bidIncrement: 5
      },
      statistics: {
        totalBids: 0,
        auctionsWon: 0,
        totalSpent: 0
      }
    };

    return { ...defaults, ...overrides };
  }

  static createWithStrategy(strategy, overrides = {}) {
    return this.create({
      strategy,
      preferences: {
        ...this.create().preferences,
        autoBid: strategy !== 'manual'
      },
      ...overrides
    });
  }

  static createUnauthenticated(overrides = {}) {
    return this.create({
      isAuthenticated: false,
      cookies: null,
      ...overrides
    });
  }

  static generateId() {
    return 'USR' + Math.random().toString(36).substr(2, 9);
  }

  static generateCookies() {
    // Mock cookie structure similar to Nellis
    return {
      sessionId: 'mock-session-' + Math.random().toString(36).substr(2, 9),
      authToken: 'mock-auth-' + Math.random().toString(36).substr(2, 9),
      expires: new Date(Date.now() + 86400000) // 24 hours
    };
  }
}

module.exports = UserFactory;