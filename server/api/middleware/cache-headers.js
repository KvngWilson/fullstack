/**
 * Cache control headers middleware
 * Set appropriate cache headers based on response type
 */

/**
 * Cache headers for static assets (JS, CSS, images)
 * Long cache (1 year) with immutable flag
 */
const staticAssets = (req, res, next) => {
  res.set(
    'Cache-Control',
    'public, max-age=31536000, immutable'
  );
  next();
};

/**
 * Cache headers for API GET responses
 * Public cache for 5 minutes, must revalidate
 */
const apiCache = (req, res, next) => {
  if (req.method === 'GET') {
    res.set(
      'Cache-Control',
      'public, max-age=300, must-revalidate'
    );
  } else {
    // Don't cache mutations
    res.set(
      'Cache-Control',
      'no-store'
    );
  }
  next();
};

/**
 * Cache headers for private/user-specific data
 * Never cache, always validate
 */
const privateData = (req, res, next) => {
  res.set(
    'Cache-Control',
    'private, no-cache, no-store, must-revalidate'
  );
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
};

/**
 * Short cache for frequently updated data
 * Cache for 1 minute
 */
const shortCache = (req, res, next) => {
  if (req.method === 'GET') {
    res.set(
      'Cache-Control',
      'public, max-age=60, must-revalidate'
    );
  } else {
    res.set('Cache-Control', 'no-store');
  }
  next();
};

/**
 * Medium cache for semi-static data
 * Cache for 10 minutes
 */
const mediumCache = (req, res, next) => {
  if (req.method === 'GET') {
    res.set(
      'Cache-Control',
      'public, max-age=600, must-revalidate'
    );
  } else {
    res.set('Cache-Control', 'no-store');
  }
  next();
};

/**
 * ETag support for cache validation
 * Add weak ETag to responses
 */
const etagSupport = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    const crypto = require('crypto');
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex')
      .substring(0, 8);
    
    res.set('ETag', `W/"${hash}"`);
    return originalJson.call(this, data);
  };
  
  next();
};

/**
 * Last-Modified header support
 * Use for conditional requests (If-Modified-Since)
 */
const lastModifiedSupport = (req, res, next) => {
  if (req.method === 'GET') {
    res.set('Last-Modified', new Date().toUTCString());
  }
  next();
};

module.exports = {
  staticAssets,
  apiCache,
  privateData,
  shortCache,
  mediumCache,
  etagSupport,
  lastModifiedSupport,
};
