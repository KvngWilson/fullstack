class RedisClientMock {
  constructor() {
    this.store = new Map();
    this.ttl = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
    };
    this.callCounts = {
      get: 0,
      set: 0,
      del: 0,
      clear: 0,
    };
  }

  async get(key) {
    this.callCounts.get += 1;

    const expiresAt = this.ttl.get(key);
    if (expiresAt && Date.now() > expiresAt) {
      this.store.delete(key);
      this.ttl.delete(key);
      this.stats.misses += 1;
      return null;
    }

    if (this.store.has(key)) {
      this.stats.hits += 1;
      return this.store.get(key);
    }

    this.stats.misses += 1;
    return null;
  }

  async set(key, value, options = {}) {
    this.callCounts.set += 1;
    this.store.set(key, String(value));

    if (options.EX && Number.isFinite(options.EX)) {
      this.ttl.set(key, Date.now() + options.EX * 1000);
    }

    return 'OK';
  }

  async del(key) {
    this.callCounts.del += 1;
    const existed = this.store.delete(key);
    this.ttl.delete(key);
    return existed ? 1 : 0;
  }

  clear() {
    this.callCounts.clear += 1;
    this.store.clear();
    this.ttl.clear();
    this.stats = {
      hits: 0,
      misses: 0,
    };
  }

  getTTL(key) {
    const expiresAt = this.ttl.get(key);
    if (!expiresAt) {
      return -1;
    }
    const ttlSeconds = Math.floor((expiresAt - Date.now()) / 1000);
    return ttlSeconds > 0 ? ttlSeconds : 0;
  }

  getCallCount(method) {
    return this.callCounts[method] || 0;
  }

  async deleteExpired() {
    const now = Date.now();
    for (const [key, expiresAt] of this.ttl.entries()) {
      if (expiresAt && now > expiresAt) {
        this.ttl.delete(key);
        this.store.delete(key);
      }
    }
  }

  getCacheStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRatio: total === 0 ? 0 : this.stats.hits / total,
    };
  }
}

module.exports = RedisClientMock;
