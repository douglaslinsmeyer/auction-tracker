document.addEventListener('DOMContentLoaded', initialize);

const elements = {
  statsSection: document.getElementById('stats-section'),
  auctionList: document.getElementById('auction-list'),
  auctionCount: document.getElementById('auction-count'),
  statusDot: document.getElementById('status-dot'),
  themeToggle: document.getElementById('theme-toggle'),
  backendLink: document.getElementById('backend-link'),
  settingsBtn: document.getElementById('settings-btn')
};

let backendConnected = false;

function initialize() {
  loadConfiguration();
  loadTheme();
  attachEventListeners();
  checkBackendStatus();
  
  // Check backend status immediately and periodically
  setInterval(checkBackendStatus, 3000);
}

function loadConfiguration() {
  // Configuration is loaded but no need to display URL in subtle UI
}

function loadTheme() {
  chrome.storage.local.get(['theme'], (result) => {
    const theme = result.theme || 'light';
    document.documentElement.setAttribute('data-theme', theme);
  });
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  chrome.storage.local.set({ theme: newTheme });
}

function attachEventListeners() {
  elements.themeToggle.addEventListener('click', toggleTheme);
  
  // Settings button click handler
  elements.settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  // Backend link click handler
  elements.backendLink.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      // Get the backend URL from storage
      const result = await chrome.storage.local.get(['backendUrl']);
      const backendUrl = result.backendUrl || CONFIG.BACKEND.DEFAULT_URL;
      
      // Open the backend URL in a new tab
      chrome.tabs.create({ url: backendUrl });
    } catch (error) {
      console.error('Error opening backend URL:', error);
    }
  });
  
  // Listen for backend status updates
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'backendConnected') {
      updateBackendStatus(true);
      updateMonitoredAuctions();
    } else if (message.type === 'backendDisconnected') {
      updateBackendStatus(false);
    } else if (message.type === 'auctionState') {
      // Real-time auction state update from backend
      console.log('Popup received auction state update:', message.auction?.id);
      updateMonitoredAuctions();
    } else if (message.type === 'auctionUpdate') {
      // Legacy support
      updateMonitoredAuctions();
    }
  });
}

async function checkBackendStatus() {
  try {
    console.log('Popup checking backend status...');
    const response = await chrome.runtime.sendMessage({ action: 'getBackendStatus' });
    console.log('Popup received backend status:', response);
    const connected = response?.connected || false;
    updateBackendStatus(connected);
    if (connected) updateMonitoredAuctions();
  } catch (error) {
    console.error('Popup error checking backend status:', error);
    updateBackendStatus(false);
  }
}

function updateBackendStatus(connected) {
  backendConnected = connected;
  
  if (connected) {
    elements.statusDot.className = 'status-dot connected';
    elements.statsSection.style.display = 'block';
    
  } else {
    elements.statusDot.className = 'status-dot error';
    elements.statsSection.style.display = 'none';
    
  }
}

// Helper to create or update empty state
function showEmptyState(message) {
  let emptyState = elements.auctionList.querySelector('.empty-state');
  
  if (!emptyState) {
    emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = `
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" opacity="0.3">
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
        <path d="M3 9h18M9 3v18" stroke="currentColor" stroke-width="2"/>
      </svg>
      <p></p>
    `;
    elements.auctionList.appendChild(emptyState);
  }
  
  const messageElement = emptyState.querySelector('p');
  if (messageElement.textContent !== message) {
    messageElement.textContent = message;
  }
}

function updateMonitoredAuctions() {
  if (!backendConnected) {
    showEmptyState('Backend not connected');
    elements.auctionCount.textContent = '0';
    // Hide all auction items
    document.querySelectorAll('.auction-item').forEach(item => {
      item.style.display = 'none';
    });
    return;
  }
  
  chrome.runtime.sendMessage({
    action: 'getMonitoredAuctions'
  }, (response) => {
    if (!response || !response.auctions || response.auctions.length === 0) {
      showEmptyState('No auctions being monitored');
      elements.auctionCount.textContent = '0';
      // Hide all auction items
      document.querySelectorAll('.auction-item').forEach(item => {
        item.style.display = 'none';
      });
      return;
    }
    
    elements.auctionCount.textContent = response.auctions.length;
    
    // Hide empty state
    const emptyState = elements.auctionList.querySelector('.empty-state');
    if (emptyState) {
      emptyState.style.display = 'none';
    }
    
    // Sort auctions by time remaining (ending soonest first)
    const sortedAuctions = response.auctions.sort((a, b) => {
      const timeA = a.data?.timeRemaining || 0;
      const timeB = b.data?.timeRemaining || 0;
      // If one is closed and the other isn't, put the open one first
      if (a.data?.isClosed && !b.data?.isClosed) return 1;
      if (!a.data?.isClosed && b.data?.isClosed) return -1;
      // Otherwise sort by time remaining
      return timeA - timeB;
    });
    
    // Track which auction IDs we've seen
    const seenAuctionIds = new Set();
    
    // Update existing items or create new ones
    sortedAuctions.forEach((auction, index) => {
      const data = auction.data || {};
      const timeLeft = data.timeRemaining || 0;
      const auctionId = auction.id;
      
      seenAuctionIds.add(auctionId);
      
      // Try to find existing item
      let auctionItem = elements.auctionList.querySelector(`[data-auction-id="${auctionId}"]`);
      
      if (!auctionItem) {
        // Create new item if it doesn't exist
        auctionItem = document.createElement('div');
        auctionItem.className = 'auction-item';
        auctionItem.setAttribute('data-auction-id', auctionId);
        auctionItem.setAttribute('data-url', auction.url || '#');
        auctionItem.innerHTML = `
          <div class="auction-content">
            ${auction.imageUrl ? `<img class="auction-image" src="${auction.imageUrl}" alt="${auction.title || 'Auction item'}" />` : ''}
            <div class="auction-info">
              <div class="auction-header">
                <div class="auction-title" title="${auction.title || 'Unknown'}">${auction.title || 'Unknown'}</div>
                <div class="auction-time"></div>
              </div>
              <div class="auction-details">
                <span class="auction-bid"></span>
              </div>
            </div>
          </div>
        `;
        
        // Add click handler
        auctionItem.addEventListener('click', () => {
          const url = auctionItem.getAttribute('data-url');
          if (url && url !== '#') chrome.tabs.create({ url });
        });
        
        elements.auctionList.appendChild(auctionItem);
      }
      
      // Make sure it's visible
      auctionItem.style.display = 'block';
      // Set order based on sorted position
      auctionItem.style.order = index;
      
      // Update data for existing or new item
      const timeElement = auctionItem.querySelector('.auction-time');
      const bidElement = auctionItem.querySelector('.auction-bid');
      
      // Update classes
      auctionItem.className = `auction-item ${data.isClosed ? 'ended' : ''}`;
      
      // Update time
      timeElement.textContent = data.isClosed ? 'Ended' : formatTime(timeLeft);
      timeElement.className = `auction-time ${timeLeft > 0 && timeLeft <= 300 ? 'urgent' : ''}`;
      
      // Update bid
      bidElement.textContent = `$${(data.currentBid || 0).toFixed(2)}`;
    });
    
    // Hide items that are no longer monitored
    document.querySelectorAll('.auction-item').forEach(item => {
      const itemId = item.getAttribute('data-auction-id');
      if (itemId && !seenAuctionIds.has(itemId)) {
        item.style.display = 'none';
      }
    });
  });
}


function formatTime(seconds) {
  if (seconds <= 0) return 'Ended';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

