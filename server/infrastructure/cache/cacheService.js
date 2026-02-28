const { redisClient } = require("../../config/redis");
const logger = require("../../utils/logger");

class CacheService {
  constructor() {
    this.defaultTTL = 300; // 5 minutes
  }

  /**
   * Get value from cache
   */
  async get(key) {
    if (!redisClient.isReady) {
      return null;
    }

    try {
      const cached = await redisClient.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error("Cache get error", { error, key });
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key, value, ttl = this.defaultTTL) {
    if (!redisClient.isReady) {
      return false;
    }

    try {
      await redisClient.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error("Cache set error", { error, key });
      return false;
    }
  }

  /**
   * Delete from cache
   */
  async del(key) {
    if (!redisClient.isReady) {
      return false;
    }

    try {
      await redisClient.del(key);
      return true;
    } catch (error) {
      logger.error("Cache delete error", { error, key });
      return false;
    }
  }

  /**
   * Delete by pattern
   */
  async delPattern(pattern) {
    if (!redisClient.isReady) {
      return false;
    }

    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
        logger.info("Cache keys invalidated", {
          count: keys.length,
          pattern,
        });
      }
      return true;
    } catch (error) {
      logger.error("Cache pattern delete error", { error, pattern });
      return false;
    }
  }

  /**
   * Cache wrapper - get or set
   */
  async getOrSet(key, fetchFn, ttl = this.defaultTTL) {
    // Try cache first
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - fetch data
    const data = await fetchFn();

    // Store in cache
    await this.set(key, data, ttl);

    return data;
  }

  /**
   * Cache keys for products
   */
  keys = {
    product: (id) => `product:${id}`,
    productList: (page, category) =>
      `products:page:${page}:cat:${category || "all"}`,
    userCart: (userId) => `cart:user:${userId}`,
    userOrders: (userId, page) => `orders:user:${userId}:page:${page}`,
  };
}

module.exports = new CacheService();
