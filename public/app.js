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
            statusDot: document.querySelector('#connection-status .status-dot'),
            statusText: document.querySelector('#connection-status .status-text'),
            authStatus: document.getElementById('auth-status'),
            authStatusDot: document.querySelector('#auth-status .status-dot'),
            authStatusText: document.querySelector('#auth-status .status-text'),
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
        this.checkAuthStatus();
        
        // Check auth status periodically
        setInterval(() => this.checkAuthStatus(), 30000); // Every 30 seconds
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
                // Check auth status after WebSocket auth
                this.checkAuthStatus();
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
        
        // No longer needed - using inline event handlers
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
    
    updateStrategy(auctionId, strategy) {
        this.updateAuctionConfig(auctionId, 'strategy', strategy);
    }
    
    updateMaxBid(auctionId, value) {
        const maxBid = parseInt(value) || 0;
        this.updateAuctionConfig(auctionId, 'maxBid', maxBid);
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
            this.auctions.forEach((auction) => {
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
        
        const data = auction.data || {};
        const timeRemaining = data.timeRemaining || 0;
        const isWinning = data.isWinning || false;
        
        // Update card status classes
        card.className = 'auction-card';
        if (isWinning) card.classList.add('winning');
        else if (timeRemaining <= 30 && timeRemaining > 0) card.classList.add('urgent');
        else if (timeRemaining <= 300 && timeRemaining > 0) card.classList.add('warning');
        
        // Status badges removed for cleaner design
        
        // Update current bid with flash animation
        const priceElement = card.querySelector('.current-price');
        if (priceElement && data.currentBid !== undefined) {
            const oldPrice = priceElement.textContent;
            const newPrice = `$${data.currentBid}`;
            if (oldPrice !== newPrice) {
                priceElement.textContent = newPrice;
                priceElement.classList.add('price-flash');
                setTimeout(() => priceElement.classList.remove('price-flash'), 500);
            }
        }
        
        // Update price section class
        const priceSection = card.querySelector('.price-section');
        if (priceSection) {
            priceSection.className = `price-section ${isWinning ? 'winning' : 'losing'}`;
        }
        
        // Update time bar
        const timeBar = card.querySelector('.time-bar-fill');
        if (timeBar && data.timeRemaining !== undefined) {
            const maxTime = 3600;
            const timePercentage = Math.min((timeRemaining / maxTime) * 100, 100);
            timeBar.style.width = `${timePercentage}%`;
            timeBar.className = `time-bar-fill ${timeRemaining <= 30 ? 'urgent' : timeRemaining <= 300 ? 'warning' : ''}`;
        }
        
        // Update time remaining text
        const timeText = card.querySelector('.time-remaining');
        if (timeText && data.timeRemaining !== undefined) {
            timeText.textContent = this.formatTimeRemaining(timeRemaining);
        }
        
        // Update bidders count
        const biddersElement = card.querySelector('.meta-item:first-child .meta-value');
        if (biddersElement && data.bidderCount !== undefined) {
            biddersElement.textContent = data.bidderCount;
        }
        
        // Update bid count
        const bidCountElement = card.querySelector('.meta-item:last-child .meta-value');
        if (bidCountElement && data.bidCount !== undefined) {
            bidCountElement.textContent = data.bidCount;
        }
        
        // Update strategy pills
        if (auction.config) {
            const pills = card.querySelectorAll('.strategy-pill');
            pills.forEach(pill => {
                // Get strategy from the onclick attribute or text content
                let strategy = '';
                if (pill.textContent.trim() === 'Manual') strategy = 'manual';
                else if (pill.textContent.trim() === 'Auto') strategy = 'increment';
                else if (pill.textContent.trim() === 'Snipe') strategy = 'sniping';
                
                if (strategy === auction.config.strategy) {
                    pill.classList.add('active');
                    pill.setAttribute('disabled', 'true');
                } else {
                    pill.classList.remove('active');
                    pill.removeAttribute('disabled');
                }
            });
            
            // Update max bid
            const maxBidInput = card.querySelector('.max-bid-input');
            if (maxBidInput && parseInt(maxBidInput.value) !== auction.config.maxBid) {
                maxBidInput.value = auction.config.maxBid;
            }
        }
    }
    
    createAuctionCard(auction) {
        const card = document.createElement('div');
        const timeRemaining = auction.data?.timeRemaining || 0;
        const currentBid = auction.data?.currentBid || 0;
        const bidCount = auction.data?.bidCount || 0;
        const bidderCount = auction.data?.bidderCount || 0;
        const isWinning = auction.data?.isWinning || false;
        
        // Determine card status class
        let cardClass = 'auction-card';
        if (isWinning) cardClass += ' winning';
        else if (timeRemaining <= 30 && timeRemaining > 0) cardClass += ' urgent';
        else if (timeRemaining <= 300 && timeRemaining > 0) cardClass += ' warning';
        
        card.className = cardClass;
        card.setAttribute('data-auction-id', auction.id);
        
        // Calculate time percentage for progress bar
        const maxTime = 3600; // Assume 1 hour max for visualization
        const timePercentage = Math.min((timeRemaining / maxTime) * 100, 100);
        
        card.innerHTML = `
            ${auction.imageUrl ? `
            <div class="auction-image">
                <img src="${auction.imageUrl}" alt="${this.escapeHtml(auction.title)}" onerror="this.parentElement.classList.add('no-image')" />
            </div>
            ` : '<div class="auction-image no-image"></div>'}
            
            <div class="auction-header">
                <div class="auction-title">${this.escapeHtml(auction.title)}</div>
            </div>
            
            <div class="auction-body">
                <div class="price-section ${isWinning ? 'winning' : 'losing'}">
                    <div class="current-price">$${currentBid}</div>
                    <div class="time-bar">
                        <div class="time-bar-fill ${timeRemaining <= 30 ? 'urgent' : timeRemaining <= 300 ? 'warning' : ''}" 
                             style="width: ${timePercentage}%"></div>
                    </div>
                    <div class="time-remaining">${this.formatTimeRemaining(timeRemaining)}</div>
                </div>
                
                <div class="auction-meta">
                    <div class="meta-item">
                        <svg fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
                        </svg>
                        <span class="meta-value">${bidderCount}</span>
                        <span>bidders</span>
                    </div>
                    <div class="meta-item">
                        <svg fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/>
                        </svg>
                        <span class="meta-value">${bidCount}</span>
                        <span>bids</span>
                    </div>
                </div>
                
                <div class="strategy-pills">
                    <button class="strategy-pill ${auction.config.strategy === 'manual' ? 'active' : ''}" 
                            onclick="monitorUI.updateStrategy('${auction.id}', 'manual')"
                            ${auction.config.strategy === 'manual' ? 'disabled' : ''}>
                        Manual
                    </button>
                    <button class="strategy-pill ${auction.config.strategy === 'increment' ? 'active' : ''}" 
                            onclick="monitorUI.updateStrategy('${auction.id}', 'increment')"
                            ${auction.config.strategy === 'increment' ? 'disabled' : ''}>
                        Auto
                    </button>
                    <button class="strategy-pill ${auction.config.strategy === 'sniping' ? 'active' : ''}" 
                            onclick="monitorUI.updateStrategy('${auction.id}', 'sniping')"
                            ${auction.config.strategy === 'sniping' ? 'disabled' : ''}>
                        Snipe
                    </button>
                </div>
                
                <div class="max-bid-section">
                    <span class="max-bid-label">Max bid</span>
                    <input type="number" 
                        class="max-bid-input" 
                        value="${auction.config.maxBid}" 
                        min="0" 
                        step="1"
                        placeholder="0"
                        onchange="monitorUI.updateMaxBid('${auction.id}', this.value)"
                        onfocus="this.select()">
                </div>
                
                <div class="quick-actions">
                    <a href="${auction.url}" target="_blank" class="action-btn primary">
                        <svg fill="currentColor" viewBox="0 0 20 20">
                            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/>
                            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/>
                        </svg>
                        View
                    </a>
                    <button class="action-btn danger" onclick="monitorUI.stopMonitoring('${auction.id}')">
                        <svg fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                        </svg>
                        Stop
                    </button>
                </div>
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
                const timeRemaining = auction.data.timeRemaining || 0;
                
                // Update time text
                const timeElement = card.querySelector('.time-remaining');
                if (timeElement) {
                    timeElement.textContent = this.formatTimeRemaining(timeRemaining);
                }
                
                // Update time bar
                const timeBar = card.querySelector('.time-bar-fill');
                if (timeBar) {
                    const maxTime = 3600;
                    const timePercentage = Math.min((timeRemaining / maxTime) * 100, 100);
                    timeBar.style.width = `${timePercentage}%`;
                    timeBar.className = `time-bar-fill ${timeRemaining <= 30 ? 'urgent' : timeRemaining <= 300 ? 'warning' : ''}`;
                }
                
                // Update card urgency class
                if (timeRemaining <= 30 && timeRemaining > 0 && !card.classList.contains('urgent')) {
                    card.classList.add('urgent');
                    card.classList.remove('warning');
                } else if (timeRemaining <= 300 && timeRemaining > 30 && !card.classList.contains('warning')) {
                    card.classList.add('warning');
                    card.classList.remove('urgent');
                } else if (timeRemaining > 300) {
                    card.classList.remove('warning', 'urgent');
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
    
    async checkAuthStatus() {
        try {
            const response = await fetch('/api/auth/status');
            const data = await response.json();
            
            this.updateAuthStatus(data.authenticated, data.cookieCount);
        } catch (error) {
            console.error('Failed to check auth status:', error);
            this.updateAuthStatus(false, 0);
        }
    }
    
    updateAuthStatus(isAuthenticated, cookieCount = 0) {
        if (isAuthenticated) {
            this.elements.authStatusDot.className = 'status-dot connected';
            this.elements.authStatusText.textContent = `Authenticated (${cookieCount} cookies)`;
        } else {
            this.elements.authStatusDot.className = 'status-dot disconnected';
            this.elements.authStatusText.textContent = 'Not Authenticated';
        }
    }
}

// Initialize the UI when the page loads
let monitorUI;
document.addEventListener('DOMContentLoaded', () => {
    monitorUI = new AuctionMonitorUI();
});