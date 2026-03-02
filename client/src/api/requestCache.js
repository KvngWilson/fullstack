/**
 * Request Deduplication - Caches pending requests and returns the same promise
 * Prevents duplicate API calls when multiple components request the same data simultaneously
 * 
 * Usage:
 * - GET requests are automatically cached by key
 * - Duplicate requests within cache duration return the same promise
 */

const pendingRequests = new Map();

/**
 * Generate cache key from request config
 */
function getCacheKey(config) {
  if (config.method?.toUpperCase() !== 'GET') {
    return null; // Don't cache non-GET requests
  }

  // Create a stable key from URL and params
  const url = config.url || '';
  const params = JSON.stringify(config.params || {});
  return `${config.method}:${url}:${params}`;
}

/**
 * Request cache interceptor
 */
export const requestCacheInterceptor = {
  request: (config) => {
    const cacheKey = getCacheKey(config);

    if (cacheKey && pendingRequests.has(cacheKey)) {
      // Store original config for response handling
      config._cacheKey = cacheKey;
      config._isCached = true;
      // Return the cached promise
      return Promise.reject(new CachedRequestError(pendingRequests.get(cacheKey)));
    }

    if (cacheKey) {
      // Store this request's promise for deduplication
      const promise = new Promise((resolve) => {
        config._resolveCache = resolve;
      });
      pendingRequests.set(cacheKey, promise);
      config._cacheKey = cacheKey;
    }

    return config;
  },

  response: (response) => {
    const cacheKey = response.config._cacheKey;
    if (cacheKey && pendingRequests.has(cacheKey)) {
      pendingRequests.get(cacheKey)._resolve?.(response);
      pendingRequests.delete(cacheKey);
    }
    return response;
  },

  error: (error) => {
    const cacheKey = error.config?._cacheKey;
    if (cacheKey && pendingRequests.has(cacheKey)) {
      pendingRequests.delete(cacheKey);
    }

    // Check if error is from cache miss
    if (error instanceof CachedRequestError) {
      return error.cachedPromise;
    }

    return Promise.reject(error);
  },
};

/**
 * Custom error for cached requests
 */
class CachedRequestError extends Error {
  constructor(cachedPromise) {
    super('Cached request');
    this.cachedPromise = cachedPromise;
  }
}
