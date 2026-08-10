/**
 * Caching Decorators
 * 
 * Composable decorators for response caching
 * Wraps caching logic for cleaner route definitions
 */

const { CacheManager } = require('../../infrastructure/cache/CacheManager');

/**
 * Cache response for specified duration
 * @param {Object} options - Caching options
 * @param {number} options.ttl - Time to live in seconds
 * @param {Function} options.keyGenerator - Optional custom key generator
 * @param {boolean} options.skipOnError - Skip caching on error (default: true)
 * @returns {Function[]} Middleware array
 * @example 
 * router.get('/products', 
 *   ...cache({ ttl: 300 }), // 5 minutes
 *   controller.list
 * )
 */
function cache(options = {}) {
  const { 
    ttl = 300, // Default 5 minutes
    keyGenerator = defaultKeyGenerator,
    skipOnError = true 
  } = options;

  return [
    async (req, res, next) => {
      // Generate cache key
      const cacheKey = keyGenerator(req);

      try {
        // Try to get from cache
        const cached = await CacheManager.get(cacheKey);
        
        if (cached) {
          // Cache hit - return cached response
          return res.json({
            success: true,
            data: cached,
            cached: true,
            timestamp: new Date().toISOString(),
          });
        }

        // Cache miss - store original res.json
        const originalJson = res.json.bind(res);
        
        // Override res.json to cache the response
        res.json = function(data) {
          // Only cache successful responses
          if (data.success !== false && res.statusCode < 400) {
            CacheManager.set(cacheKey, data.data || data, ttl)
              .catch(err => {
                console.error('Cache set error:', err);
              });
          }
          
          return originalJson(data);
        };

        next();
      } catch (error) {
        if (skipOnError) {
          // Skip caching on error, continue with request
          next();
        } else {
          next(error);
        }
      }
    }
  ];
}

/**
 * Cache with short TTL (1 minute)
 * @param {Object} options - Additional options
 * @returns {Function[]} Middleware array
 * @example router.get('/products/trending', ...cacheShort(), controller.trending)
 */
function cacheShort(options = {}) {
  return cache({ ...options, ttl: 60 });
}

/**
 * Cache with medium TTL (5 minutes)
 * @param {Object} options - Additional options
 * @returns {Function[]} Middleware array
 * @example router.get('/products', ...cacheMedium(), controller.list)
 */
function cacheMedium(options = {}) {
  return cache({ ...options, ttl: 300 });
}

/**
 * Cache with long TTL (1 hour)
 * @param {Object} options - Additional options
 * @returns {Function[]} Middleware array
 * @example router.get('/categories', ...cacheLong(), controller.list)
 */
function cacheLong(options = {}) {
  return cache({ ...options, ttl: 3600 });
}

/**
 * Cache user-specific data
 * @param {Object} options - Caching options
 * @returns {Function[]} Middleware array
 * @example router.get('/profile', ...protect(), ...cacheUser(), controller.profile)
 */
function cacheUser(options = {}) {
  return cache({
    ...options,
    keyGenerator: (req) => {
      const userId = req.user?.id || 'anonymous';
      return `user:${userId}:${req.path}:${JSON.stringify(req.query)}`;
    },
  });
}

/**
 * Cache with custom key
 * @param {Function} keyGenerator - Function to generate cache key
 * @param {Object} options - Additional caching options
 * @returns {Function[]} Middleware array
 * @example 
 * router.get('/products/:id', 
 *   ...cacheCustom((req) => `product:${req.params.id}`),
 *   controller.get
 * )
 */
function cacheCustom(keyGenerator, options = {}) {
  return cache({ ...options, keyGenerator });
}

/**
 * Invalidate cache on mutation
 * @param {string|Function} pattern - Cache key pattern to invalidate
 * @returns {Function[]} Middleware array
 * @example 
 * router.post('/products', 
 *   ...admin(),
 *   ...invalidate('products:*'),
 *   controller.create
 * )
 */
function invalidate(pattern) {
  return [
    async (req, res, next) => {
      // Store original res.json
      const originalJson = res.json.bind(res);
      
      // Override to invalidate cache after successful response
      res.json = async function(data) {
        if (data.success !== false && res.statusCode < 400) {
          try {
            const keyPattern = typeof pattern === 'function' 
              ? pattern(req, data) 
              : pattern;
            
            await CacheManager.invalidatePattern(keyPattern);
          } catch (error) {
            console.error('Cache invalidation error:', error);
          }
        }
        
        return originalJson(data);
      };

      next();
    }
  ];
}

/**
 * Default cache key generator
 * @param {Object} req - Express request object
 * @returns {string} Cache key
 */
function defaultKeyGenerator(req) {
  const queryString = Object.keys(req.query).length > 0 
    ? ':' + JSON.stringify(req.query) 
    : '';
  return `route:${req.path}${queryString}`;
}

module.exports = {
  cache,
  cacheShort,
  cacheMedium,
  cacheLong,
  cacheUser,
  cacheCustom,
  invalidate,
};
