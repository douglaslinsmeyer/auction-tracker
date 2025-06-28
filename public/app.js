class AuctionMonitorUI {
    constructor() {
        this.ws = null;
        this.auctions = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.pingInterval = null;
        
        this.elements = {
            connectionStatus: document.getElementById('connection-status'),
            statusDot: document.querySelector('.status-dot'),
            statusText: document.querySelector('.status-text'),
            auctionCount: document.getElementById('auction-count'),
            auctionsGrid: document.getElementById('auctions-grid'),
            emptyState: document.getElementById('empty-state'),
            refreshBtn: document.getElementById('refresh-btn'),
            clearAllBtn: document.getElementById('clear-all-btn')
        };
        
        this.init();
    }
    
    init() {
        this.connectWebSocket();
        this.attachEventListeners();
        this.loadAuctions();
    }
    
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.reconnectAttempts = 0;
            this.updateConnectionStatus('connected');
            
            // Start ping interval to keep connection alive
            this.startPingInterval();
            
            // Authenticate first
            this.sendMessage({
                type: 'authenticate',
                token: 'dev-token',
                requestId: this.generateRequestId()
            });
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            } catch (error) {
                console.error('Failed to parse WebSocket message:', error);
            }
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.updateConnectionStatus('disconnected');
            this.stopPingInterval();
            this.attemptReconnect();
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus('disconnected');
        };
    }
    
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                this.connectWebSocket();
            }, this.reconnectDelay * this.reconnectAttempts);
        }
    }
    
    updateConnectionStatus(status) {
        this.elements.statusDot.className = `status-dot ${status}`;
        this.elements.statusText.textContent = status === 'connected' ? 'Connected' : 'Disconnected';
    }
    
    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'response':
                if (data.data && data.data.auctions) {
                    this.updateAuctions(data.data.auctions);
                }
                break;
                
            case 'auctionState':
                // Replace entire auction state (single source of truth)
                if (data.auction) {
                    this.handleAuctionState(data.auction);
                }
                break;
                
            case 'notification':
                this.showNotification(data);
                break;
                
            case 'pong':
                // Connection is alive
                console.log('Received pong');
                break;
                
            case 'authenticated':
                console.log('Authentication successful');
                // Now request the monitored auctions
                this.sendMessage({
                    type: 'getMonitoredAuctions',
                    requestId: this.generateRequestId()
                });
                break;
        }
    }
    
    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }
    
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    startPingInterval() {
        // Send ping every 30 seconds to keep connection alive
        this.pingInterval = setInterval(() => {
            this.sendMessage({ type: 'ping' });
        }, 30000);
    }
    
    stopPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
    
    attachEventListeners() {
        this.elements.refreshBtn.addEventListener('click', () => this.loadAuctions());
        
        this.elements.clearAllBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to stop monitoring all auctions?')) {
                this.clearAllAuctions();
            }
        });
        
        // Update every second for time remaining
        setInterval(() => this.updateTimeRemaining(), 1000);
        
        // Delegate event listeners for config changes
        document.addEventListener('change', (e) => {
            if (e.target.matches('.config-select, .config-input')) {
                const auctionId = e.target.dataset.auctionId;
                const configType = e.target.dataset.config;
                const value = configType === 'maxBid' ? parseInt(e.target.value) || 0 : e.target.value;
                
                this.updateAuctionConfig(auctionId, configType, value);
            }
        });
        
        // Ensure max bid is always whole dollars
        document.addEventListener('input', (e) => {
            if (e.target.matches('.config-input[data-config="maxBid"]')) {
                // Remove any decimal points or non-numeric characters
                let value = e.target.value.replace(/[^\d]/g, '');
                e.target.value = value;
            }
        });
    }
    
    async loadAuctions() {
        this.elements.refreshBtn.disabled = true;
        
        try {
            const response = await fetch('/api/auctions');
            const data = await response.json();
            
            if (data.auctions) {
                this.updateAuctions(data.auctions);
            }
        } catch (error) {
            console.error('Failed to load auctions:', error);
        } finally {
            this.elements.refreshBtn.disabled = false;
        }
    }
    
    updateAuctions(auctions) {
        this.auctions.clear();
        
        auctions.forEach(auction => {
            this.auctions.set(auction.id, auction);
        });
        
        this.render();
    }
    
    handleAuctionState(auction) {
        console.log('Received auction state:', auction.id);
        
        const existingAuction = this.auctions.get(auction.id);
        
        // Store the auction state
        this.auctions.set(auction.id, auction);
        
        // Update count
        this.elements.auctionCount.textContent = this.auctions.size;
        
        if (!existingAuction) {
            // New auction - need full render
            this.render();
        } else {
            // Existing auction - patch the card
            this.patchAuctionCard(auction);
        }
    }
    
    async clearAllAuctions() {
        try {
            const response = await fetch('/api/auctions/clear', {
                method: 'POST'
            });
            
            if (response.ok) {
                this.auctions.clear();
                this.render();
            }
        } catch (error) {
            console.error('Failed to clear auctions:', error);
        }
    }
    
    async stopMonitoring(auctionId) {
        try {
            const response = await fetch(`/api/auctions/${auctionId}/stop`, {
                method: 'POST'
            });
            
            if (response.ok) {
                this.auctions.delete(auctionId);
                this.render();
            }
        } catch (error) {
            console.error('Failed to stop monitoring:', error);
        }
    }
    
    updateAuctionConfig(auctionId, configType, value) {
        const auction = this.auctions.get(auctionId);
        if (!auction) return;
        
        // Build config update object
        const configUpdate = {};
        configUpdate[configType] = value;
        
        // Send update via WebSocket (backend will broadcast full state back)
        this.sendMessage({
            type: 'updateConfig',
            auctionId: auctionId,
            config: configUpdate,
            requestId: this.generateRequestId()
        });
        
        console.log(`Sending ${configType} update for auction ${auctionId} to ${value}`);
    }
    
    render() {
        const auctionCount = this.auctions.size;
        this.elements.auctionCount.textContent = auctionCount;
        this.elements.clearAllBtn.disabled = auctionCount === 0;
        
        if (auctionCount === 0) {
            this.elements.auctionsGrid.style.display = 'none';
            this.elements.emptyState.style.display = 'block';
        } else {
            this.elements.auctionsGrid.style.display = 'grid';
            this.elements.emptyState.style.display = 'none';
            
            this.elements.auctionsGrid.innerHTML = '';
            this.auctions.forEach((auction, id) => {
                this.elements.auctionsGrid.appendChild(this.createAuctionCard(auction));
            });
        }
    }
    
    renderAuctionCard(auctionId) {
        const auction = this.auctions.get(auctionId);
        if (!auction) return;
        
        const existingCard = document.querySelector(`[data-auction-id="${auctionId}"]`);
        if (existingCard) {
            const newCard = this.createAuctionCard(auction);
            existingCard.replaceWith(newCard);
        }
    }
    
    patchAuctionCard(auction) {
        const card = document.querySelector(`[data-auction-id="${auction.id}"]`);
        if (!card) {
            // Card doesn't exist, create it
            this.render();
            return;
        }
        
        // Update only the elements that might have changed
        const data = auction.data || {};
        
        // Update status badge
        const statusBadge = card.querySelector('.auction-status');
        if (statusBadge) {
            statusBadge.className = `auction-status status-${auction.status}`;
            statusBadge.textContent = auction.status;
        }
        
        // Update current bid
        const currentBidElement = card.querySelector('.info-value.price');
        if (currentBidElement && data.currentBid !== undefined) {
            currentBidElement.textContent = `$${data.currentBid}`;
        }
        
        // Update time remaining
        const timeElement = card.querySelector('.info-item:nth-child(2) .info-value');
        if (timeElement && data.timeRemaining !== undefined) {
            timeElement.textContent = this.formatTimeRemaining(data.timeRemaining);
            timeElement.className = data.timeRemaining <= 30 && data.timeRemaining > 0 ? 'info-value time' : 'info-value';
        }
        
        // Update bid count
        const bidCountElement = card.querySelector('.info-item:nth-child(3) .info-value');
        if (bidCountElement && data.bidCount !== undefined) {
            bidCountElement.textContent = data.bidCount;
        }
        
        // Update winning status
        const statusElement = card.querySelector('.info-item:nth-child(4) .info-value');
        if (statusElement && data.isWinning !== undefined) {
            statusElement.textContent = data.isWinning ? 'Winning' : 'Watching';
        }
        
        // Update config values if they changed
        if (auction.config) {
            // Update strategy select
            const strategySelect = card.querySelector('.config-select[data-config="strategy"]');
            if (strategySelect && strategySelect.value !== auction.config.strategy) {
                strategySelect.value = auction.config.strategy;
            }
            
            // Update max bid input
            const maxBidInput = card.querySelector('.config-input[data-config="maxBid"]');
            if (maxBidInput && parseInt(maxBidInput.value) !== auction.config.maxBid) {
                maxBidInput.value = auction.config.maxBid;
            }
            
            // Update increment display
            const incrementElement = card.querySelector('.config-row:last-child .config-value');
            if (incrementElement && auction.config.bidIncrement !== undefined) {
                incrementElement.textContent = `$${auction.config.bidIncrement}`;
            }
        }
    }
    
    createAuctionCard(auction) {
        const card = document.createElement('div');
        card.className = 'auction-card';
        card.setAttribute('data-auction-id', auction.id);
        
        const timeRemaining = this.formatTimeRemaining(auction.data?.timeRemaining || 0);
        const currentBid = auction.data?.currentBid || 0;
        const bidCount = auction.data?.bidCount || 0;
        const isWinning = auction.data?.isWinning || false;
        
        card.innerHTML = `
            ${auction.imageUrl ? `
            <div class="auction-image">
                <img src="${auction.imageUrl}" alt="${this.escapeHtml(auction.title)}" />
            </div>
            ` : ''}
            <div class="auction-header">
                <div>
                    <div class="auction-title">${this.escapeHtml(auction.title)}</div>
                    <div class="auction-id">ID: ${auction.id}</div>
                </div>
                <span class="auction-status status-${auction.status}">${auction.status}</span>
            </div>
            
            <div class="auction-body">
                <div class="auction-info">
                    <div class="info-item">
                        <span class="info-label">Current Bid</span>
                        <span class="info-value price">$${currentBid}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Time Remaining</span>
                        <span class="info-value time">${timeRemaining}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Bid Count</span>
                        <span class="info-value">${bidCount}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Status</span>
                        <span class="info-value">${isWinning ? 'Winning' : 'Watching'}</span>
                    </div>
                </div>
                
                <div class="bid-config">
                    <div class="config-row">
                        <span class="config-label">Strategy:</span>
                        <select class="config-select" data-auction-id="${auction.id}" data-config="strategy">
                            <option value="manual" ${auction.config.strategy === 'manual' ? 'selected' : ''}>Manual Only</option>
                            <option value="increment" ${auction.config.strategy === 'increment' ? 'selected' : ''}>Incremental</option>
                            <option value="sniping" ${auction.config.strategy === 'sniping' ? 'selected' : ''}>Snipe (Last 30s)</option>
                        </select>
                    </div>
                    <div class="config-row">
                        <span class="config-label">Max Bid:</span>
                        <div class="config-input-group">
                            <span class="currency">$</span>
                            <input type="number" 
                                class="config-input" 
                                data-auction-id="${auction.id}" 
                                data-config="maxBid"
                                value="${auction.config.maxBid}" 
                                min="0" 
                                step="1"
                                placeholder="0">
                        </div>
                    </div>
                    <div class="config-row">
                        <span class="config-label">Increment:</span>
                        <span class="config-value">$${auction.config.bidIncrement}</span>
                    </div>
                </div>
            </div>
            
            <div class="auction-actions">
                <a href="${auction.url}" target="_blank" class="btn btn-primary btn-small">View Auction</a>
                <button class="btn btn-danger btn-small" onclick="monitorUI.stopMonitoring('${auction.id}')">
                    Stop Monitoring
                </button>
            </div>
        `;
        
        return card;
    }
    
    formatTimeRemaining(seconds) {
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
    
    updateTimeRemaining() {
        this.auctions.forEach(auction => {
            if (auction.data && auction.data.timeRemaining > 0) {
                auction.data.timeRemaining--;
            }
        });
        
        // Update time displays without full re-render
        document.querySelectorAll('.auction-card').forEach(card => {
            const auctionId = card.getAttribute('data-auction-id');
            const auction = this.auctions.get(auctionId);
            if (auction && auction.data) {
                const timeElement = card.querySelector('.info-value.time');
                if (timeElement) {
                    timeElement.textContent = this.formatTimeRemaining(auction.data.timeRemaining);
                }
            }
        });
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showNotification(data) {
        // Could add toast notifications here
        console.log('Notification:', data);
    }
}

// Initialize the UI when the page loads
let monitorUI;
document.addEventListener('DOMContentLoaded', () => {
    monitorUI = new AuctionMonitorUI();
});