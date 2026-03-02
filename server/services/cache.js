/**
 * Query result caching service
 * Caches frequently accessed database queries to reduce load
 */

const NodeCache = require('node-cache');

// Cache configuration
// stdTTL: standard time to live in seconds (5 minutes)
// checkperiod: auto-delete check interval (60 seconds)
const queryCache = new NodeCache({ 
  stdTTL: 300, 
  checkperiod: 60,
  useClones: false // Return object references for performance
});

class CacheService {
  /**
   * Get cached value or execute query function
   * @param {string} key - Cache key
   * @param {Function} queryFn - Async function that returns data
   * @param {number} ttl - Time to live in seconds (optional)
   * @returns {Promise} Query result
   */
  static async getCacheable(key, queryFn, ttl = 300) {
    // Check cache first
    const cached = queryCache.get(key);
    if (cached !== undefined) {
      return Promise.resolve(cached);
    }

    // Execute query if not cached
    try {
      const result = await queryFn();
      queryCache.set(key, result, ttl);
      return result;
    } catch (error) {
      // Don't cache errors
      throw error;
    }
  }

  /**
   * Invalidate cache entries matching pattern
   * @param {string|RegExp} pattern - Pattern to match keys
   */
  static invalidate(pattern) {
    const keys = queryCache.keys();
    const isRegex = pattern instanceof RegExp;

    keys.forEach(key => {
      const matches = isRegex 
        ? pattern.test(key)
        : key.includes(pattern);
      
      if (matches) {
        queryCache.del(key);
      }
    });
  }

  /**
   * Clear all cache
   */
  static clear() {
    queryCache.flushAll();
  }

  /**
   * Get cache statistics
   */
  static getStats() {
    return queryCache.getStats();
  }

  /**
   * Cache multiple items
   * @param {Object} items - Key-value pairs
   * @param {number} ttl - Time to live
   */
  static setMultiple(items, ttl = 300) {
    Object.entries(items).forEach(([key, value]) => {
      queryCache.set(key, value, ttl);
    });
  }

  /**
   * Get multiple items
   * @param {string[]} keys - Keys to retrieve
   * @returns {Object} Key-value pairs
   */
  static getMultiple(keys) {
    const result = {};
    keys.forEach(key => {
      const value = queryCache.get(key);
      if (value !== undefined) {
        result[key] = value;
      }
    });
    return result;
  }
}

module.exports = CacheService;
