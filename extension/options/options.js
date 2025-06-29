// Default settings
const DEFAULT_SETTINGS = {
  backendUrl: 'http://localhost:3000',
  autoRefresh: true,
  refreshInterval: 5,
  notificationsEnabled: true,
  theme: 'system'
};

// Elements
const elements = {
  backendUrl: document.getElementById('backend-url'),
  testConnection: document.getElementById('test-connection'),
  connectionStatus: document.getElementById('connection-status'),
  autoRefresh: document.getElementById('auto-refresh'),
  refreshInterval: document.getElementById('refresh-interval'),
  notificationsEnabled: document.getElementById('notifications-enabled'),
  themeSystem: document.getElementById('theme-system'),
  themeLight: document.getElementById('theme-light'),
  themeDark: document.getElementById('theme-dark'),
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

// Load settings from storage
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
    const settings = { ...DEFAULT_SETTINGS, ...result };
    
    // Apply settings to form
    elements.backendUrl.value = settings.backendUrl;
    elements.autoRefresh.checked = settings.autoRefresh;
    elements.refreshInterval.value = settings.refreshInterval;
    elements.refreshInterval.disabled = !settings.autoRefresh;
    elements.notificationsEnabled.checked = settings.notificationsEnabled;
    
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
      autoRefresh: elements.autoRefresh.checked,
      refreshInterval: parseInt(elements.refreshInterval.value) || DEFAULT_SETTINGS.refreshInterval,
      notificationsEnabled: elements.notificationsEnabled.checked,
      theme: document.querySelector('input[name="theme"]:checked').value
    };
    
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
      url: url
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