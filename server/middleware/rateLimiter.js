const rateLimit = require("express-rate-limit");
const { redisClient } = require("../config/redis");
const RedisStore = require("rate-limit-redis");

// Helper to create rate limiter with Redis store
function createRateLimiter(options) {
  const config = {
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    ...options,
  };

  // Use Redis store if available
  if (redisClient && redisClient.isReady) {
    config.store = new RedisStore({
      client: redisClient,
      prefix: "rl:", // Rate limit prefix
    });
  }

  return rateLimit(config);
}

// Strict rate limiter for authentication endpoints
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    error: "Too many authentication attempts. Please try again later.",
  },
  skipSuccessfulRequests: false,
});

// Very strict limiter for password reset
const passwordResetLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per hour
  message: {
    error: "Too many password reset attempts. Please try again after an hour.",
  },
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Moderate limiter for API endpoints
const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    error: "Too many requests. Please slow down.",
  },
});

// Lenient limiter for general routes
const generalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: {
    error: "Too many requests. Please try again later.",
  },
});

module.exports = {
  authLimiter,
  passwordResetLimiter,
  apiLimiter,
  generalLimiter,
};
