/**
 * CacheManager - Centralized caching layer
 * Uses Redis for distributed caching with TTL management
 */

class CacheManager {
  constructor(redisClient, logger) {
    this.client = redisClient;
    this.logger = logger;
  }

  /**
   * Get or set cache value
   * @param {string} key - Cache key
   * @param {Function} fetcher - Async function to fetch value if not cached
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<any>} - Cached or fetched value
   */
  async getOrSet(key, fetcher, ttl = 3600) {
    try {
      const cached = await this.client.get(key);
      
      if (cached) {
        this.logger.debug('Cache hit', { key, ttl });
        return JSON.parse(cached);
      }

      this.logger.debug('Cache miss, fetching', { key });
      const value = await fetcher();
      
      await this.client.setEx(key, ttl, JSON.stringify(value));
      return value;
    } catch (error) {
      this.logger.error('Cache error', { key, error: error.message });
      // Graceful degradation: return fresh value if cache fails
      return fetcher();
    }
  }

  /**
   * Cache products with filters
   * @param {object} filters - Product filters
   * @param {Function} fetcher - Repository function
   * @param {number} ttl - TTL in seconds (default 1 hour)
   */
  async getCachedProducts(filters = {}, fetcher, ttl = 3600) {
    const cacheKey = this.generateKey('products', filters);
    return this.getOrSet(cacheKey, fetcher, ttl);
  }

  /**
   * Cache user permissions (high-frequency reads)
   * @param {number} userId - User ID
   * @param {Function} fetcher - Repository function
   * @param {number} ttl - TTL in seconds (default 5 min)
   */
  async getUserPermissions(userId, fetcher, ttl = 300) {
    const cacheKey = `user_permissions:${userId}`;
    return this.getOrSet(cacheKey, fetcher, ttl);
  }

  /**
   * Cache user roles
   * @param {number} userId - User ID
   * @param {Function} fetcher - Repository function
   * @param {number} ttl - TTL in seconds
   */
  async getUserRoles(userId, fetcher, ttl = 600) {
    const cacheKey = `user_roles:${userId}`;
    return this.getOrSet(cacheKey, fetcher, ttl);
  }

  /**
   * Cache tenant configuration
   * @param {number} tenantId - Tenant ID
   * @param {Function} fetcher - Repository function
   * @param {number} ttl - TTL in seconds (default 1 hour)
   */
  async getTenantConfig(tenantId, fetcher, ttl = 3600) {
    const cacheKey = `tenant_config:${tenantId}`;
    return this.getOrSet(cacheKey, fetcher, ttl);
  }

  /**
   * Cache single product
   * @param {number} productId - Product ID
   * @param {Function} fetcher - Repository function
   * @param {number} ttl - TTL in seconds
   */
  async getCachedProduct(productId, fetcher, ttl = 1800) {
    const cacheKey = `product:${productId}`;
    return this.getOrSet(cacheKey, fetcher, ttl);
  }

  /**
   * Cache single order
   * @param {number} orderId - Order ID
   * @param {Function} fetcher - Repository function
   * @param {number} ttl - TTL in seconds (default 10 min)
   */
  async getCachedOrder(orderId, fetcher, ttl = 600) {
    const cacheKey = `order:${orderId}`;
    return this.getOrSet(cacheKey, fetcher, ttl);
  }

  /**
   * Generate cache key from filters
   * @private
   */
  generateKey(namespace, filters = {}) {
    const filterStr = Object.entries(filters)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, val]) => `${key}:${val}`)
      .join('|');
    
    return filterStr ? `${namespace}:${filterStr}` : namespace;
  }

  /**
   * Invalidate cache by key pattern
   * @param {string} pattern - Redis pattern (e.g., 'user_permissions:*')
   */
  async invalidatePattern(pattern) {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
        this.logger.info('Cache invalidated', { pattern, count: keys.length });
      }
    } catch (error) {
      this.logger.error('Cache invalidation failed', { pattern, error: error.message });
    }
  }

  /**
   * Invalidate user permissions
   * @param {number} userId - User ID
   */
  async invalidateUserPermissions(userId) {
    await this.invalidatePattern(`user_permissions:${userId}`);
    await this.invalidatePattern(`user_roles:${userId}`);
  }

  /**
   * Invalidate product caches
   * @param {number} productId - Product ID (optional, invalidates all if not provided)
   */
  async invalidateProducts(productId = null) {
    if (productId) {
      await this.invalidatePattern(`product:${productId}`);
      // Also invalidate product list caches
      await this.invalidatePattern('products:*');
    } else {
      await this.invalidatePattern('products:*');
    }
  }

  /**
   * Invalidate tenant config
   * @param {number} tenantId - Tenant ID
   */
  async invalidateTenantConfig(tenantId) {
    await this.invalidatePattern(`tenant_config:${tenantId}`);
  }

  /**
   * Invalidate order
   * @param {number} orderId - Order ID
   */
  async invalidateOrder(orderId) {
    await this.invalidatePattern(`order:${orderId}`);
  }

  /**
   * Set cache value directly
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - TTL in seconds
   */
  async set(key, value, ttl = 3600) {
    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
      this.logger.debug('Cache set', { key, ttl });
    } catch (error) {
      this.logger.error('Cache set failed', { key, error: error.message });
    }
  }

  /**
   * Get cache value directly
   * @param {string} key - Cache key
   */
  async get(key) {
    try {
      const cached = await this.client.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.error('Cache get failed', { key, error: error.message });
      return null;
    }
  }

  /**
   * Delete cache entry
   * @param {string} key - Cache key
   */
  async delete(key) {
    try {
      await this.client.del(key);
      this.logger.debug('Cache deleted', { key });
    } catch (error) {
      this.logger.error('Cache delete failed', { key, error: error.message });
    }
  }

  /**
   * Clear all cache
   */
  async clear() {
    try {
      await this.client.flushDb();
      this.logger.info('Cache cleared');
    } catch (error) {
      this.logger.error('Cache clear failed', { error: error.message });
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      const info = await this.client.info('stats');
      return info;
    } catch (error) {
      this.logger.error('Cache stats failed', { error: error.message });
      return null;
    }
  }
}

module.exports = CacheManager;
