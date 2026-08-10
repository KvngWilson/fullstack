/**
 * Cache Service - Unified interface
 * Migrated to use Redis (CacheManager) for distributed caching
 * Maintains backward compatibility with existing CacheService API
 */

const { CacheManager } = require('../infrastructure/cache/CacheManager');

class CacheService {
  /**
   * Get cached value or execute query function
   * @param {string} key - Cache key
   * @param {Function} queryFn - Async function that returns data
   * @param {number} ttl - Time to live in seconds (optional)
   * @returns {Promise} Query result
   */
  static async getCacheable(key, queryFn, ttl = 300) {
    return CacheManager.getOrSet(key, queryFn, ttl);
  }

  /**
   * Invalidate cache entries matching pattern
   * @param {string|RegExp} pattern - Pattern to match keys
   */
  static invalidate(pattern) {
    return CacheManager.invalidatePattern(pattern);
  }

  /**
   * Clear all cache
   */
  static clear() {
    return CacheManager.invalidatePattern('*');
  }

  /**
   * Get cache statistics
   */
  static getStats() {
    return { cached: true, backend: 'redis' };
  }

  /**
   * Cache multiple items
   * @param {Object} items - Key-value pairs
   * @param {number} ttl - Time to live
   */
  static setMultiple(items, ttl = 300) {
    return Promise.all(
      Object.entries(items).map(([key, value]) =>
        CacheManager.set(key, value, ttl)
      )
    );
  }

  /**
   * Get multiple items
   * @param {string[]} keys - Keys to retrieve
   * @returns {Object} Key-value pairs
   */
  static getMultiple(keys) {
    return CacheManager.getMultiple(keys);
  }
}

module.exports = CacheService;
