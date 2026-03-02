/**
 * Caching decorator utility
 * Provides decorator functions for easy cache integration
 */

/**
 * Higher-order function to add caching to any async function
 * @param {Function} fn - Async function to decorate
 * @param {CacheManager} cacheManager - Cache manager instance
 * @param {string} cacheKey - Cache key prefix
 * @param {number} ttl - Time to live in seconds
 * @returns {Function} - Decorated function
 */
function withCache(fn, cacheManager, cacheKey, ttl = 3600) {
  return async function cachedFn(...args) {
    const key = typeof cacheKey === 'function' 
      ? cacheKey(...args) 
      : `${cacheKey}:${JSON.stringify(args)}`;

    return cacheManager.getOrSet(
      key,
      () => fn.apply(this, args),
      ttl
    );
  };
}

/**
 * Decorator for repository methods that should be cached
 * Usage: @Cacheable('product:${id}', 1800)
 */
function Cacheable(keyGenerator, ttl = 3600) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args) {
      const cacheManager = this.cacheManager;
      const cacheKey = typeof keyGenerator === 'function'
        ? keyGenerator(...args)
        : keyGenerator;

      return cacheManager.getOrSet(
        cacheKey,
        () => originalMethod.apply(this, args),
        ttl
      );
    };

    return descriptor;
  };
}

/**
 * Decorator to invalidate cache after method execution
 * Usage: @CacheInvalidate('product:*')
 */
function CacheInvalidate(pattern) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args) {
      const result = await originalMethod.apply(this, args);
      
      if (this.cacheManager) {
        await this.cacheManager.invalidatePattern(pattern);
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Decorator to invalidate specific cache key after method execution
 * Usage: @InvalidateKey('product:${id}')
 */
function InvalidateKey(keyGenerator) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args) {
      const result = await originalMethod.apply(this, args);
      
      if (this.cacheManager) {
        const cacheKey = typeof keyGenerator === 'function'
          ? keyGenerator(result, ...args)
          : keyGenerator;
        
        await this.cacheManager.delete(cacheKey);
      }

      return result;
    };

    return descriptor;
  };
}

module.exports = {
  withCache,
  Cacheable,
  CacheInvalidate,
  InvalidateKey
};
