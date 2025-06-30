// Default settings
const DEFAULT_SETTINGS = {
  backendUrl: CONFIG.BACKEND.DEFAULT_URL,
  authToken: CONFIG.BACKEND.DEFAULT_TOKEN,
  autoRefresh: CONFIG.EXTENSION.AUTO_REFRESH,
  refreshInterval: CONFIG.EXTENSION.REFRESH_INTERVAL,
  notificationsEnabled: true,
  notifyOutbid: true,
  notifyWon: true,
  notifyEnding: true,
  theme: 'system',
  defaultMaxBid: 0,
  bidIncrement: 1,
  defaultStrategy: 'sniping'
};

// Elements
const elements = {
  backendUrl: document.getElementById('backend-url'),
  authToken: document.getElementById('auth-token'),
  testConnection: document.getElementById('test-connection'),
  connectionStatus: document.getElementById('connection-status'),
  autoRefresh: document.getElementById('auto-refresh'),
  refreshInterval: document.getElementById('refresh-interval'),
  notificationsEnabled: document.getElementById('notifications-enabled'),
  notifyOutbid: document.getElementById('notify-outbid'),
  notifyWon: document.getElementById('notify-won'),
  notifyEnding: document.getElementById('notify-ending'),
  themeSystem: document.getElementById('theme-system'),
  themeLight: document.getElementById('theme-light'),
  themeDark: document.getElementById('theme-dark'),
  defaultMaxBid: document.getElementById('default-max-bid'),
  bidIncrement: document.getElementById('bid-increment'),
  defaultStrategy: document.getElementById('default-strategy'),
  saveSettings: document.getElementById('save-settings'),
  resetSettings: document.getElementById('reset-settings'),
  saveStatus: document.getElementById('save-status')
};

// Load settings on page load
document.addEventListener('DOMContentLoaded', loadSettings);

// Attach event listeners
elements.saveSettings.addEventListener('click', saveSettings);
elements.resetSettings.addEventListener('click', resetSettings);
elements.testConnection.addEventListener('click', testConnection);

// Theme radio buttons
document.querySelectorAll('input[name="theme"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    applyTheme(e.target.value);
  });
});

// Auto-refresh toggle
elements.autoRefresh.addEventListener('change', (e) => {
  elements.refreshInterval.disabled = !e.target.checked;
});

// Master notifications toggle
elements.notificationsEnabled.addEventListener('change', (e) => {
  const enabled = e.target.checked;
  elements.notifyOutbid.disabled = !enabled;
  elements.notifyWon.disabled = !enabled;
  elements.notifyEnding.disabled = !enabled;
  if (!enabled) {
    elements.notifyOutbid.checked = false;
    elements.notifyWon.checked = false;
    elements.notifyEnding.checked = false;
  }
});

