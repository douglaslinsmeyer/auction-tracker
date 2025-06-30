console.log('Nellis Auction Helper: Background service worker started');

// Import backend client and config
importScripts('./config.js');
importScripts('./backend-client.js');

let monitoredAuctions = new Map();
let backendClient = new BackendClient();

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ 
    bidSettings: {
      defaultMaxBid: 0,
      incrementAmount: 1,
      strategy: CONFIG.EXTENSION.DEFAULT_STRATEGY
    },
    notifications: {
      enabled: true,
      outbid: true,
      won: true
    },
    backend: {
      url: CONFIG.BACKEND.DEFAULT_URL,
      token: CONFIG.BACKEND.DEFAULT_TOKEN
    },
    backendUrl: CONFIG.BACKEND.DEFAULT_URL
  });
  
  console.log('Extension installed with default settings');
});

// Always initialize backend on startup
initializeBackend();

chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'local') {
    if (changes.backend) {
      // Reconnect if backend config changes
      await backendClient.disconnect();
      await initializeBackend();
    }
  }
});

async function initializeBackend() {
  try {
    console.log('Initializing backend connection...');
    await backendClient.initialize();
    
    // Set up event listeners
    backendClient.on('auctionState', handleAuctionState);
    backendClient.on('notification', handleBackendNotification);
    backendClient.on('connected', handleBackendConnected);
    backendClient.on('disconnected', handleBackendDisconnected);
    
    // Sync monitored auctions with backend
    await syncWithBackend();
    
    console.log('Backend initialization complete. Status:', await backendClient.getBackendStatus());
  } catch (error) {
    console.error('Failed to initialize backend:', error);
  }
}

function handleAuctionState(data) {
  // Replace entire auction state from backend (single source of truth)
  const auction = data.auction;
  if (!auction || !auction.id) return;
  
  console.log('Received auction state update:', auction.id);
  
  // Update local cache
  monitoredAuctions.set(auction.id, auction);
  updateBadge();
  
  // Forward complete state to all content scripts
  chrome.tabs.query({url: ["https://www.nellisauction.com/*", "https://nellisauction.com/*"]}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        action: 'auctionState',
        auction: auction
      }).catch(() => {});
    });
  });
  
  // Forward to popup if open
  chrome.runtime.sendMessage({
    type: 'auctionState',
    auction: auction
  }).catch(() => {});
}

function handleBackendNotification(notification) {
  // Show Chrome notification
  chrome.storage.local.get(['notifications'], (result) => {
    const settings = result.notifications || { enabled: true };
    
    if (settings.enabled) {
      let message = '';
      switch (notification.type) {
        case 'outbid':
          message = `You've been outbid! Current bid: $${notification.currentBid}`;
          break;
        case 'won':
          message = `Congratulations! You won with $${notification.finalPrice}`;
          break;
        case 'lost':
          message = `Auction ended. Final price: $${notification.finalPrice}`;
          break;
        default:
          message = notification.message || 'Auction update';
      }
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('assets/icons/icon-128.png'),
        title: 'Nellis Auction',
        message: message,
        priority: 2
      });
    }
  });
}

function handleBackendConnected() {
  console.log('Backend connected');
  chrome.runtime.sendMessage({ type: 'backendConnected' }).catch(() => {});
}

function handleBackendDisconnected() {
  console.log('Backend disconnected');
  chrome.runtime.sendMessage({ type: 'backendDisconnected' }).catch(() => {});
}

async function syncWithBackend() {
  try {
    // Sync cookies
    const cookieResult = await backendClient.syncCookies();
    if (!cookieResult.success) {
      console.warn('Cookie sync failed:', cookieResult.error);
    }
  } catch (error) {
    console.error('Failed to sync with backend:', error);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Check backend connection for monitoring actions
  if ((request.action === 'startMonitoring' || request.action === 'stopMonitoring') && !backendClient.isConnected) {
    sendResponse({ success: false, error: 'Backend not connected' });
    return;
  }
  
  switch (request.action) {
    case 'startMonitoring':
      handleStartMonitoring(request.auctionId, request.auctionData, request.config)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'stopMonitoring':
      handleStopMonitoring(request.auctionId)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'getMonitoredAuctions':
      backendClient.getMonitoredAuctions()
        .then(response => {
          const auctions = response.auctions || [];
          sendResponse({ auctions });
        })
        .catch(error => {
          console.error('Error getting auctions:', error);
          sendResponse({ auctions: [] });
        });
      return true;
      
    case 'clearAllAuctions':
      clearAllMonitoring()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'getBackendStatus':
      backendClient.getBackendStatus()
        .then(status => sendResponse(status))
        .catch(error => sendResponse({ connected: false, error: error.message }));
      return true;
      
    case 'updateAuctionConfig':
      handleUpdateAuctionConfig(request.auctionId, request.config)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'testBackendConnection':
      testBackendConnection(request.url, request.token)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'settingsUpdated':
      handleSettingsUpdate(request.settings)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
  }
});

