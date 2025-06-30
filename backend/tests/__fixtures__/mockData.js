module.exports = {
  mockAuction: {
    id: '12345',
    title: 'Test Auction Item',
    url: 'https://www.nellisauction.com/p/Test-Item/12345',
    imageUrl: 'https://example.com/image.jpg',
    config: {
      maxBid: 100,
      bidIncrement: 5,
      strategy: 'auto',
      autoBid: true,
      notifyOnOutbid: true,
      notifyOnEnd: true
    }
  },

  mockAuctionData: {
    id: 12345,
    title: 'Test Auction Item',
    currentBid: 25,
    nextBid: 30,
    minimumBid: 30, // Same as nextBid - minimum required bid
    bidCount: 5,
    bidderCount: 3,
    isWinning: false,
    isWatching: true,
    isClosed: false,
    marketStatus: 'open',
    closeTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    extensionInterval: 30,
    retailPrice: 150,
    timeRemaining: 3600,
    location: {
      id: 10,
      name: 'Phoenix',
      offsite: false,
      timezone: 'America/Phoenix',
      address: '1402 S 40th Ave',
      city: 'Phoenix',
      state: 'AZ',
      zipCode: 85009
    },
    inventoryNumber: '1234567890'
  },

  mockCookies: 'sessionId=abc123; userId=user456; auth=token789',

  mockBidResponse: {
    success: true,
    data: {
      message: 'Bid placed successfully',
      data: {
        bidCount: 6,
        currentAmount: 30,
        minimumNextBid: 35,
        winningBidUserId: 123456,
        bidderCount: 4,
        projectNewCloseTime: {
          __type: 'Date',
          value: new Date(Date.now() + 3600000).toISOString()
        },
        projectExtended: false
      }
    }
  },

  mockOutbidResponse: {
    success: true,
    data: {
      message: 'Your bid has been accepted, but another user has a higher maximum bid.',
      data: {
        bidCount: 7,
        currentAmount: 35,
        minimumNextBid: 40,
        winningBidUserId: 789012,
        bidderCount: 4,
        projectNewCloseTime: {
          __type: 'Date',
          value: new Date(Date.now() + 3600000).toISOString()
        },
        projectExtended: true
      }
    }
  }
};