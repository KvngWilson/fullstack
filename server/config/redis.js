const redis = require("redis");
const { logger } = require("../shared/utils/logger");

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

module.exports = {
  redisClient,
  connectRedis,
};
