// Simple Redis mock for testing
const EventEmitter = require('events');

class RedisMock extends EventEmitter {
  constructor(url, options) {
    super();
    this.data = new Map();
    this.connected = false;
    
    // Simulate async connection (but only in non-test environment to avoid logging after tests)
    if (process.env.NODE_ENV !== 'test') {
      process.nextTick(() => {
        this.connected = true;
        this.emit('connect');
      });
    } else {
      // Immediate connection in tests to avoid async issues
      this.connected = true;
    }
  }

  async connect() {
    this.connected = true;
    this.emit('connect');
    return this;
  }

  async get(key) {
    return this.data.get(key) || null;
  }

  async set(key, value, options) {
    this.data.set(key, value);
    return 'OK';
  }

  async del(key) {
    return this.data.delete(key) ? 1 : 0;
  }

  async keys(pattern) {
    const allKeys = Array.from(this.data.keys());
    if (pattern === '*') return allKeys;
    
    // Simple pattern matching for "prefix:*"
    const prefix = pattern.replace('*', '');
    return allKeys.filter(key => key.startsWith(prefix));
  }

  async flushall() {
    this.data.clear();
    return 'OK';
  }

  async ping() {
    return 'PONG';
  }

  async quit() {
    this.connected = false;
    this.data.clear();
    return 'OK';
  }

  async lpush(key, ...values) {
    let list = this.data.get(key) || [];
    if (!Array.isArray(list)) list = [];
    list.unshift(...values);
    this.data.set(key, list);
    return list.length;
  }

  async lrange(key, start, stop) {
    const list = this.data.get(key) || [];
    if (!Array.isArray(list)) return [];
    
    // Redis uses -1 as the last element
    if (stop === -1) stop = list.length - 1;
    
    return list.slice(start, stop + 1);
  }

  async ltrim(key, start, stop) {
    const list = this.data.get(key) || [];
    if (!Array.isArray(list)) return 'OK';
    
    if (stop === -1) stop = list.length - 1;
    const trimmed = list.slice(start, stop + 1);
    this.data.set(key, trimmed);
    return 'OK';
  }

  async expire(key, seconds) {
    // Simple mock - just return 1 (success)
    return 1;
  }

  async ttl(key) {
    // Simple mock - return a positive number if key exists
    return this.data.has(key) ? 3600 : -2;
  }

  // Sorted set operations
  async zadd(key, ...args) {
    // Simple implementation - store as array of [score, member] pairs
    let sortedSet = this.data.get(key) || [];
    
    // Parse arguments (score1, member1, score2, member2, ...)
    for (let i = 0; i < args.length; i += 2) {
      const score = parseFloat(args[i]);
      const member = args[i + 1];
      
      // Remove existing member if present
      sortedSet = sortedSet.filter(([_, m]) => m !== member);
      
      // Add new member with score
      sortedSet.push([score, member]);
    }
    
    // Sort by score
    sortedSet.sort((a, b) => a[0] - b[0]);
    
    this.data.set(key, sortedSet);
    return sortedSet.length;
  }

  async zrevrange(key, start, stop, withScores) {
    const sortedSet = this.data.get(key) || [];
    
    // Sort in reverse order (highest score first)
    const reversed = [...sortedSet].sort((a, b) => b[0] - a[0]);
    
    // Handle negative indices
    if (stop === -1) stop = reversed.length - 1;
    
    const slice = reversed.slice(start, stop + 1);
    
    if (withScores === 'WITHSCORES') {
      // Return flat array with scores
      const result = [];
      slice.forEach(([score, member]) => {
        result.push(member);
        result.push(score.toString());
      });
      return result;
    } else {
      // Return just members
      return slice.map(([_, member]) => member);
    }
  }

  async zcard(key) {
    const sortedSet = this.data.get(key) || [];
    return sortedSet.length;
  }

  async zremrangebyrank(key, start, stop) {
    const sortedSet = this.data.get(key) || [];
    
    // Sort by score
    sortedSet.sort((a, b) => a[0] - b[0]);
    
    // Remove elements by rank
    const kept = sortedSet.slice(0, start).concat(sortedSet.slice(stop + 1));
    
    this.data.set(key, kept);
    return sortedSet.length - kept.length;
  }

  // Pipeline support
  pipeline() {
    const commands = [];
    const self = this;
    
    return {
      get(key) {
        commands.push(['get', key]);
        return this;
      },
      
      set(key, value) {
        commands.push(['set', key, value]);
        return this;
      },
      
      del(key) {
        commands.push(['del', key]);
        return this;
      },
      
      async exec() {
        const results = [];
        for (const [cmd, ...args] of commands) {
          try {
            const result = await self[cmd](...args);
            results.push([null, result]);
          } catch (error) {
            results.push([error, null]);
          }
        }
        return results;
      }
    };
  }

}

module.exports = RedisMock;