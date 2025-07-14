// Health monitoring functionality
const HealthMonitor = {
  refreshInterval: null,
  refreshDelay: 5000, // 5 seconds

  init() {
    this.elements = {
      autoRefreshToggle: document.getElementById('auto-refresh-toggle'),
      lastUpdate: document.getElementById('last-health-update'),
      overallHealthDot: document.getElementById('overall-health-dot'),
      overallHealthText: document.getElementById('overall-health-text'),
      overallHealthMessage: document.getElementById('overall-health-message'),
      healthTableBody: document.getElementById('health-table-body'),
      monitoredAuctionsCount: document.getElementById('monitored-auctions-count'),
      activeAuctionsCount: document.getElementById('active-auctions-count'),
      systemUptime: document.getElementById('system-uptime')
    };

    // Set up event listeners
    this.elements.autoRefreshToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        this.startAutoRefresh();
      } else {
        this.stopAutoRefresh();
      }
    });

    // Initial load
    this.fetchHealth();

    // Start auto-refresh if enabled
    if (this.elements.autoRefreshToggle.checked) {
      this.startAutoRefresh();
    }

    // Listen for page visibility to pause/resume refresh
    document.addEventListener('visibilitychange', () => {
      const healthPage = document.getElementById('health-page');
      if (!healthPage.classList.contains('hidden')) {
        if (document.hidden) {
          this.stopAutoRefresh();
        } else if (this.elements.autoRefreshToggle.checked) {
          this.startAutoRefresh();
        }
      }
    });
  },

  startAutoRefresh() {
    this.stopAutoRefresh(); // Clear any existing interval
    this.refreshInterval = setInterval(() => {
      this.fetchHealth();
    }, this.refreshDelay);
  },

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  },

  async fetchHealth() {
    try {
      const response = await fetch('/health?detailed=true');

      // Parse response even if status is 503 (unhealthy)
      const healthData = await response.json();

      // Update display with the health data
      this.updateHealthDisplay(healthData);

      // Update last refresh time
      this.elements.lastUpdate.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;

    } catch (error) {
      Logger.error('Failed to fetch health data:', error);
      this.showError();
    }
  },

  updateHealthDisplay(data) {
    // Update overall health status
    const overallStatus = this.calculateOverallStatus(data);
    this.updateOverallHealth(overallStatus, data);

    // Update component health table
    this.updateHealthTable(data.checks || {});

    // Update auction stats
    if (data.auctions) {
      this.elements.monitoredAuctionsCount.textContent = data.auctions.monitored || 0;
      this.elements.activeAuctionsCount.textContent = data.auctions.memoryStats?.active || 0;
    }

    // Update uptime
    if (data.uptime) {
      this.elements.systemUptime.textContent = this.formatUptime(data.uptime);
    }
  },

  calculateOverallStatus(data) {
    if (data.status === 'unhealthy') { return 'unhealthy'; }

    // Check individual component statuses
    const checks = data.checks || {};
    const statuses = Object.values(checks).map(check => check.status);

    if (statuses.some(status => status === 'unhealthy')) {
      return 'degraded';
    }

    return 'healthy';
  },

  updateOverallHealth(status, _data) {
    const statusConfig = {
      healthy: {
        dot: 'bg-green-500',
        text: 'Healthy',
        textColor: 'text-green-600 dark:text-green-400',
        message: 'All systems operational'
      },
      degraded: {
        dot: 'bg-yellow-500',
        text: 'Degraded',
        textColor: 'text-yellow-600 dark:text-yellow-400',
        message: 'Some components need attention'
      },
      unhealthy: {
        dot: 'bg-red-500',
        text: 'Unhealthy',
        textColor: 'text-red-600 dark:text-red-400',
        message: 'System issues detected'
      }
    };

    const config = statusConfig[status] || statusConfig.unhealthy;

    // Update dot color
    this.elements.overallHealthDot.className = `w-4 h-4 rounded-full ${config.dot}`;

    // Update text
    this.elements.overallHealthText.textContent = config.text;
    this.elements.overallHealthText.className = `text-lg font-medium ${config.textColor}`;

    // Update message
    this.elements.overallHealthMessage.textContent = config.message;
  },

  updateHealthTable(checks) {
    const tbody = this.elements.healthTableBody;
    tbody.innerHTML = '';

    // Define component display names and order
    const componentOrder = [
      { key: 'memory', name: 'Memory' },
      { key: 'eventLoop', name: 'Event Loop' },
      { key: 'diskSpace', name: 'Disk Space' },
      { key: 'redis', name: 'Redis Database' },
      { key: 'websocket', name: 'WebSocket Server' },
      { key: 'nellis-api', name: 'Nellis API' }
    ];

    componentOrder.forEach(({ key, name }) => {
      const check = checks[key];
      if (check) {
        const row = this.createHealthRow(name, check);
        tbody.appendChild(row);
      }
    });
  },

  createHealthRow(componentName, check) {
    const row = document.createElement('tr');

    // Component name cell
    const nameCell = document.createElement('td');
    nameCell.className = 'px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100';
    nameCell.textContent = componentName;

    // Status cell with color indicator
    const statusCell = document.createElement('td');
    statusCell.className = 'px-6 py-4 whitespace-nowrap';

    const statusBadge = document.createElement('span');
    statusBadge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';

    const statusDot = document.createElement('span');
    statusDot.className = 'w-2 h-2 rounded-full mr-1.5';

    switch (check.status) {
      case 'healthy':
        statusBadge.className += ' bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        statusDot.className += ' bg-green-400';
        break;
      case 'degraded':
        statusBadge.className += ' bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
        statusDot.className += ' bg-yellow-400';
        break;
      case 'unhealthy':
        statusBadge.className += ' bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
        statusDot.className += ' bg-red-400';
        break;
    }

    statusBadge.appendChild(statusDot);
    statusBadge.appendChild(document.createTextNode(check.status));
    statusCell.appendChild(statusBadge);

    // Message cell
    const messageCell = document.createElement('td');
    messageCell.className = 'px-6 py-4 text-sm text-gray-500 dark:text-gray-400';
    messageCell.textContent = check.message || '-';

    // Metrics cell
    const metricsCell = document.createElement('td');
    metricsCell.className = 'px-6 py-4 text-sm text-gray-500 dark:text-gray-400';

    if (check.details) {
      const metrics = [];
      for (const [key, value] of Object.entries(check.details)) {
        if (typeof value !== 'object') {
          metrics.push(`${key}: ${value}`);
        }
      }
      metricsCell.textContent = metrics.join(', ') || '-';
    } else {
      metricsCell.textContent = '-';
    }

    // Response time cell
    const responseTimeCell = document.createElement('td');
    responseTimeCell.className = 'px-6 py-4 text-sm text-gray-500 dark:text-gray-400';
    responseTimeCell.textContent = check.duration !== undefined ? `${check.duration}ms` : '-';

    row.appendChild(nameCell);
    row.appendChild(statusCell);
    row.appendChild(messageCell);
    row.appendChild(metricsCell);
    row.appendChild(responseTimeCell);

    return row;
  },

  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  },

  showError() {
    // Update overall health to show error state
    this.elements.overallHealthDot.className = 'w-4 h-4 rounded-full bg-gray-500';
    this.elements.overallHealthText.textContent = 'Unknown';
    this.elements.overallHealthText.className = 'text-lg font-medium text-gray-600 dark:text-gray-400';
    this.elements.overallHealthMessage.textContent = 'Unable to fetch health data';

    // Clear table
    this.elements.healthTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Unable to fetch health data. Please check backend connection.
                </td>
            </tr>
        `;

    // Clear stats
    this.elements.monitoredAuctionsCount.textContent = '-';
    this.elements.activeAuctionsCount.textContent = '-';
    this.elements.systemUptime.textContent = '-';
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => HealthMonitor.init());
} else {
  HealthMonitor.init();
}

// Export for global access
window.HealthMonitor = HealthMonitor;