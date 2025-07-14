const Redis = require('ioredis');

async function waitForRedis(timeout = 30000) {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    retryStrategy: () => null, // Don't retry, fail fast
    lazyConnect: true
  });

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      await redis.connect();
      await redis.ping();
      await redis.set('health_check', 'ok');
      await redis.get('health_check');
      await redis.del('health_check');
      await redis.quit();
      return true;
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw new Error(`Redis not ready after ${timeout}ms`);
}

module.exports = { waitForRedis };