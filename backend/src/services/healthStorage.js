const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

/**
 * Independent storage for health monitoring data
 * Uses in-memory storage with file backup to survive Redis failures
 */
class HealthStorage {
    constructor() {
        this.memoryStore = new Map();
        this.filePath = path.join(process.cwd(), 'health-data.json');
        this.syncInterval = null;
        this.pendingSync = false;
        this.maxHistorySize = 100; // Keep last 100 health checks
        this.syncDelayMs = 5000; // Write to disk every 5 seconds max
        
        // Initialize
        this.loadFromFile();
        
        // Set up periodic cleanup
        this.startCleanupInterval();
    }
    
    /**
     * Set a health data entry
     */
    async set(key, value) {
        try {
            // Always write to memory first
            this.memoryStore.set(key, {
                value,
                timestamp: Date.now()
            });
            
            // Schedule file sync
            this.scheduleFileSync();
            
            return true;
        } catch (error) {
            logger.error('HealthStorage.set error:', error);
            return false;
        }
    }
    
    /**
     * Get a health data entry
     */
    async get(key) {
        try {
            // Try memory first
            const memoryData = this.memoryStore.get(key);
            if (memoryData) {
                return memoryData.value;
            }
            
            // Try loading from file if not in memory
            await this.loadFromFile();
            const reloadedData = this.memoryStore.get(key);
            return reloadedData ? reloadedData.value : null;
        } catch (error) {
            logger.error('HealthStorage.get error:', error);
            return null;
        }
    }
    
    /**
     * Get all health data
     */
    async getAll() {
        try {
            const result = {};
            for (const [key, data] of this.memoryStore.entries()) {
                result[key] = data.value;
            }
            return result;
        } catch (error) {
            logger.error('HealthStorage.getAll error:', error);
            return {};
        }
    }
    
    /**
     * Add a health check result to history
     */
    async addHealthCheck(checkResult) {
        try {
            // Get current history
            const history = (await this.get('health_history')) || [];
            
            // Add new check result
            history.unshift({
                timestamp: Date.now(),
                ...checkResult
            });
            
            // Trim to max size
            if (history.length > this.maxHistorySize) {
                history.length = this.maxHistorySize;
            }
            
            // Save back
            await this.set('health_history', history);
            
            // Also save current status
            await this.set('current_health', checkResult);
            
            return true;
        } catch (error) {
            logger.error('HealthStorage.addHealthCheck error:', error);
            return false;
        }
    }
    
    /**
     * Get health history
     */
    async getHealthHistory(limit = 10) {
        try {
            const history = (await this.get('health_history')) || [];
            return history.slice(0, limit);
        } catch (error) {
            logger.error('HealthStorage.getHealthHistory error:', error);
            return [];
        }
    }
    
    /**
     * Get current health status
     */
    async getCurrentHealth() {
        try {
            return (await this.get('current_health')) || null;
        } catch (error) {
            logger.error('HealthStorage.getCurrentHealth error:', error);
            return null;
        }
    }
    
    /**
     * Schedule file sync with debouncing
     */
    scheduleFileSync() {
        this.pendingSync = true;
        
        if (this.syncInterval) {
            return; // Already scheduled
        }
        
        this.syncInterval = setTimeout(() => {
            this.syncInterval = null;
            if (this.pendingSync) {
                this.pendingSync = false;
                this.syncToFile();
            }
        }, this.syncDelayMs);
    }
    
    /**
     * Sync memory store to file
     */
    async syncToFile() {
        try {
            const data = {};
            for (const [key, value] of this.memoryStore.entries()) {
                data[key] = value;
            }
            
            // Write to temp file first
            const tempPath = `${this.filePath}.tmp`;
            await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
            
            // Atomic rename
            await fs.rename(tempPath, this.filePath);
            
            logger.debug('Health data synced to file');
        } catch (error) {
            // Don't log at error level to avoid spam
            logger.debug('HealthStorage.syncToFile error:', error);
        }
    }
    
    /**
     * Load data from file
     */
    async loadFromFile() {
        try {
            const fileContent = await fs.readFile(this.filePath, 'utf8');
            const data = JSON.parse(fileContent);
            
            // Load into memory store
            this.memoryStore.clear();
            for (const [key, value] of Object.entries(data)) {
                this.memoryStore.set(key, value);
            }
            
            logger.debug('Health data loaded from file');
            return true;
        } catch (error) {
            if (error.code !== 'ENOENT') {
                logger.debug('HealthStorage.loadFromFile error:', error);
            }
            return false;
        }
    }
    
    /**
     * Clean up old data periodically
     */
    startCleanupInterval() {
        // Clean up every hour
        setInterval(() => {
            try {
                const now = Date.now();
                const maxAge = 24 * 60 * 60 * 1000; // 24 hours
                
                // Remove old entries
                for (const [key, data] of this.memoryStore.entries()) {
                    if (key !== 'health_history' && key !== 'current_health') {
                        if (now - data.timestamp > maxAge) {
                            this.memoryStore.delete(key);
                        }
                    }
                }
                
                // Schedule sync if we removed anything
                if (this.memoryStore.size > 0) {
                    this.scheduleFileSync();
                }
            } catch (error) {
                logger.error('HealthStorage cleanup error:', error);
            }
        }, 60 * 60 * 1000); // Every hour
    }
    
    /**
     * Clear all health data (for testing)
     */
    async clear() {
        this.memoryStore.clear();
        this.pendingSync = false;
        if (this.syncInterval) {
            clearTimeout(this.syncInterval);
            this.syncInterval = null;
        }
        
        try {
            await fs.unlink(this.filePath);
        } catch (error) {
            // Ignore if file doesn't exist
        }
    }
    
    /**
     * Graceful shutdown
     */
    async shutdown() {
        // Final sync
        if (this.pendingSync) {
            await this.syncToFile();
        }
        
        // Clear intervals
        if (this.syncInterval) {
            clearTimeout(this.syncInterval);
            this.syncInterval = null;
        }
    }
}

// Create singleton instance
const healthStorage = new HealthStorage();

// Handle graceful shutdown
process.on('SIGINT', async () => {
    await healthStorage.shutdown();
});

process.on('SIGTERM', async () => {
    await healthStorage.shutdown();
});

module.exports = healthStorage;