/**
 * Enhanced Health Check System
 * Provides comprehensive health status for production monitoring
 * 
 * Now includes independent health storage to survive Redis failures
 */

const os = require('os');
const logger = require('./logger');
const healthStorage = require('../services/healthStorage');

class HealthChecker {
  constructor() {
    this.checks = new Map();
    this.startTime = Date.now();
    
    // Register default checks
    this.registerCheck('memory', this.checkMemory.bind(this));
    this.registerCheck('eventLoop', this.checkEventLoop.bind(this));
    this.registerCheck('diskSpace', this.checkDiskSpace.bind(this));
  }
  
  /**
   * Register a health check
   * @param {string} name - Check name
   * @param {Function} checkFn - Async function that returns { status, message, details }
   */
  registerCheck(name, checkFn) {
    this.checks.set(name, checkFn);
  }
  
  /**
   * Run all health checks
   * @param {boolean} detailed - Include detailed information
   * @returns {Object} Health status
   */
  async getHealth(detailed = false) {
    const results = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks: {}
    };
    
    // Run all checks in parallel
    const checkPromises = Array.from(this.checks.entries()).map(async ([name, checkFn]) => {
      try {
        const startTime = Date.now();
        const result = await checkFn();
        const duration = Date.now() - startTime;
        
        return {
          name,
          status: result.status || 'healthy',
          message: result.message || 'OK',
          duration,
          details: detailed ? result.details : undefined
        };
      } catch (error) {
        logger.error(`Health check failed: ${name}`, { error: error.message });
        return {
          name,
          status: 'unhealthy',
          message: error.message,
          duration: 0
        };
      }
    });
    
    const checkResults = await Promise.all(checkPromises);
    
    // Aggregate results
    let overallStatus = 'healthy';
    for (const check of checkResults) {
      results.checks[check.name] = check;
      
      if (check.status === 'unhealthy') {
        overallStatus = 'unhealthy';
      } else if (check.status === 'degraded' && overallStatus === 'healthy') {
        overallStatus = 'degraded';
      }
    }
    
    results.status = overallStatus;
    
    // Store health check result in independent storage
    try {
      await healthStorage.addHealthCheck(results);
    } catch (error) {
      // Don't fail health check if storage fails
      logger.debug('Failed to store health check result:', error);
    }
    
    return results;
  }
  
  /**
   * Check memory usage
   */
  async checkMemory() {
    const memUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(memUsage.rss / 1024 / 1024);
    
    // Check if we're approaching the 256MB limit
    let status = 'healthy';
    let message = `Heap: ${heapUsedMB}MB/${heapTotalMB}MB, RSS: ${rssMB}MB`;
    
    if (rssMB > 200) {
      status = 'degraded';
      message = `High memory usage: ${rssMB}MB (approaching 256MB limit)`;
    } else if (rssMB > 240) {
      status = 'unhealthy';
      message = `Critical memory usage: ${rssMB}MB (exceeds safe threshold)`;
    }
    
    return {
      status,
      message,
      details: {
        heap: {
          used: heapUsedMB,
          total: heapTotalMB,
          percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
        },
        rss: rssMB,
        system: {
          total: Math.round(totalMemory / 1024 / 1024),
          free: Math.round(freeMemory / 1024 / 1024),
          percentage: Math.round((1 - freeMemory / totalMemory) * 100)
        }
      }
    };
  }
  
  /**
   * Check event loop lag
   */
  async checkEventLoop() {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      
      setImmediate(() => {
        const end = process.hrtime.bigint();
        const lagMs = Number(end - start) / 1000000; // Convert to milliseconds
        
        let status = 'healthy';
        let message = `Event loop lag: ${lagMs.toFixed(2)}ms`;
        
        if (lagMs > 100) {
          status = 'degraded';
          message = `High event loop lag: ${lagMs.toFixed(2)}ms`;
        } else if (lagMs > 500) {
          status = 'unhealthy';
          message = `Critical event loop lag: ${lagMs.toFixed(2)}ms`;
        }
        
        resolve({
          status,
          message,
          details: {
            lagMs: lagMs.toFixed(2),
            threshold: {
              warning: 100,
              critical: 500
            }
          }
        });
      });
    });
  }
  
  /**
   * Check disk space for logs
   */
  async checkDiskSpace() {
    try {
      const { promisify } = require('util');
      const { exec } = require('child_process');
      const execAsync = promisify(exec);
      
      // Check disk space for the logs directory
      const { stdout } = await execAsync('df -h /app/logs 2>/dev/null || df -h .');
      const lines = stdout.trim().split('\n');
      
      if (lines.length < 2) {
        return {
          status: 'degraded',
          message: 'Unable to determine disk space'
        };
      }
      
      const diskInfo = lines[1].split(/\s+/);
      const usePercentage = parseInt(diskInfo[4].replace('%', ''));
      
      let status = 'healthy';
      let message = `Disk usage: ${diskInfo[4]} (${diskInfo[3]} available)`;
      
      if (usePercentage > 80) {
        status = 'degraded';
        message = `High disk usage: ${diskInfo[4]} (${diskInfo[3]} available)`;
      } else if (usePercentage > 90) {
        status = 'unhealthy';
        message = `Critical disk usage: ${diskInfo[4]} (${diskInfo[3]} available)`;
      }
      
      return {
        status,
        message,
        details: {
          filesystem: diskInfo[0],
          size: diskInfo[1],
          used: diskInfo[2],
          available: diskInfo[3],
          usePercentage
        }
      };
    } catch (error) {
      return {
        status: 'degraded',
        message: 'Unable to check disk space',
        details: { error: error.message }
      };
    }
  }
  
  /**
   * Create a simple health check (for load balancers)
   */
  async getSimpleHealth() {
    const health = await this.getHealth(false);
    return {
      status: health.status,
      timestamp: health.timestamp
    };
  }
  
  /**
   * Get readiness status (for k8s-style deployments)
   */
  async getReadiness() {
    // Check if critical services are ready
    const checks = ['redis', 'websocket'];
    const results = await Promise.all(
      checks.map(async (name) => {
        const checkFn = this.checks.get(name);
        if (!checkFn) return { status: 'healthy' };
        
        try {
          const result = await checkFn();
          return result;
        } catch (error) {
          return { status: 'unhealthy' };
        }
      })
    );
    
    const isReady = results.every(r => r.status !== 'unhealthy');
    
    return {
      ready: isReady,
      timestamp: new Date().toISOString(),
      checks: results.length
    };
  }
  
  /**
   * Get liveness status (for k8s-style deployments)
   */
  async getLiveness() {
    // Simple check that the process is responsive
    return {
      alive: true,
      timestamp: new Date().toISOString(),
      pid: process.pid,
      uptime: Math.floor((Date.now() - this.startTime) / 1000)
    };
  }
}

// Create singleton instance
const healthChecker = new HealthChecker();

module.exports = healthChecker;