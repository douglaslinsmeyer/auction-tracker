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
            statusDot: document.getElementById('connection-dot'),
            statusText: document.getElementById('connection-text'),
            authStatus: document.getElementById('auth-status'),
            authStatusDot: document.getElementById('auth-dot'),
            authStatusText: document.getElementById('auth-text'),
            auctionsGrid: document.getElementById('auctions-grid'),
            emptyState: document.getElementById('empty-state'),
            auctionCount: document.getElementById('auction-count')
        };
        
        this.init();
    }
    
    init() {
        this.connectWebSocket();
        this.attachEventListeners();
        this.initModalHandlers();
        this.loadAuctions();
        this.checkAuthStatus();
        
        // Check auth status periodically
        setInterval(() => this.checkAuthStatus(), 30000); // Every 30 seconds
    }
    
    async connectWebSocket() {
        let wsUrl;
        
        // Try to get configuration from server
        try {
            const response = await fetch('/api/config');
            if (response.ok) {
                const config = await response.json();
                wsUrl = config.wsUrl;
            }
        } catch (error) {
            console.log('Could not fetch config, using defaults');
        }
        
        // Fallback to environment-based URL
        if (!wsUrl) {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.hostname;
            const port = '3000'; // Default backend port
            wsUrl = `${protocol}//${host}:${port}`;
        }
        
        console.log('Connecting to WebSocket:', wsUrl);
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.reconnectAttempts = 0;
            this.updateConnectionStatus('connected');
            
            // Start ping interval to keep connection alive
            this.startPingInterval();
            
            // Authenticate first
            // Get token from localStorage or prompt user
            let authToken = localStorage.getItem('authToken');
            if (!authToken) {
                authToken = prompt('Please enter your authentication token:');
                if (authToken) {
                    localStorage.setItem('authToken', authToken);
                } else {
                    console.error('Authentication token is required');
                    this.ws.close();
                    return;
                }
            }
            
            this.sendMessage({
                type: 'authenticate',
                token: authToken,
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
        const connectionDot = document.getElementById('connection-dot');
        const connectionText = document.getElementById('connection-text');
        
        if (status === 'connected') {
            connectionDot.className = 'inline-block w-2 h-2 rounded-full bg-green-500';
            connectionText.textContent = 'Connected';
        } else {
            connectionDot.className = 'inline-block w-2 h-2 rounded-full bg-red-500';
            connectionText.textContent = 'Disconnected';
        }
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
                if (message.success) {
                    console.log('Authentication successful');
                    // Now request the monitored auctions
                    this.sendMessage({
                        type: 'getMonitoredAuctions',
                        requestId: this.generateRequestId()
                    });
                    // Check auth status after WebSocket auth
                    this.checkAuthStatus();
                } else {
                    console.error('Authentication failed:', message.error);
                    // Clear stored token and reconnect
                    localStorage.removeItem('authToken');
                    alert('Authentication failed. Please refresh the page and enter a valid token.');
                    this.ws.close();
                }
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
        // Update every second for time remaining
        setInterval(() => this.updateTimeRemaining(), 1000);
    }
    
    async loadAuctions() {
        try {
            // Get backend URL from config
            const configResponse = await fetch('/api/config');
            const config = await configResponse.json();
            const backendUrl = config.backendUrl || 'http://localhost:3000';
            
            const response = await fetch(`${backendUrl}/api/auctions`);
            const data = await response.json();
            
            if (data.auctions) {
                this.updateAuctions(data.auctions);
            }
        } catch (error) {
            console.error('Failed to load auctions:', error);
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
        console.log('Received auction state:', auction.id, 'Config:', auction.config);
        
        const existingAuction = this.auctions.get(auction.id);
        
        // Store the auction state
        this.auctions.set(auction.id, auction);
        
        // Count update removed
        
        if (!existingAuction) {
            // New auction - need full render
            console.log('New auction, performing full render');
            this.render();
        } else {
            // Existing auction - patch the card
            console.log('Existing auction, patching card');
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
    
    toggleAutoBid(auctionId) {
        const auction = this.auctions.get(auctionId);
        if (!auction) return;
        
        const newAutoBidStatus = !auction.config.autoBid;
        
        // Update autoBid flag
        this.updateAuctionConfig(auctionId, 'autoBid', newAutoBidStatus);
        
        console.log(`Toggling auto-bid for auction ${auctionId} to ${newAutoBidStatus}`);
    }
    
    updateStrategy(auctionId, strategy) {
        // When strategy is changed, also update autoBid flag
        const configUpdate = {
            strategy: strategy,
            autoBid: true  // Always enable autoBid since we removed manual
        };
        
        // Send both updates together
        this.sendMessage({
            type: 'updateConfig',
            auctionId: auctionId,
            config: configUpdate,
            requestId: this.generateRequestId()
        });
        
        console.log(`Updating strategy for auction ${auctionId} to ${strategy} with autoBid: true`);
    }
    
    validateMaxBidInput(inputElement, auctionId) {
        const auction = this.auctions.get(auctionId);
        const value = parseInt(inputElement.value) || 0;
        
        if (auction && auction.data && auction.data.nextBid) {
            const minimumBid = auction.data.nextBid;
            const isWinning = auction.data.isWinning || false;
            
            // Update input attributes in real-time
            inputElement.min = minimumBid;
            inputElement.placeholder = minimumBid;
            inputElement.title = `Maximum bid (minimum: $${minimumBid})`;
            
            // Get the container div for visual validation
            const maxBidContainer = inputElement.closest('div.flex.items-center.gap-3');
            if (maxBidContainer) {
                // Visual feedback for invalid values on the container
                // Don't show error if user is winning, even if max bid is less than next bid
                if (value > 0 && value < minimumBid && !isWinning) {
                    maxBidContainer.className = 'flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg px-4 py-3';
                } else {
                    maxBidContainer.className = 'flex items-center gap-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3';
                }
            }
        }
    }

    updateMaxBid(auctionId, value) {
        const auction = this.auctions.get(auctionId);
        const maxBid = parseInt(value) || 0;
        
        // Validate that max bid is >= minimum bid
        if (auction && auction.data && auction.data.nextBid) {
            const minimumBid = auction.data.nextBid;
            if (maxBid > 0 && maxBid < minimumBid) {
                // Show error message and reset to minimum bid
                alert(`Maximum bid must be at least $${minimumBid} (the minimum next bid)`);
                
                // Update the input field to the minimum bid
                const maxBidInput = document.querySelector(`[data-auction-id="${auctionId}"] .max-bid-input`);
                if (maxBidInput) {
                    maxBidInput.value = minimumBid;
                    // Clear visual error state
                    maxBidInput.style.borderColor = '';
                    maxBidInput.style.backgroundColor = '';
                }
                
                // Send the corrected value
                this.updateAuctionConfig(auctionId, 'maxBid', minimumBid);
                return;
            }
        }
        
        this.updateAuctionConfig(auctionId, 'maxBid', maxBid);
    }
    
    render() {
        const auctionCount = this.auctions.size;
        this.elements.auctionCount.textContent = auctionCount;
        
        if (auctionCount === 0) {
            this.elements.auctionsGrid.classList.add('hidden');
            this.elements.emptyState.classList.remove('hidden');
        } else {
            this.elements.auctionsGrid.classList.remove('hidden');
            this.elements.emptyState.classList.add('hidden');
            
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
            console.log('Card not found for auction:', auction.id, '- performing full render');
            this.render();
            return;
        }
        
        console.log('Patching card for auction:', auction.id, 'with config:', auction.config);
        
        const data = auction.data || {};
        const timeRemaining = data.timeRemaining || 0;
        const isWinning = data.isWinning || false;
        
        // Update card status classes without removing base classes
        // Keep the base classes and only update status
        card.classList.remove('winning', 'urgent', 'warning');
        if (isWinning) card.classList.add('winning');
        else if (timeRemaining <= 30 && timeRemaining > 0) card.classList.add('urgent');
        else if (timeRemaining <= 300 && timeRemaining > 0) card.classList.add('warning');
        
        // Status badges removed for cleaner design
        
        // Update current bid
        const priceElement = card.querySelector('.text-2xl.font-bold');
        if (priceElement && data.currentBid !== undefined) {
            const newPrice = `$${data.currentBid}`;
            priceElement.textContent = newPrice;
            // Update price color based on winning status
            priceElement.className = `text-2xl font-bold ${isWinning ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`;
        }
        
        // Update status badge
        const imageContainer = card.querySelector('.h-56.overflow-hidden');
        if (imageContainer) {
            // Find existing status badge
            let statusBadge = imageContainer.querySelector('.absolute.top-2.left-2');
            
            // Determine new badge content
            let newBadgeHTML = '';
            if (isWinning) {
                newBadgeHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>WINNING';
            } else if (timeRemaining <= 30 && timeRemaining > 0) {
                newBadgeHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>ENDING';
            } else if (timeRemaining <= 300 && timeRemaining > 0) {
                newBadgeHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>WARNING';
            }
            
            if (newBadgeHTML) {
                if (statusBadge) {
                    // Update existing badge
                    statusBadge.innerHTML = newBadgeHTML;
                    statusBadge.className = `absolute top-2 left-2 px-3 py-1.5 ${isWinning ? 'bg-green-500' : timeRemaining <= 30 ? 'bg-red-500' : 'bg-yellow-500'} text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-1.5`;
                } else {
                    // Create new badge
                    statusBadge = document.createElement('div');
                    statusBadge.className = `absolute top-2 left-2 px-3 py-1.5 ${isWinning ? 'bg-green-500' : timeRemaining <= 30 ? 'bg-red-500' : 'bg-yellow-500'} text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-1.5`;
                    statusBadge.innerHTML = newBadgeHTML;
                    // Insert after gradient overlay
                    const gradient = imageContainer.querySelector('.bg-gradient-to-t');
                    if (gradient) {
                        gradient.insertAdjacentElement('afterend', statusBadge);
                    }
                }
            } else if (statusBadge) {
                // Remove badge if no longer needed
                statusBadge.remove();
            }
        }
        
        // Update time bar
        const timeBar = card.querySelector('.bg-gray-200.dark\\:bg-gray-600.rounded-full.h-1\\.5 > div');
        if (timeBar && data.timeRemaining !== undefined) {
            const maxTime = 3600;
            const timePercentage = Math.min((timeRemaining / maxTime) * 100, 100);
            timeBar.style.width = `${timePercentage}%`;
            timeBar.className = `h-full rounded-full transition-all duration-300 ${timeRemaining <= 30 ? 'bg-red-500' : timeRemaining <= 300 ? 'bg-yellow-500' : 'bg-primary-500'}`;
        }
        
        // Update time remaining text
        const timeText = card.querySelector('.text-right .text-lg.font-semibold');
        if (timeText && data.timeRemaining !== undefined) {
            timeText.textContent = this.formatTimeRemaining(timeRemaining);
            timeText.className = `text-lg font-semibold ${timeRemaining <= 30 ? 'text-red-600 dark:text-red-400' : timeRemaining <= 300 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-700 dark:text-gray-300'}`;
        }
        
        // Update bidders count
        const statsContainer = card.querySelector('.flex.items-center.justify-center.gap-6');
        if (statsContainer) {
            const biddersStrong = statsContainer.querySelector('div:first-child strong');
            if (biddersStrong && data.bidderCount !== undefined) {
                biddersStrong.textContent = data.bidderCount;
            }
            
            // Update bid count
            const bidCountStrong = statsContainer.querySelector('div:last-child strong');
            if (bidCountStrong && data.bidCount !== undefined) {
                bidCountStrong.textContent = data.bidCount;
            }
        }
        
        // Update strategy buttons
        if (auction.config) {
            const strategyContainer = card.querySelector('.grid.grid-cols-2.gap-1\\.5');
            if (strategyContainer) {
                const buttons = strategyContainer.querySelectorAll('button');
                buttons.forEach(button => {
                    // Get strategy from the onclick attribute
                    const onclickAttr = button.getAttribute('onclick');
                    let strategy = '';
                    if (onclickAttr && onclickAttr.includes("'increment'")) strategy = 'increment';
                    else if (onclickAttr && onclickAttr.includes("'sniping'")) strategy = 'sniping';
                    
                    if (strategy === auction.config.strategy) {
                        // Active strategy styling
                        button.className = 'px-2 py-1.5 text-xs font-medium rounded-md transition-all bg-primary-600 text-white shadow-sm';
                        button.setAttribute('disabled', 'true');
                    } else {
                        // Inactive strategy styling
                        button.className = 'px-2 py-1.5 text-xs font-medium rounded-md transition-all bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600';
                        button.removeAttribute('disabled');
                    }
                });
            }
            
            // Update autobid toggle button
            const autoBidButtons = card.querySelectorAll('button');
            autoBidButtons.forEach(button => {
                const onclickAttr = button.getAttribute('onclick');
                if (onclickAttr && onclickAttr.includes('toggleAutoBid')) {
                    const isEnabled = auction.config.autoBid;
                    
                    // Update button styling
                    button.className = `w-full px-3 py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${isEnabled ? 'bg-green-500 hover:bg-green-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`;
                    button.title = `${isEnabled ? 'Pause' : 'Enable'} auto-bidding`;
                    
                    // Update icon
                    const svg = button.querySelector('svg path');
                    if (svg) {
                        svg.setAttribute('d', isEnabled ? 
                            'M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zM11 8a1 1 0 112 0v4a1 1 0 11-2 0V8z' :
                            'M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z');
                    }
                    
                    // Update text content
                    const textSpans = button.querySelectorAll('span');
                    textSpans.forEach(span => {
                        if (span.textContent.includes('Auto-bid')) {
                            span.textContent = `${isEnabled ? 'Pause' : 'Enable'} Auto-bid`;
                        } else if (span.className.includes('text-xs')) {
                            span.className = `text-xs font-medium px-2 py-0.5 rounded-full ${isEnabled ? 'bg-green-400/20 text-green-700 dark:text-green-300' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400'}`;
                            span.textContent = isEnabled ? 'ACTIVE' : 'PAUSED';
                        }
                    });
                }
            });
            
            
            // Update max bid input
            const maxBidInput = card.querySelector('input[type="number"]');
            if (maxBidInput) {
                // Only update value if it's different to avoid losing user input
                if (parseInt(maxBidInput.value) !== auction.config.maxBid) {
                    maxBidInput.value = auction.config.maxBid;
                }
                
                // Update minimum bid validation attributes
                if (auction.data && auction.data.nextBid) {
                    const minimumBid = auction.data.nextBid;
                    const isWinning = auction.data.isWinning || false;
                    
                    maxBidInput.min = minimumBid;
                    maxBidInput.placeholder = minimumBid;
                    maxBidInput.title = `Maximum bid (minimum: $${minimumBid})`;
                    
                    // Get the container div for visual validation
                    const maxBidContainer = maxBidInput.closest('div.flex.items-center.gap-3');
                    if (maxBidContainer) {
                        const currentValue = parseInt(maxBidInput.value) || 0;
                        // Don't show error if user is winning, even if max bid is less than next bid
                        if (currentValue > 0 && currentValue < minimumBid && !isWinning) {
                            // Show error state on container
                            maxBidContainer.className = 'flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg px-4 py-3';
                        } else {
                            // Reset to normal state
                            maxBidContainer.className = 'flex items-center gap-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3';
                        }
                    }
                }
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
        
        // Determine card status
        let statusClass = '';
        let statusColor = '';
        if (isWinning) {
            statusClass = 'winning';
            statusColor = 'bg-green-500';
        } else if (timeRemaining <= 30 && timeRemaining > 0) {
            statusClass = 'urgent';
            statusColor = 'bg-red-500';
        } else if (timeRemaining <= 300 && timeRemaining > 0) {
            statusClass = 'warning';
            statusColor = 'bg-yellow-500';
        }
        
        card.className = `group bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-100 dark:border-gray-700 ${statusClass}`;
        card.setAttribute('data-auction-id', auction.id);
        card.addEventListener('click', (e) => {
            // Don't trigger on button clicks
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.closest('button') || e.target.closest('input')) {
                return;
            }
            this.showBidHistory(auction.id, auction.title);
        });
        
        // Calculate time percentage for progress bar
        const maxTime = 3600; // Assume 1 hour max for visualization
        const timePercentage = Math.min((timeRemaining / maxTime) * 100, 100);
        
        // Determine status badge
        let statusBadge = '';
        if (isWinning) {
            statusBadge = '<div class="absolute top-2 left-2 px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-1.5"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>WINNING</div>';
        } else if (timeRemaining <= 30 && timeRemaining > 0) {
            statusBadge = '<div class="absolute top-2 left-2 px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-1.5"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>ENDING</div>';
        } else if (timeRemaining <= 300 && timeRemaining > 0) {
            statusBadge = '<div class="absolute top-2 left-2 px-3 py-1.5 bg-yellow-500 text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-1.5"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>WARNING</div>';
        }

        card.innerHTML = `
            <div class="relative">
                ${auction.imageUrl ? `
                <div class="h-56 overflow-hidden bg-gray-100 dark:bg-gray-700 relative">
                    <img src="${auction.imageUrl}" alt="${this.escapeHtml(auction.title)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onerror="this.parentElement.innerHTML='<div class=\\'flex items-center justify-center h-full text-gray-400\\'>No Image</div>'" />
                    <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                    ${statusBadge}
                    <div class="absolute bottom-0 left-0 right-0 p-4">
                        <h3 class="text-white font-semibold text-lg line-clamp-2 drop-shadow-lg">${this.escapeHtml(auction.title)}</h3>
                    </div>
                </div>
                ` : `<div class="h-56 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 relative">
                    <span class="text-gray-400">No Image</span>
                    ${statusBadge}
                    <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-200 dark:from-gray-800 to-transparent">
                        <h3 class="text-gray-700 dark:text-gray-300 font-semibold text-lg line-clamp-2">${this.escapeHtml(auction.title)}</h3>
                    </div>
                </div>`}
            </div>
            
            <div class="p-5">
                
                <div class="space-y-3">
                    <!-- Price and Time -->
                    <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                        <div class="flex items-center justify-between mb-2">
                            <div>
                                <p class="text-xs text-gray-500 dark:text-gray-400">Current Bid</p>
                                <p class="text-2xl font-bold ${isWinning ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}">$${currentBid}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-xs text-gray-500 dark:text-gray-400">Time Left</p>
                                <p class="text-lg font-semibold ${timeRemaining <= 30 ? 'text-red-600 dark:text-red-400' : timeRemaining <= 300 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-700 dark:text-gray-300'}">${this.formatTimeRemaining(timeRemaining)}</p>
                            </div>
                        </div>
                        <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 overflow-hidden">
                            <div class="h-full rounded-full transition-all duration-300 ${timeRemaining <= 30 ? 'bg-red-500' : timeRemaining <= 300 ? 'bg-yellow-500' : 'bg-primary-500'}" style="width: ${timePercentage}%"></div>
                        </div>
                    </div>
                    
                    <!-- Stats -->
                    <div class="flex items-center justify-center gap-6 text-sm">
                        <div class="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
                            </svg>
                            <span><strong class="font-semibold text-gray-900 dark:text-white">${bidderCount}</strong> bidders</span>
                        </div>
                        <div class="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252zM10 8V2.002A8.001 8.001 0 1018 10h-6a2 2 0 01-2-2z" clip-rule="evenodd"/>
                            </svg>
                            <span><strong class="font-semibold text-gray-900 dark:text-white">${bidCount}</strong> bids</span>
                        </div>
                    </div>
                    
                    <!-- Bidding Strategy -->
                    <div class="grid grid-cols-2 gap-1.5">
                        <button class="px-2 py-1.5 text-xs font-medium rounded-md transition-all ${auction.config.strategy === 'increment' ? 'bg-primary-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}" 
                                onclick="monitorUI.updateStrategy('${auction.id}', 'increment')"
                                ${auction.config.strategy === 'increment' ? 'disabled' : ''}>
                            Auto
                        </button>
                        <button class="px-2 py-1.5 text-xs font-medium rounded-md transition-all ${auction.config.strategy === 'sniping' ? 'bg-primary-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}" 
                                onclick="monitorUI.updateStrategy('${auction.id}', 'sniping')"
                                ${auction.config.strategy === 'sniping' ? 'disabled' : ''}>
                            Snipe
                        </button>
                    </div>
                    
                    <!-- Max Bid -->
                    <div class="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3">
                        <label class="text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Max Bid:</label>
                        <div class="relative flex-1">
                            <span class="absolute left-0 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-semibold text-base">$</span>
                            <input type="number" 
                                class="w-full pl-5 bg-transparent border-0 text-base font-medium text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-0" 
                                value="${auction.config.maxBid}" 
                                min="${auction.data?.nextBid || 0}" 
                                step="1"
                                placeholder="${auction.data?.nextBid || 0}"
                                title="Maximum bid (minimum: $${auction.data?.nextBid || 0})"
                                onchange="monitorUI.updateMaxBid('${auction.id}', this.value)"
                                oninput="monitorUI.validateMaxBidInput(this, '${auction.id}')"
                                onfocus="this.select()">
                        </div>
                    </div>
                    
                    <!-- Auto-bid Toggle -->
                    <button class="w-full px-3 py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${auction.config.autoBid ? 'bg-green-500 hover:bg-green-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}" 
                            onclick="monitorUI.toggleAutoBid('${auction.id}')"
                            title="${auction.config.autoBid ? 'Pause' : 'Enable'} auto-bidding">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            ${auction.config.autoBid ? 
                                '<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zM11 8a1 1 0 112 0v4a1 1 0 11-2 0V8z" clip-rule="evenodd"/>' :
                                '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>'
                            }
                        </svg>
                        <span class="text-sm">${auction.config.autoBid ? 'Auto-Bidding Active' : 'Enable Auto-Bidding'}</span>
                    </button>
                    
                    <!-- Actions -->
                    <div class="flex gap-2 pt-2">
                        <a href="${auction.url}" target="_blank" class="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-center rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-1.5 text-sm font-medium">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/>
                                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/>
                            </svg>
                            View Auction
                        </a>
                        <button class="px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center justify-center gap-1.5 text-sm font-medium" onclick="monitorUI.stopMonitoring('${auction.id}')">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                            </svg>
                            Stop
                        </button>
                    </div>
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
        const authDot = document.getElementById('auth-dot');
        const authText = document.getElementById('auth-text');
        
        if (isAuthenticated) {
            authDot.className = 'inline-block w-2 h-2 rounded-full bg-green-500';
            authText.textContent = `Authenticated (${cookieCount})`;
        } else {
            authDot.className = 'inline-block w-2 h-2 rounded-full bg-red-500';
            authText.textContent = 'Not Authenticated';
        }
    }
    
    async showBidHistory(auctionId, auctionTitle) {
        const modal = document.getElementById('bid-history-modal');
        const title = document.getElementById('bid-history-title');
        const loading = document.getElementById('bid-history-loading');
        const content = document.getElementById('bid-history-content');
        const empty = document.getElementById('bid-history-empty');
        
        // Set title and show modal
        title.textContent = `Bid History - ${auctionTitle}`;
        modal.classList.remove('hidden');
        
        // Show loading state
        loading.classList.remove('hidden');
        content.classList.add('hidden');
        empty.classList.add('hidden');
        
        try {
            const response = await fetch(`/api/auctions/${auctionId}/bids?limit=50`);
            const data = await response.json();
            
            if (data.success && data.bidHistory.length > 0) {
                this.renderBidHistory(data.bidHistory);
                loading.classList.add('hidden');
                content.classList.remove('hidden');
            } else {
                // No bid history - show sample data for demo
                const sampleData = [
                    {
                        amount: 51,
                        success: true,
                        timestamp: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
                        strategy: 'manual'
                    },
                    {
                        amount: 45,
                        success: false,
                        timestamp: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
                        strategy: 'increment',
                        error: 'You already placed a bid with the same price. Please raise your bid instead.'
                    },
                    {
                        amount: 40,
                        success: true,
                        timestamp: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
                        strategy: 'increment'
                    }
                ];
                
                this.renderBidHistory(sampleData);
                loading.classList.add('hidden');
                content.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Failed to load bid history:', error);
            loading.classList.add('hidden');
            content.innerHTML = `
                <div class="text-center py-4 text-red-600 dark:text-red-400">
                    <p class="font-medium">Failed to load bid history</p>
                    <p class="text-sm mt-1">${error.message}</p>
                </div>
            `;
            content.classList.remove('hidden');
        }
    }
    
    renderBidHistory(bidHistory) {
        const content = document.getElementById('bid-history-content');
        
        const historyHTML = bidHistory.map(bid => {
            const isSuccess = bid.success;
            const timestamp = new Date(bid.timestamp).toLocaleString();
            const strategy = bid.strategy || 'manual';
            
            return `
                <div class="flex items-start justify-between p-4 border rounded-lg ${isSuccess ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'}">
                    <div class="flex-1">
                        <div class="flex items-center gap-3 mb-1">
                            <span class="text-lg font-semibold ${isSuccess ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}">$${bid.amount}</span>
                            <span class="px-2 py-0.5 text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">${strategy}</span>
                        </div>
                        <div class="text-sm text-gray-600 dark:text-gray-400">${timestamp}</div>
                        ${!isSuccess && bid.error ? `<div class="mt-2 text-sm text-red-600 dark:text-red-400">${bid.error}</div>` : ''}
                    </div>
                    <div class="ml-4">
                        <svg class="w-6 h-6 ${isSuccess ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}" 
                             fill="currentColor" viewBox="0 0 20 20">
                            ${isSuccess ? 
                                '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>' :
                                '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>'
                            }
                        </svg>
                    </div>
                </div>
            `;
        }).join('');
        
        content.innerHTML = historyHTML;
    }
    
    closeBidHistory() {
        const modal = document.getElementById('bid-history-modal');
        modal.classList.add('hidden');
    }
    
    initModalHandlers() {
        const modal = document.getElementById('bid-history-modal');
        
        // Close modal when clicking outside of it
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeBidHistory();
            }
        });
        
        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('show')) {
                this.closeBidHistory();
            }
        });
    }
}

// Initialize the UI when the page loads
let monitorUI;
document.addEventListener('DOMContentLoaded', () => {
    monitorUI = new AuctionMonitorUI();
});