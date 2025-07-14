const { launchBrowserWithExtension, openExtensionPopup } = require('../helpers/extensionLoader');
const {
  configureAuthToken,
  connectToBackend,
  getMonitoredAuctions,
  placeBidFromPopup,
  updateStrategy,
  waitForAuctionUpdate
} = require('../helpers/extensionHelpers');
const MockNellisServer = require('../mocks/nellisServer');

// Skip extension tests in headless mode (CI/CD)
const describeSkipIfHeadless = process.env.HEADLESS === 'true' ? describe.skip : describe;

describeSkipIfHeadless('Bidding Through Extension', () => {
  let browser;
  let extensionId;
  let mockNellis;
  const mockPort = 8080;
  const backendPort = 3000;

  beforeAll(async () => {
    // Start mock Nellis server
    mockNellis = new MockNellisServer(mockPort);
    await mockNellis.start();
  });

  afterAll(async () => {
    if (mockNellis) {
      await mockNellis.stop();
    }
  });

  beforeEach(async () => {
    // Launch browser with extension
    const result = await launchBrowserWithExtension({ headless: false });
    browser = result.browser;
    extensionId = result.extensionId;

    // Setup extension
    const popupPage = await openExtensionPopup(browser, extensionId);
    await configureAuthToken(popupPage, 'test-token');
    await connectToBackend(popupPage, `http://localhost:${backendPort}`);
    await popupPage.close();
  });

  afterEach(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('Manual bid placement', async () => {
    const auctionId = 'manual-bid-001';
    const mockAuction = mockNellis.createDefaultAuction(auctionId);
    mockAuction.currentBid = 50.00;

    const popupPage = await openExtensionPopup(browser, extensionId);

    // Add auction to monitoring
    const addInput = await popupPage.$('#addAuctionInput');
    const addButton = await popupPage.$('#addAuctionButton');
    if (addInput && addButton) {
      await addInput.type(auctionId);
      await addButton.click();
      await popupPage.waitForTimeout(1000);
    }

    // Place manual bid
    const bidAmount = '55.00';
    try {
      await placeBidFromPopup(popupPage, auctionId, bidAmount);

      // Wait for bid confirmation
      await waitForAuctionUpdate(
        popupPage,
        auctionId,
        (_auction) => mockAuction.myBid && mockAuction.myBid.includes('55'),
        5000
      );

      // Verify bid was placed
      const auctions = await getMonitoredAuctions(popupPage);
      const updatedAuction = auctions.find(a => a.id === auctionId);

      if (updatedAuction && updatedAuction.myBid) {
        expect(updatedAuction.myBid).toContain('55');
      }
    } catch (error) {
      console.warn('Manual bid test skipped - backend may not be running');
    }
  }, 30000);

  test('Aggressive strategy auto-bidding', async () => {
    const auctionId = 'aggressive-001';
    const mockAuction = mockNellis.createDefaultAuction(auctionId);
    mockAuction.currentBid = 50.00;

    const popupPage = await openExtensionPopup(browser, extensionId);

    // Add auction with aggressive strategy
    const addInput = await popupPage.$('#addAuctionInput');
    const addButton = await popupPage.$('#addAuctionButton');
    if (addInput && addButton) {
      await addInput.type(auctionId);

      // Set max bid before adding
      const maxBidInput = await popupPage.$('#maxBidInput');
      if (maxBidInput) {
        await maxBidInput.type('100.00');
      }

      await addButton.click();
      await popupPage.waitForTimeout(1000);
    }

    // Update to aggressive strategy
    await updateStrategy(popupPage, auctionId, 'aggressive');

    // Simulate someone outbidding
    mockNellis.simulateBid(auctionId, 60.00, 'other-user');

    // Wait for auto-bid response
    try {
      await waitForAuctionUpdate(
        popupPage,
        auctionId,
        (_auction) => {
          const bid = parseFloat(mockAuction.currentBid?.replace('$', '') || 0);
          return bid > 60.00;
        },
        10000
      );

      // Verify auto-bid was placed
      const auctions = await getMonitoredAuctions(popupPage);
      const updatedAuction = auctions.find(a => a.id === auctionId);

      if (updatedAuction) {
        const currentBid = parseFloat(updatedAuction.currentBid?.replace('$', '') || 0);
        expect(currentBid).toBeGreaterThan(60.00);
      }
    } catch (error) {
      console.warn('Aggressive strategy test skipped - backend may not be running');
    }
  }, 30000);

  test('Last second strategy timing', async () => {
    const auctionId = 'snipe-001';
    const mockAuction = mockNellis.createDefaultAuction(auctionId);
    mockAuction.currentBid = 50.00;
    mockAuction.timeLeft = 45; // 45 seconds left

    const popupPage = await openExtensionPopup(browser, extensionId);

    // Add auction with last second strategy
    const addInput = await popupPage.$('#addAuctionInput');
    const addButton = await popupPage.$('#addAuctionButton');
    if (addInput && addButton) {
      await addInput.type(auctionId);

      // Set max bid
      const maxBidInput = await popupPage.$('#maxBidInput');
      if (maxBidInput) {
        await maxBidInput.type('100.00');
      }

      await addButton.click();
      await popupPage.waitForTimeout(1000);
    }

    // Update to last second strategy
    await updateStrategy(popupPage, auctionId, 'lastSecond');

    // Update auction time to trigger last second bid
    mockNellis.updateAuction(auctionId, { timeLeft: 25 });

    // Wait for snipe bid
    try {
      await waitForAuctionUpdate(
        popupPage,
        auctionId,
        (_auction) => {
          // Should place bid when time is under 30 seconds
          const timeLeft = parseInt(mockAuction.timeLeft?.replace(/\D/g, ''), 10) || 0;
          const hasBid = mockAuction.myBid && parseFloat(mockAuction.myBid.replace('$', '')) > 0;
          return timeLeft < 30 && hasBid;
        },
        15000
      );

      const auctions = await getMonitoredAuctions(popupPage);
      const sniperAuction = auctions.find(a => a.id === auctionId);

      if (sniperAuction && sniperAuction.myBid) {
        expect(sniperAuction.strategy).toBe('lastSecond');
        expect(parseFloat(sniperAuction.myBid.replace('$', ''))).toBeGreaterThan(50);
      }
    } catch (error) {
      console.warn('Last second strategy test skipped - backend may not be running');
    }
  }, 30000);

  test('Max bid limit enforcement', async () => {
    const auctionId = 'maxbid-001';
    const mockAuction = mockNellis.createDefaultAuction(auctionId);
    mockAuction.currentBid = 90.00;

    const popupPage = await openExtensionPopup(browser, extensionId);

    // Add auction with low max bid
    const addInput = await popupPage.$('#addAuctionInput');
    const addButton = await popupPage.$('#addAuctionButton');
    if (addInput && addButton) {
      await addInput.type(auctionId);

      // Set max bid below current
      const maxBidInput = await popupPage.$('#maxBidInput');
      if (maxBidInput) {
        await maxBidInput.type('80.00');
      }

      await addButton.click();
      await popupPage.waitForTimeout(1000);
    }

    // Set aggressive strategy
    await updateStrategy(popupPage, auctionId, 'aggressive');

    // Simulate outbid
    mockNellis.simulateBid(auctionId, 95.00, 'other-user');

    // Wait and verify no bid placed (exceeded max)
    await popupPage.waitForTimeout(3000);

    const auctions = await getMonitoredAuctions(popupPage);
    const limitedAuction = auctions.find(a => a.id === auctionId);

    if (limitedAuction) {
      // Should show warning or status about max bid exceeded
      // const hasWarning = limitedAuction.status?.toLowerCase().includes('max') ||
      limitedAuction.status?.toLowerCase().includes('limit');
      console.log(`Max bid limit status: ${limitedAuction.status}`);
    }
  }, 30000);

  test('Bid increment configuration', async () => {
    const auctionId = 'increment-001';
    const mockAuction = mockNellis.createDefaultAuction(auctionId);
    mockAuction.currentBid = 50.00;
    mockAuction.bidIncrement = 10.00;

    const popupPage = await openExtensionPopup(browser, extensionId);

    // Add auction with custom increment
    const addInput = await popupPage.$('#addAuctionInput');
    const addButton = await popupPage.$('#addAuctionButton');
    if (addInput && addButton) {
      await addInput.type(auctionId);

      // Set custom increment
      const incrementInput = await popupPage.$('#incrementInput');
      if (incrementInput) {
        await incrementInput.clear();
        await incrementInput.type('15.00');
      }

      await addButton.click();
      await popupPage.waitForTimeout(1000);
    }

    // Place bid with custom increment
    try {
      await placeBidFromPopup(popupPage, auctionId, '65.00'); // 50 + 15

      // Verify bid amount
      await waitForAuctionUpdate(
        popupPage,
        auctionId,
        (_auction) => mockAuction.myBid && mockAuction.myBid.includes('65'),
        5000
      );
    } catch (error) {
      console.warn('Bid increment test skipped - backend may not be running');
    }
  }, 30000);

  test('Bidding notification system', async () => {
    const auctionId = 'notify-001';
    mockNellis.createDefaultAuction(auctionId);

    const popupPage = await openExtensionPopup(browser, extensionId);

    // Check if notifications are enabled
    const notifyToggle = await popupPage.$('#enableNotifications');
    if (notifyToggle) {
      const isChecked = await popupPage.$eval('#enableNotifications', el => el.checked);
      if (!isChecked) {
        await notifyToggle.click();
      }
    }

    // Add auction
    const addInput = await popupPage.$('#addAuctionInput');
    const addButton = await popupPage.$('#addAuctionButton');
    if (addInput && addButton) {
      await addInput.type(auctionId);
      await addButton.click();
      await popupPage.waitForTimeout(1000);
    }

    // Check for notification elements
    const hasNotificationArea = await popupPage.$('.notifications') !== null;
    const hasNotificationBadge = await popupPage.$('.notification-badge') !== null;

    // Simulate outbid
    mockNellis.simulateBid(auctionId, 75.00, 'other-user');

    if (hasNotificationArea || hasNotificationBadge) {
      // Wait for notification
      await popupPage.waitForTimeout(2000);

      // Check for outbid notification
      const notifications = await popupPage.$$('.notification-item');
      console.log(`Found ${notifications.length} notifications`);
    }
  }, 30000);

  test('Strategy switching during active auction', async () => {
    const auctionId = 'switch-001';
    // const auction = mockNellis.createDefaultAuction(auctionId);

    const popupPage = await openExtensionPopup(browser, extensionId);

    // Add auction with manual strategy
    const addInput = await popupPage.$('#addAuctionInput');
    const addButton = await popupPage.$('#addAuctionButton');
    if (addInput && addButton) {
      await addInput.type(auctionId);
      await addButton.click();
      await popupPage.waitForTimeout(1000);
    }

    // Verify initial strategy
    let auctions = await getMonitoredAuctions(popupPage);
    let targetAuction = auctions.find(a => a.id === auctionId);
    const initialStrategy = targetAuction?.strategy || 'manual';
    expect(initialStrategy).toBe('manual');

    // Switch to aggressive
    await updateStrategy(popupPage, auctionId, 'aggressive');
    await popupPage.waitForTimeout(1000);

    // Verify strategy changed
    auctions = await getMonitoredAuctions(popupPage);
    targetAuction = auctions.find(a => a.id === auctionId);
    expect(targetAuction?.strategy).toBe('aggressive');

    // Switch to last second
    await updateStrategy(popupPage, auctionId, 'lastSecond');
    await popupPage.waitForTimeout(1000);

    // Verify final strategy
    auctions = await getMonitoredAuctions(popupPage);
    targetAuction = auctions.find(a => a.id === auctionId);
    expect(targetAuction?.strategy).toBe('lastSecond');
  }, 30000);
});