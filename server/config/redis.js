const redis = require("redis");
const { logger } = require("../utils/logger");

const redisConfig = {
  socket: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT) || 6379,
  },
  database: parseInt(process.env.REDIS_DB || "0"),
};

// Add password in production
if (process.env.NODE_ENV === "production" || process.env.REDIS_PASSWORD) {
  redisConfig.password = process.env.REDIS_PASSWORD;
}

const redisClient = redis.createClient(redisConfig);

redisClient.on("error", (err) => {
  logger.error("Redis client error", { error: err });
});

redisClient.on("connect", () => {
  logger.info("Redis connected successfully");
});

redisClient.on("ready", () => {
  logger.info("Redis ready to accept commands");
});

// Connection with retry logic
async function connectRedis() {
  try {
    await redisClient.connect();
  } catch (error) {
    logger.error("Failed to connect to Redis", { error });
    if (process.env.NODE_ENV === "production") {
      throw error; // Fail fast in production
    } else {
      logger.warn("Running without Redis in development");
    }
  }
}

/**
 * Cache wrapper with automatic expiration
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Function to fetch data if cache miss
 * @param {number} ttl - Time to live in seconds (default: 5 minutes)
 */
async function getOrSetCache(key, fetchFn, ttl = 300) {
  if (!redisClient.isReady) {
    logger.warn("Redis not ready, bypassing cache");
    return await fetchFn();
  }

  try {
    // Try to get from cache
    const cached = await redisClient.get(key);

    if (cached) {
      return JSON.parse(cached);
    }

    // Cache miss - fetch data
    const data = await fetchFn();

    // Store in cache
    await redisClient.setEx(key, ttl, JSON.stringify(data));

    return data;
  } catch (error) {
    logger.error("Cache error", { error, key });
    // Fallback to fetching data
    return await fetchFn();
  }
}

// Invalidate cache keys matching a pattern
async function invalidateCache(pattern) {
  if (!redisClient.isReady) return;

  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
      logger.info("Cache keys invalidated", {
        count: keys.length,
        pattern,
      });
    }
  } catch (error) {
    logger.error("Cache invalidation error", { error, pattern });
  }
}

module.exports = {
  redisClient,
  connectRedis,
  getOrSetCache,
  invalidateCache,
};