// Load settings from storage
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
    const settings = { ...DEFAULT_SETTINGS, ...result };
    
    // Apply settings to form
    elements.backendUrl.value = settings.backendUrl;
    elements.authToken.value = settings.authToken || '';
    elements.autoRefresh.checked = settings.autoRefresh;
    elements.refreshInterval.value = settings.refreshInterval;
    elements.refreshInterval.disabled = !settings.autoRefresh;
    elements.notificationsEnabled.checked = settings.notificationsEnabled;
    elements.notifyOutbid.checked = settings.notifyOutbid;
    elements.notifyWon.checked = settings.notifyWon;
    elements.notifyEnding.checked = settings.notifyEnding;
    elements.notifyOutbid.disabled = !settings.notificationsEnabled;
    elements.notifyWon.disabled = !settings.notificationsEnabled;
    elements.notifyEnding.disabled = !settings.notificationsEnabled;
    elements.defaultMaxBid.value = settings.defaultMaxBid;
    elements.bidIncrement.value = settings.bidIncrement;
    elements.defaultStrategy.value = settings.defaultStrategy;
    
    // Set theme radio
    const themeRadio = document.querySelector(`input[name="theme"][value="${settings.theme}"]`);
    if (themeRadio) {
      themeRadio.checked = true;
    }
    
    // Apply theme
    applyTheme(settings.theme);
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Save settings to storage
async function saveSettings() {
  try {
    const settings = {
      backendUrl: elements.backendUrl.value || DEFAULT_SETTINGS.backendUrl,
      authToken: elements.authToken.value || DEFAULT_SETTINGS.authToken,
      autoRefresh: elements.autoRefresh.checked,
      refreshInterval: parseInt(elements.refreshInterval.value) || DEFAULT_SETTINGS.refreshInterval,
      notificationsEnabled: elements.notificationsEnabled.checked,
      notifyOutbid: elements.notifyOutbid.checked,
      notifyWon: elements.notifyWon.checked,
      notifyEnding: elements.notifyEnding.checked,
      theme: document.querySelector('input[name="theme"]:checked').value,
      defaultMaxBid: parseFloat(elements.defaultMaxBid.value) || 0,
      bidIncrement: parseFloat(elements.bidIncrement.value) || 1,
      defaultStrategy: elements.defaultStrategy.value
    };
    
    // Also update the backend settings object for compatibility
    await chrome.storage.local.set({
      backend: {
        url: settings.backendUrl,
        token: settings.authToken
      },
      bidSettings: {
        defaultMaxBid: settings.defaultMaxBid,
        incrementAmount: settings.bidIncrement,
        strategy: settings.defaultStrategy
      }
    });
    
    // Validate backend URL
    try {
      new URL(settings.backendUrl);
    } catch {
      showConnectionStatus('error', 'Invalid URL format');
      return;
    }
    
    // Save to storage
    await chrome.storage.local.set(settings);
    
    // Notify background script of changes
    chrome.runtime.sendMessage({
      action: 'settingsUpdated',
      settings: settings
    });
    
    // Show success message
    showSaveStatus();
  } catch (error) {
    console.error('Error saving settings:', error);
    showConnectionStatus('error', 'Failed to save settings');
  }
}

// Reset settings to defaults
async function resetSettings() {
  if (confirm('Are you sure you want to reset all settings to defaults?')) {
    try {
      await chrome.storage.local.clear();
      await chrome.storage.local.set(DEFAULT_SETTINGS);
      loadSettings();
      showSaveStatus('Settings reset to defaults');
    } catch (error) {
      console.error('Error resetting settings:', error);
    }
  }
}

// Test backend connection
async function testConnection() {
  const url = elements.backendUrl.value || DEFAULT_SETTINGS.backendUrl;
  const token = elements.authToken.value || DEFAULT_SETTINGS.authToken;
  
  // Validate URL
  try {
    new URL(url);
  } catch {
    showConnectionStatus('error', 'Invalid URL format');
    return;
  }
  
  // Show testing status
  elements.testConnection.disabled = true;
  elements.testConnection.textContent = 'Testing...';
  showConnectionStatus('testing', 'Testing connection...');
  
  try {
    // Test connection by sending a message to background script
    const response = await chrome.runtime.sendMessage({
      action: 'testBackendConnection',
      url: url,
      token: token
    });
    
    if (response && response.success) {
      showConnectionStatus('success', 'Connection successful!');
    } else {
      showConnectionStatus('error', response?.error || 'Connection failed');
    }
  } catch (error) {
    showConnectionStatus('error', 'Connection test failed');
    console.error('Connection test error:', error);
  } finally {
    elements.testConnection.disabled = false;
    elements.testConnection.textContent = 'Test Connection';
  }
}

// Show connection status
function showConnectionStatus(type, message) {
  const statusEl = elements.connectionStatus;
  const statusIcon = statusEl.querySelector('.status-icon');
  const statusText = statusEl.querySelector('.status-text');
  
  // Remove all status classes
  statusEl.classList.remove('hidden', 'success', 'error', 'testing');
  
  // Add appropriate class
  if (type === 'success') {
    statusEl.classList.add('success');
  } else if (type === 'error') {
    statusEl.classList.add('error');
  }
  
  statusText.textContent = message;
  
  // Auto-hide success messages after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      statusEl.classList.add('hidden');
    }, 3000);
  }
}

// Show save status
function showSaveStatus(message = 'Settings saved successfully!') {
  const statusEl = elements.saveStatus;
  statusEl.textContent = message;
  statusEl.classList.remove('hidden');
  
  setTimeout(() => {
    statusEl.classList.add('hidden');
  }, 3000);
}

// Apply theme
function applyTheme(theme) {
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  const currentTheme = document.querySelector('input[name="theme"]:checked').value;
  if (currentTheme === 'system') {
    document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
  }
});