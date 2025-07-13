// Configuration management for the dashboard
const Config = {
    config: null,
    
    // Load configuration from the server
    async load() {
        try {
            const response = await fetch('/api/config');
            if (response.ok) {
                this.config = await response.json();
                Logger.info('Configuration loaded from server:', this.config);
                return this.config;
            } else {
                Logger.warn('Failed to load configuration from server, using defaults');
                this.useDefaults();
                return this.config;
            }
        } catch (error) {
            Logger.error('Error loading configuration:', error);
            this.useDefaults();
            return this.config;
        }
    },
    
    // Use default configuration values
    useDefaults() {
        this.config = {
            backendUrl: localStorage.getItem('dashboard_backend_url') || 'http://localhost:3000',
            wsUrl: localStorage.getItem('dashboard_ws_url') || 'ws://localhost:3000'
        };
        Logger.info('Using default configuration:', this.config);
    },
    
    // Get backend URL
    getBackendUrl() {
        if (!this.config) {
            Logger.warn('Configuration not loaded, using localStorage fallback');
            return localStorage.getItem('dashboard_backend_url') || 'http://localhost:3000';
        }
        return this.config.backendUrl;
    },
    
    // Get WebSocket URL
    getWebSocketUrl() {
        if (!this.config) {
            Logger.warn('Configuration not loaded, using localStorage fallback');
            return localStorage.getItem('dashboard_ws_url') || 'ws://localhost:3000';
        }
        // Ensure WebSocket URL includes the /ws path
        const baseWsUrl = this.config.wsUrl;
        return baseWsUrl.endsWith('/ws') ? baseWsUrl : `${baseWsUrl}/ws`;
    },
    
    // Initialize configuration on page load
    async init() {
        await this.load();
        
        // Update settings form with server config if available
        const backendUrlInput = document.getElementById('backend-url');
        if (backendUrlInput && this.config) {
            backendUrlInput.value = this.config.backendUrl;
        }
    }
};

// Load configuration when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Config.init());
} else {
    Config.init();
}

// Export for global access
window.Config = Config;