// Hot Deals functionality
(function() {
    const logger = window.Logger;
    
    console.log('Hot Deals script loading...');

class HotDealsManager {
    constructor() {
        this.lastUpdate = null;
        
        // Filter values
        this.filters = {
            searchQuery: 'tools', // Default search term
            maxDiscountRatio: 0.15, // 15% default
            maxPrice: null,
            defaultMaxBidPercentage: 0.20 // 20% default for suggested bids
        };
        
        // Pagination state
        this.pagination = {
            currentPage: 1,
            totalItems: 0,
            totalPages: 0,
            hasMore: false
        };
        
        // Store all loaded deals
        this.loadedDeals = [];
        
        this.elements = {
            grid: document.getElementById('hot-deals-grid'),
            loading: document.getElementById('hot-deals-loading'),
            empty: document.getElementById('hot-deals-empty'),
            lastUpdate: document.getElementById('hot-deals-last-update'),
            refreshButton: document.getElementById('refresh-hot-deals'),
            searchInput: document.getElementById('search-input'),
            discountSlider: document.getElementById('discount-percentage-slider'),
            discountValue: document.getElementById('discount-percentage-value'),
            discountDisplay: document.getElementById('discount-percentage-display'),
            maxPriceInput: document.getElementById('max-price-input'),
            maxBidPercentageSlider: document.getElementById('max-bid-percentage-slider'),
            maxBidPercentageValue: document.getElementById('max-bid-percentage-value'),
            applyFiltersButton: document.getElementById('apply-filters-button'),
            loadMoreContainer: document.getElementById('hot-deals-load-more-container'),
            loadMoreButton: document.getElementById('hot-deals-load-more'),
            remainingCount: document.getElementById('hot-deals-remaining'),
            showingCount: document.getElementById('hot-deals-showing'),
            totalCount: document.getElementById('hot-deals-total')
        };
        
        this.init();
    }
    
    getBackendUrl() {
        // Get backend URL from Config service first
        if (window.Config) {
            return window.Config.getBackendUrl();
        }
        // Fallback to settings manager or localStorage
        if (typeof settingsManager !== 'undefined' && settingsManager.getBackendUrl) {
            return settingsManager.getBackendUrl();
        }
        return localStorage.getItem('dashboard_backend_url') || 'http://localhost:3000';
    }
    
    async apiCall(path, options = {}) {
        const url = `${this.getBackendUrl()}${path}`;
        const authToken = localStorage.getItem('authToken') || 'dev-token';
        
        const headers = {
            'Authorization': authToken,
            ...options.headers
        };
        
        return fetch(url, {
            ...options,
            headers
        });
    }
    
    init() {
        // Set up event listeners
        
        if (this.elements.refreshButton) {
            this.elements.refreshButton.addEventListener('click', () => {
                this.loadHotDeals();
            });
        }
        
        // Set up filter controls
        if (this.elements.discountSlider) {
            this.elements.discountSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.elements.discountValue.textContent = `${value}%`;
                this.elements.discountDisplay.textContent = value;
            });
        }
        
        if (this.elements.maxBidPercentageSlider) {
            this.elements.maxBidPercentageSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.elements.maxBidPercentageValue.textContent = `${value}%`;
                this.filters.defaultMaxBidPercentage = value / 100;
            });
        }
        
        if (this.elements.applyFiltersButton) {
            this.elements.applyFiltersButton.addEventListener('click', () => {
                this.applyFilters();
            });
        }
        
        // Allow Enter key in inputs to apply filters
        if (this.elements.maxPriceInput) {
            this.elements.maxPriceInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.applyFilters();
                }
            });
        }
        
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.applyFilters();
                }
            });
        }
        
        // Load more button
        if (this.elements.loadMoreButton) {
            this.elements.loadMoreButton.addEventListener('click', () => {
                this.loadMoreDeals();
            });
        }
        
        // Load initial data when page becomes visible
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && document.getElementById('hot-deals-page').classList.contains('hidden') === false) {
                this.loadHotDeals();
            }
        });
        
        // Check if Hot Deals page is visible on init
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.target.id === 'hot-deals-page') {
                    const isVisible = !mutation.target.classList.contains('hidden');
                    if (isVisible && this.loadedDeals.length === 0) {
                        // Small delay to ensure elements are ready
                        setTimeout(() => {
                            this.loadHotDeals();
                        }, 100);
                    }
                }
            });
        });
        
        const hotDealsPage = document.getElementById('hot-deals-page');
        if (hotDealsPage) {
            observer.observe(hotDealsPage, { attributes: true, attributeFilter: ['class'] });
        }
    }
    
    applyFilters() {
        // Update filter values
        const searchValue = this.elements.searchInput.value.trim();
        this.filters.searchQuery = searchValue || 'tools'; // Default to 'tools' if empty
        
        const discountValue = parseInt(this.elements.discountSlider.value);
        this.filters.maxDiscountRatio = discountValue / 100; // Convert percentage to ratio
        
        const maxPriceValue = this.elements.maxPriceInput.value;
        this.filters.maxPrice = maxPriceValue ? parseFloat(maxPriceValue) : null;
        
        // Reset pagination and reload
        this.pagination.currentPage = 1;
        this.loadedDeals = [];
        this.loadHotDeals();
    }
    
    async loadHotDeals(append = false) {
        try {
            // Show loading state only for initial load
            if (!append) {
                this.showLoading();
            }
            
            // Build query parameters
            const params = new URLSearchParams({
                location: 'Phoenix',
                q: this.filters.searchQuery,
                mock: 'false',
                maxRatio: this.filters.maxDiscountRatio,
                page: this.pagination.currentPage,
                limit: 20
            });
            
            if (this.filters.maxPrice) {
                params.append('maxPrice', this.filters.maxPrice);
            }
            
            // Fetch hot deals from backend
            const response = await this.apiCall(`/api/hot-deals?${params.toString()}`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch hot deals: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Update pagination info
                if (data.pagination) {
                    this.pagination = {
                        currentPage: data.pagination.page,
                        totalItems: data.pagination.totalItems,
                        totalPages: data.pagination.totalPages,
                        hasMore: data.pagination.hasMore
                    };
                }
                
                if (data.deals && data.deals.length > 0) {
                    if (append) {
                        // Append new deals to existing ones
                        this.loadedDeals = [...this.loadedDeals, ...data.deals];
                    } else {
                        // Replace all deals
                        this.loadedDeals = data.deals;
                    }
                    this.displayDeals(this.loadedDeals);
                    this.updateCounts();
                    this.updateLoadMoreButton();
                } else if (!append) {
                    this.showEmpty();
                }
            }
            
            this.updateLastRefresh();
            
        } catch (error) {
            logger.error('Error loading hot deals:', error);
            this.showError(error.message);
        }
    }
    
    displayDeals(deals) {
        // Clear the grid
        this.elements.grid.innerHTML = '';
        
        // Create cards for each deal
        deals.forEach(deal => {
            const card = this.createDealCard(deal);
            this.elements.grid.appendChild(card);
        });
        
        // Show the grid and hide other states
        this.elements.grid.classList.remove('hidden');
        this.elements.loading.classList.add('hidden');
        this.elements.empty.classList.add('hidden');
        
        // Add click handlers for monitor buttons
        this.attachMonitorButtonHandlers();
    }
    
    createDealCard(deal) {
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow';
        
        // Handle both timeRemaining and closeTime formats
        let timeRemaining;
        if (deal.timeRemaining) {
            timeRemaining = this.formatTimeRemaining(deal.timeRemaining);
        } else if (deal.closeTime) {
            const closeTimeValue = typeof deal.closeTime === 'object' && deal.closeTime.value 
                ? deal.closeTime.value 
                : deal.closeTime;
            const remaining = Math.floor((new Date(closeTimeValue) - new Date()) / 1000);
            timeRemaining = this.formatTimeRemaining(remaining);
        } else {
            timeRemaining = 'Unknown';
        }
        
        // Create image URL - use the imageUrl from backend which already handles photos array
        let imageUrl = deal.imageUrl;
        
        if (!imageUrl) {
            // Create a nice placeholder with the product title
            const shortTitle = deal.title.substring(0, 30).replace(/[^a-zA-Z0-9\s]/g, '');
            imageUrl = `https://via.placeholder.com/400x300/94a3b8/1e293b?text=${encodeURIComponent(shortTitle)}`;
        }
        
        card.innerHTML = `
            <div class="relative">
                <div class="aspect-w-16 aspect-h-12 bg-gray-100 dark:bg-gray-700">
                    <img src="${imageUrl}" 
                         alt="${this.escapeHtml(deal.title)}" 
                         class="w-full h-48 object-cover"
                         onerror="this.onerror=null; this.src='https://via.placeholder.com/400x300/94a3b8/1e293b?text=Image+Not+Available'; this.style.objectFit='contain';"
                         loading="lazy">
                </div>
                <span class="absolute top-2 right-2 px-2 py-1 bg-red-600 text-white text-xs font-bold rounded shadow-lg">
                    ${deal.discountPercentage}% OFF
                </span>
            </div>
            <div class="p-4">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 mb-2">${this.escapeHtml(deal.title)}</h3>
                
                <div class="space-y-2">
                    <div class="flex justify-between items-center">
                        <span class="text-2xl font-bold text-green-600 dark:text-green-400">$${deal.currentPrice || deal.currentBid || 0}</span>
                        <span class="text-sm text-gray-500 dark:text-gray-400 line-through">$${deal.retailPrice || 0}</span>
                    </div>
                    
                    <div class="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                        <span>${deal.bidCount || 0} bids</span>
                        <span>${timeRemaining}</span>
                    </div>
                    
                    <div class="flex gap-2 mt-3">
                        <button data-auction-id="${deal.id}" 
                                data-auction-title="${this.escapeHtml(deal.title)}"
                                data-current-bid="${deal.currentPrice || deal.currentBid || 0}"
                                data-retail-price="${deal.retailPrice || 0}"
                                class="monitor-auction-btn flex-1 px-3 py-2 bg-green-600 text-white text-center rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all text-sm font-medium">
                            <svg class="inline-block w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                            </svg>
                            Monitor
                        </button>
                        <a href="${deal.auctionUrl || '#'}" target="_blank" rel="noopener noreferrer" 
                           class="flex-1 px-3 py-2 bg-primary-600 text-white text-center rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all cursor-pointer text-sm font-medium"
                           onclick="if(!this.href || this.href === '#' || this.href.includes('undefined')) { event.preventDefault(); alert('Deal URL not available'); return false; }">
                            View Deal
                        </a>
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
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showLoading() {
        this.elements.loading.classList.remove('hidden');
        this.elements.grid.classList.add('hidden');
        this.elements.empty.classList.add('hidden');
    }
    
    showEmpty() {
        this.elements.empty.classList.remove('hidden');
        this.elements.loading.classList.add('hidden');
        this.elements.grid.classList.add('hidden');
    }
    
    showError(message) {
        this.elements.empty.classList.remove('hidden');
        this.elements.loading.classList.add('hidden');
        this.elements.grid.classList.add('hidden');
        
        // Update empty state message to show error
        const emptyText = this.elements.empty.querySelector('p:nth-child(2)');
        if (emptyText) {
            emptyText.textContent = `Error: ${message}`;
        }
    }
    
    updateLastRefresh() {
        this.lastUpdate = new Date();
        if (this.elements.lastUpdate) {
            this.elements.lastUpdate.textContent = this.lastUpdate.toLocaleTimeString();
        }
    }
    
    loadMoreDeals() {
        if (this.pagination.hasMore) {
            this.pagination.currentPage++;
            this.loadHotDeals(true); // Append mode
        }
    }
    
    updateCounts() {
        if (this.elements.showingCount) {
            this.elements.showingCount.textContent = this.loadedDeals.length;
        }
        if (this.elements.totalCount) {
            this.elements.totalCount.textContent = this.pagination.totalItems;
        }
    }
    
    updateLoadMoreButton() {
        if (this.pagination.hasMore) {
            this.elements.loadMoreContainer.classList.remove('hidden');
            const remaining = this.pagination.totalItems - this.loadedDeals.length;
            if (this.elements.remainingCount) {
                this.elements.remainingCount.textContent = remaining;
            }
        } else {
            this.elements.loadMoreContainer.classList.add('hidden');
        }
    }
    
    attachMonitorButtonHandlers() {
        const monitorButtons = document.querySelectorAll('.monitor-auction-btn');
        monitorButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const auctionId = button.dataset.auctionId;
                const auctionTitle = button.dataset.auctionTitle;
                const currentBid = parseFloat(button.dataset.currentBid);
                const retailPrice = parseFloat(button.dataset.retailPrice);
                
                this.showMonitorModal(auctionId, auctionTitle, currentBid, retailPrice);
            });
        });
    }
    
    showMonitorModal(auctionId, title, currentBid, retailPrice) {
        // Get modal elements
        const modal = document.getElementById('monitor-auction-modal');
        const titleEl = document.getElementById('monitor-auction-title');
        const currentBidEl = document.getElementById('monitor-current-bid');
        const retailPriceEl = document.getElementById('monitor-retail-price');
        const auctionIdInput = document.getElementById('monitor-auction-id');
        const maxBidInput = document.getElementById('monitor-max-bid');
        const strategySelect = document.getElementById('monitor-strategy');
        
        // Set modal content
        titleEl.textContent = title;
        currentBidEl.textContent = currentBid.toFixed(2);
        retailPriceEl.textContent = retailPrice.toFixed(2);
        auctionIdInput.value = auctionId;
        
        // Suggest a max bid based on user's configured percentage
        const suggestedBid = Math.ceil(retailPrice * this.filters.defaultMaxBidPercentage);
        maxBidInput.value = suggestedBid;
        
        // Show modal
        modal.classList.remove('hidden');
        
        // Focus on max bid input
        setTimeout(() => maxBidInput.focus(), 100);
        
        // Setup modal handlers if not already done
        this.setupMonitorModalHandlers();
    }
    
    setupMonitorModalHandlers() {
        // Only set up once
        if (this.modalHandlersSetup) return;
        this.modalHandlersSetup = true;
        
        const modal = document.getElementById('monitor-auction-modal');
        const backdrop = document.getElementById('monitor-modal-backdrop');
        const cancelBtn = document.getElementById('monitor-cancel-btn');
        const confirmBtn = document.getElementById('monitor-confirm-btn');
        
        // Close modal handlers
        const closeModal = () => {
            modal.classList.add('hidden');
            document.getElementById('monitor-max-bid').value = '';
        };
        
        backdrop.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        
        // Confirm handler
        confirmBtn.addEventListener('click', async () => {
            const auctionId = document.getElementById('monitor-auction-id').value;
            const maxBid = parseFloat(document.getElementById('monitor-max-bid').value);
            const strategy = document.getElementById('monitor-strategy').value;
            
            if (!maxBid || maxBid <= 0) {
                alert('Please enter a valid maximum bid amount');
                return;
            }
            
            try {
                await this.startMonitoringAuction(auctionId, maxBid, strategy);
                closeModal();
            } catch (error) {
                logger.error('Error starting monitoring:', error);
                alert('Failed to start monitoring: ' + error.message);
            }
        });
        
        // Enter key in max bid input
        document.getElementById('monitor-max-bid').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                confirmBtn.click();
            }
        });
    }
    
    async startMonitoringAuction(auctionId, maxBid, strategy) {
        const response = await this.apiCall(`/api/auctions/${auctionId}/monitor`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                config: {
                    maxBid: maxBid,
                    strategy: strategy,
                    enabled: true
                }
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to start monitoring');
        }
        
        const result = await response.json();
        
        // Show success message
        this.showSuccess(`Started monitoring auction. Max bid: $${maxBid}`);
        
        // Update button to show it's being monitored
        const button = document.querySelector(`button[data-auction-id="${auctionId}"]`);
        if (button) {
            button.innerHTML = `
                <svg class="inline-block w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                Monitoring
            `;
            button.classList.remove('bg-green-600', 'hover:bg-green-700');
            button.classList.add('bg-gray-600', 'hover:bg-gray-700', 'cursor-not-allowed');
            button.disabled = true;
        }
    }
    
    showSuccess(message) {
        // Create a temporary success message
        const successDiv = document.createElement('div');
        successDiv.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
        successDiv.textContent = message;
        document.body.appendChild(successDiv);
        
        // Remove after 3 seconds
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }
}

    // Initialize when DOM is ready
    console.log('Setting up Hot Deals initialization...');
    if (document.readyState === 'loading') {
        console.log('Document still loading, waiting for DOMContentLoaded...');
        document.addEventListener('DOMContentLoaded', () => {
            console.log('DOMContentLoaded fired, creating HotDealsManager...');
            window.hotDealsManager = new HotDealsManager();
        });
    } else {
        console.log('Document ready, creating HotDealsManager immediately...');
        window.hotDealsManager = new HotDealsManager();
    }
})();