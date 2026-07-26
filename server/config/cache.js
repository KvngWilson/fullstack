/**
 * Cache Configuration
 * All caching uses Redis (CacheManager) for distributed deployments
 */
module.exports = {
  strategy: 'redis',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
  },
  ttl: {
    permissions: 300,    // 5 minutes
    products: 600,       // 10 minutes
    shipping: 1800,      // 30 minutes
    sessions: 3600,      // 1 hour
    default: 300,
  },
};