async function handleStartMonitoring(auctionId, auctionData, providedConfig) {
  const settings = await chrome.storage.local.get(['bidSettings']);
  
  // Use provided config if available, otherwise fall back to defaults
  const config = providedConfig || {
    maxBid: settings.bidSettings?.defaultMaxBid || 0,
    incrementAmount: settings.bidSettings?.incrementAmount || 1,
    strategy: settings.bidSettings?.strategy || CONFIG.EXTENSION.DEFAULT_STRATEGY
  };
  
  const metadata = {
    source: 'extension',
    title: auctionData.title || 'Unknown',
    url: auctionData.url || `https://www.nellisauction.com/p/${auctionId}`,
    imageUrl: auctionData.imageUrl || null,
    timestamp: Date.now()
  };
  
  await backendClient.startMonitoring(auctionId, config, metadata);
  
  monitoredAuctions.set(auctionId, {
    id: auctionId,
    title: auctionData.title
  });
  
  updateBadge();
}

async function handleStopMonitoring(auctionId) {
  await backendClient.stopMonitoring(auctionId);
  monitoredAuctions.delete(auctionId);
  updateBadge();
}

async function handleUpdateAuctionConfig(auctionId, config) {
  try {
    if (!backendClient.isConnected) {
      throw new Error('Backend not connected');
    }
    
    console.log(`Updating config for auction ${auctionId}:`, config);
    await backendClient.updateConfig(auctionId, config);
    
    // Update local record if we have it
    const auction = monitoredAuctions.get(auctionId);
    if (auction) {
      auction.config = { ...auction.config, ...config };
    }
    
    // Notify other tabs about the config update
    const tabs = await chrome.tabs.query({url: ["https://www.nellisauction.com/*", "https://nellisauction.com/*"]});
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'configUpdated',
        auctionId: auctionId,
        config: config
      }).catch(() => {});
    }
  } catch (error) {
    console.error('Error updating auction config:', error);
    throw error;
  }
}

async function clearAllMonitoring() {
  try {
    // Get actual list from backend to ensure we clear everything
    const response = await backendClient.getMonitoredAuctions();
    const backendAuctions = response.auctions || [];
    
    // Combine backend auctions with local auctions to ensure we clear all
    const allAuctionIds = new Set([
      ...backendAuctions.map(a => a.id),
      ...Array.from(monitoredAuctions.keys())
    ]);
    
    const promises = Array.from(allAuctionIds).map(id => 
      backendClient.stopMonitoring(id).catch(err => 
        console.error(`Failed to stop monitoring ${id}:`, err)
      )
    );
    
    await Promise.all(promises);
    monitoredAuctions.clear();
    updateBadge();
    
    // Notify all tabs that monitoring has been cleared
    const tabs = await chrome.tabs.query({url: ["https://www.nellisauction.com/*", "https://nellisauction.com/*"]});
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'allMonitoringCleared',
        auctionIds: Array.from(allAuctionIds)
      }).catch(() => {});
    }
  } catch (error) {
    console.error('Error clearing all monitoring:', error);
    throw error;
  }
}

function updateBadge() {
  const count = monitoredAuctions.size;
  
  if (count > 0) {
    chrome.action.setBadgeText({ text: count.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Test backend connection
async function testBackendConnection(url, token) {
  try {
    const response = await fetch(`${url}${CONFIG.API.STATUS}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token || CONFIG.BACKEND.DEFAULT_TOKEN
      }
    });
    
    if (response.ok) {
      return { success: true };
    } else {
      return { success: false, error: `Server returned ${response.status}` };
    }
  } catch (error) {
    return { success: false, error: error.message || 'Connection failed' };
  }
}

// Handle settings update
async function handleSettingsUpdate(settings) {
  // Update backend URL if changed
  if (settings.backendUrl) {
    await chrome.storage.local.set({ backendUrl: settings.backendUrl });
    
    // Reconnect with new URL
    await backendClient.disconnect();
    backendClient = new BackendClient();
    await initializeBackend();
  }
  
  // Update other settings
  if (settings.autoRefresh !== undefined || settings.refreshInterval !== undefined) {
    await chrome.storage.local.set({
      autoRefresh: settings.autoRefresh,
      refreshInterval: settings.refreshInterval
    });
  }
  
  if (settings.notificationsEnabled !== undefined) {
    await chrome.storage.local.set({
      notificationsEnabled: settings.notificationsEnabled
    });
  }
}

// Clean up when service worker suspends
chrome.runtime.onSuspend.addListener(() => {
  console.log('Service worker suspending...');
  if (backendClient.isConnected) {
    backendClient.disconnect();
  }
});