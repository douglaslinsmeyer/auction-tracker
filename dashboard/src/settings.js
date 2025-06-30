class SettingsManager {
    constructor() {
        this.settings = {
            general: {
                defaultMaxBid: 100,
                defaultStrategy: 'increment',
                autoBidDefault: true
            },
            bidding: {
                snipeTiming: 5,
                bidBuffer: 0,
                retryAttempts: 3
            }
        };
        
        this.init();
    }
    
    init() {
        this.loadSettings();
        this.attachEventListeners();
    }
    
    async loadSettings() {
        try {
            // Get backend URL from config
            const configResponse = await fetch('/api/config');
            const config = await configResponse.json();
            const backendUrl = config.backendUrl || 'http://localhost:3000';
            
            // Get auth token from localStorage
            const authToken = localStorage.getItem('authToken') || 'dev-token';
            
            const response = await fetch(`${backendUrl}/api/settings`, {
                headers: {
                    'Authorization': authToken
                }
            });
            if (response.ok) {
                const data = await response.json();
                this.settings = data.settings || this.settings;
                this.updateUI();
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
            // Use default settings
            this.updateUI();
        }
    }
    
    async saveSettings() {
        try {
            // Gather values from form
            this.settings.general.defaultMaxBid = parseInt(document.getElementById('default-max-bid').value) || 100;
            this.settings.general.defaultStrategy = document.getElementById('default-strategy').value;
            this.settings.general.autoBidDefault = document.getElementById('auto-bid-default').checked;
            
            this.settings.bidding.snipeTiming = parseInt(document.getElementById('snipe-timing').value) || 5;
            this.settings.bidding.bidBuffer = parseInt(document.getElementById('bid-buffer').value) || 0;
            this.settings.bidding.retryAttempts = parseInt(document.getElementById('retry-attempts').value) || 3;
            
            // Get backend URL from config
            const configResponse = await fetch('/api/config');
            const config = await configResponse.json();
            const backendUrl = config.backendUrl || 'http://localhost:3000';
            
            // Get auth token from localStorage
            const authToken = localStorage.getItem('authToken') || 'dev-token';
            
            // Save to server
            const response = await fetch(`${backendUrl}/api/settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authToken
                },
                body: JSON.stringify({ settings: this.settings })
            });
            
            if (response.ok) {
                console.log('Settings saved successfully');
            } else {
                throw new Error('Failed to save settings');
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
            console.error('Failed to save settings');
        }
    }
    
    updateUI() {
        // Update form fields with current settings
        document.getElementById('default-max-bid').value = this.settings.general.defaultMaxBid;
        document.getElementById('default-strategy').value = this.settings.general.defaultStrategy;
        document.getElementById('auto-bid-default').checked = this.settings.general.autoBidDefault;
        
        document.getElementById('snipe-timing').value = this.settings.bidding.snipeTiming;
        document.getElementById('bid-buffer').value = this.settings.bidding.bidBuffer;
        document.getElementById('retry-attempts').value = this.settings.bidding.retryAttempts;
    }
    
    attachEventListeners() {
        const saveButton = document.getElementById('save-settings');
        if (saveButton) {
            saveButton.addEventListener('click', () => this.saveSettings());
        }
        
        // Add input validation
        document.getElementById('default-max-bid')?.addEventListener('input', (e) => {
            if (e.target.value < 1) e.target.value = 1;
        });
        
        document.getElementById('snipe-timing')?.addEventListener('input', (e) => {
            if (e.target.value < 1) e.target.value = 1;
            if (e.target.value > 30) e.target.value = 30;
        });
        
        document.getElementById('bid-buffer')?.addEventListener('input', (e) => {
            if (e.target.value < 0) e.target.value = 0;
        });
        
        document.getElementById('retry-attempts')?.addEventListener('input', (e) => {
            if (e.target.value < 1) e.target.value = 1;
            if (e.target.value > 10) e.target.value = 10;
        });
    }
    
    // Notification method removed - using console logging instead
    
    getSettings() {
        return this.settings;
    }
}

// Initialize settings manager
const settingsManager = new SettingsManager();