const puppeteer = require('puppeteer');
const { app, server } = require('../server');

describe('Health View UI Tests', () => {
    let browser;
    let page;
    let dashboardServer;
    const dashboardUrl = 'http://localhost:3001';
    const backendUrl = 'http://localhost:3000';

    beforeAll(async () => {
        // Start dashboard server
        dashboardServer = server.listen(3001);
        
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
    });

    afterAll(async () => {
        if (browser) await browser.close();
        if (dashboardServer) {
            await new Promise((resolve) => dashboardServer.close(resolve));
        }
    });

    beforeEach(async () => {
        page = await browser.newPage();
        
        // Set viewport
        await page.setViewport({ width: 1280, height: 800 });
        
        // Enable console log capture
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.error('Browser console error:', msg.text());
            }
        });
    });

    afterEach(async () => {
        if (page) await page.close();
    });

    describe('Health View Navigation', () => {
        it('should navigate to health view when clicking menu item', async () => {
            await page.goto(dashboardUrl);
            
            // Wait for page to load
            await page.waitForSelector('#nav-health');
            
            // Click health navigation item
            await page.click('#nav-health');
            
            // Wait for health page to be visible
            await page.waitForSelector('#health-page:not(.hidden)', { timeout: 5000 });
            
            // Verify URL hash changed
            expect(page.url()).toContain('#health');
            
            // Verify health page is visible
            const healthPageVisible = await page.evaluate(() => {
                const healthPage = document.getElementById('health-page');
                return healthPage && !healthPage.classList.contains('hidden');
            });
            expect(healthPageVisible).toBe(true);
        });

        it('should highlight health nav item when on health page', async () => {
            await page.goto(`${dashboardUrl}/#health`);
            
            await page.waitForSelector('#nav-health');
            
            const isActive = await page.evaluate(() => {
                const navItem = document.getElementById('nav-health');
                return navItem.classList.contains('bg-primary-100') || 
                       navItem.classList.contains('dark:bg-primary-900');
            });
            
            expect(isActive).toBe(true);
        });
    });

    describe('Health Data Display', () => {
        it('should display overall system status', async () => {
            await page.goto(`${dashboardUrl}/#health`);
            
            // Wait for health data to load
            await page.waitForSelector('#overall-health-text', { timeout: 10000 });
            
            // Check overall health status is displayed
            const overallStatus = await page.$eval('#overall-health-text', el => el.textContent);
            expect(['Healthy', 'Degraded', 'Unhealthy', 'Unknown']).toContain(overallStatus);
            
            // Check status indicator dot exists
            const dotExists = await page.$('#overall-health-dot') !== null;
            expect(dotExists).toBe(true);
            
            // Check status message exists
            const message = await page.$eval('#overall-health-message', el => el.textContent);
            expect(message).toBeTruthy();
        });

        it('should display component health table', async () => {
            await page.goto(`${dashboardUrl}/#health`);
            
            // Wait for table to populate
            await page.waitForSelector('#health-table-body tr', { timeout: 10000 });
            
            // Get all table rows
            const rows = await page.$$eval('#health-table-body tr', rows => 
                rows.map(row => {
                    const cells = row.querySelectorAll('td');
                    return {
                        component: cells[0]?.textContent || '',
                        status: cells[1]?.textContent || '',
                        message: cells[2]?.textContent || '',
                        metrics: cells[3]?.textContent || '',
                        responseTime: cells[4]?.textContent || ''
                    };
                })
            );
            
            // Should have at least some components
            expect(rows.length).toBeGreaterThan(0);
            
            // Check expected components are present
            const componentNames = rows.map(r => r.component);
            expect(componentNames).toContain('Memory');
            expect(componentNames).toContain('Redis Database');
            expect(componentNames).toContain('WebSocket Server');
            
            // Each row should have status
            rows.forEach(row => {
                expect(['healthy', 'degraded', 'unhealthy']).toContain(row.status.toLowerCase());
            });
        });

        it('should display auction monitoring stats', async () => {
            await page.goto(`${dashboardUrl}/#health`);
            
            // Wait for stats to load
            await page.waitForSelector('#monitored-auctions-count', { timeout: 10000 });
            
            // Check monitored auctions count
            const monitoredCount = await page.$eval('#monitored-auctions-count', el => el.textContent);
            expect(monitoredCount).toMatch(/^\d+$|^-$/);
            
            // Check active auctions count
            const activeCount = await page.$eval('#active-auctions-count', el => el.textContent);
            expect(activeCount).toMatch(/^\d+$|^-$/);
            
            // Check system uptime
            const uptime = await page.$eval('#system-uptime', el => el.textContent);
            expect(uptime).toMatch(/^\d+[dhm]|^-$/);
        });
    });

    describe('Auto-refresh Functionality', () => {
        it('should have auto-refresh enabled by default', async () => {
            await page.goto(`${dashboardUrl}/#health`);
            
            const isChecked = await page.$eval('#auto-refresh-toggle', el => el.checked);
            expect(isChecked).toBe(true);
        });

        it('should update last refresh time', async () => {
            await page.goto(`${dashboardUrl}/#health`);
            
            // Wait for initial update
            await page.waitForFunction(
                () => document.getElementById('last-health-update').textContent.includes('Last updated:'),
                { timeout: 10000 }
            );
            
            const firstUpdate = await page.$eval('#last-health-update', el => el.textContent);
            
            // Wait for auto-refresh (5 seconds)
            await page.waitForTimeout(6000);
            
            const secondUpdate = await page.$eval('#last-health-update', el => el.textContent);
            
            expect(firstUpdate).not.toBe(secondUpdate);
        });

        it('should toggle auto-refresh', async () => {
            await page.goto(`${dashboardUrl}/#health`);
            
            // Get initial state
            const initialChecked = await page.$eval('#auto-refresh-toggle', el => el.checked);
            
            // Click toggle
            await page.click('label[for="auto-refresh-toggle"]');
            
            // Verify state changed
            const afterChecked = await page.$eval('#auto-refresh-toggle', el => el.checked);
            expect(afterChecked).toBe(!initialChecked);
        });
    });

    describe('Error Handling', () => {
        it('should display error state when backend is unavailable', async () => {
            // Mock fetch to simulate backend error
            await page.evaluateOnNewDocument(() => {
                window.fetch = () => Promise.reject(new Error('Network error'));
            });
            
            await page.goto(`${dashboardUrl}/#health`);
            
            // Wait for error state
            await page.waitForFunction(
                () => {
                    const statusText = document.getElementById('overall-health-text').textContent;
                    return statusText === 'Unknown';
                },
                { timeout: 10000 }
            );
            
            // Check error message
            const message = await page.$eval('#overall-health-message', el => el.textContent);
            expect(message).toContain('Unable to fetch health data');
            
            // Check table shows error
            const tableContent = await page.$eval('#health-table-body', el => el.textContent);
            expect(tableContent).toContain('Unable to fetch health data');
        });
    });

    describe('Responsive Design', () => {
        it('should display correctly on mobile', async () => {
            // Set mobile viewport
            await page.setViewport({ width: 375, height: 667 });
            
            await page.goto(`${dashboardUrl}/#health`);
            
            // Stats should stack vertically on mobile
            const statsGrid = await page.$eval('.grid.grid-cols-1.md\\:grid-cols-3', el => {
                const computed = window.getComputedStyle(el);
                return computed.gridTemplateColumns;
            });
            
            // On mobile, should be single column
            expect(statsGrid).toContain('1fr');
        });

        it('should display correctly on desktop', async () => {
            // Set desktop viewport
            await page.setViewport({ width: 1920, height: 1080 });
            
            await page.goto(`${dashboardUrl}/#health`);
            
            // Stats should be in 3 columns on desktop
            const statsGrid = await page.$eval('.grid.grid-cols-1.md\\:grid-cols-3', el => {
                const computed = window.getComputedStyle(el);
                return computed.gridTemplateColumns;
            });
            
            // On desktop, should show multiple columns
            expect(statsGrid).not.toBe('1fr');
        });
    });

    describe('Color Indicators', () => {
        it('should use correct colors for health status', async () => {
            await page.goto(`${dashboardUrl}/#health`);
            
            // Wait for health data
            await page.waitForSelector('#overall-health-dot', { timeout: 10000 });
            
            // Get dot color class
            const dotClass = await page.$eval('#overall-health-dot', el => el.className);
            
            // Should have one of the expected color classes
            const hasValidColor = dotClass.includes('bg-green-500') || 
                                dotClass.includes('bg-yellow-500') || 
                                dotClass.includes('bg-red-500') || 
                                dotClass.includes('bg-gray-500');
            
            expect(hasValidColor).toBe(true);
        });

        it('should show status badges with correct colors in table', async () => {
            await page.goto(`${dashboardUrl}/#health`);
            
            // Wait for table rows
            await page.waitForSelector('#health-table-body tr', { timeout: 10000 });
            
            // Check status badges
            const badges = await page.$$eval('#health-table-body .rounded-full', badges => 
                badges.map(badge => ({
                    text: badge.textContent.trim(),
                    classes: badge.className
                }))
            );
            
            badges.forEach(badge => {
                if (badge.text === 'healthy') {
                    expect(badge.classes).toContain('bg-green-100');
                } else if (badge.text === 'degraded') {
                    expect(badge.classes).toContain('bg-yellow-100');
                } else if (badge.text === 'unhealthy') {
                    expect(badge.classes).toContain('bg-red-100');
                }
            });
        });
    });
});