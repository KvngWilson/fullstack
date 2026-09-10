/**
 * CSRF Protection Middleware
 *
 * Validates CSRF token on state-changing requests (POST, PUT, PATCH, DELETE)
 * Tokens are provided by frontend in X-CSRF-Token header
 *
 * Tokens are validated against session-stored values in Redis.
 * Supports fallback to format-only validation if Redis is unavailable.
 */

const logger = require("../../shared/utils/logger");
const { redisClient } = require("../../config/redis");

// CSRF middleware options
const DEFAULT_EXCLUDE_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/refresh-token",
  "/auth/csrf-token",
  "/auth/verify-email",
  "/auth/forgot-password",
  "/auth/reset-password",
];

/**
 * CSRF token validation middleware
 *
 * Validates CSRF token on POST, PUT, PATCH, DELETE requests
 * Skips validation for whitelisted paths
 */
const csrfProtection = (options = {}) => {
  const {
    excludePaths = DEFAULT_EXCLUDE_PATHS,
    headerName = "x-csrf-token",
    tokenKeyPrefix = "csrf-token",
  } = options;

  return async (req, res, next) => {
    // Only validate state-changing requests
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      return next();
    }

    // Skip validation for whitelisted paths
    if (excludePaths.some((path) => req.path.startsWith(path))) {
      return next();
    }

    // Get CSRF token from header
    const csrfToken = req.headers[headerName.toLowerCase()];

    if (!csrfToken) {
      logger.warn("CSRF token missing", {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      return res.status(403).json({
        success: false,
        error: "CSRF token missing",
      });
    }

    // Token validation: verify against session-stored token in Redis
    const TOKEN_REGEX = /^[a-f0-9]{64}$/;

    // First: Validate token format
    if (!TOKEN_REGEX.test(csrfToken)) {
      logger.warn("Invalid CSRF token format", {
        method: req.method,
        path: req.path,
        token: csrfToken.substring(0, 8) + "...",
        ip: req.ip,
      });

      return res.status(403).json({
        success: false,
        error: "Invalid CSRF token format",
      });
    }

    // Second: Verify token against session-stored value in Redis
    try {
      const csrfTokenKey = `${tokenKeyPrefix}:${req.sessionID}`;
      const storedToken = await redisClient.get(csrfTokenKey);

      if (!storedToken) {
        logger.warn("CSRF token not found in session store", {
          method: req.method,
          path: req.path,
          sessionId: req.sessionID.substring(0, 8) + "...",
          ip: req.ip,
        });

        return res.status(403).json({
          success: false,
          error: "CSRF token expired or invalid",
        });
      }

      if (storedToken !== csrfToken) {
        logger.warn("CSRF token mismatch", {
          method: req.method,
          path: req.path,
          sessionId: req.sessionID.substring(0, 8) + "...",
          ip: req.ip,
        });

        return res.status(403).json({
          success: false,
          error: "CSRF token invalid",
        });
      }

      // Optional: Delete token after validation to prevent replay attacks
      // Disabled by default to allow single-use requirement override via querystring
      const SINGLE_USE_TOKENS = process.env.CSRF_SINGLE_USE === "true";
      if (SINGLE_USE_TOKENS) {
        await redisClient.del(csrfTokenKey);
        logger.debug("CSRF token invalidated after use", {
          sessionId: req.sessionID.substring(0, 8) + "...",
        });
      }

      logger.debug("CSRF token validated successfully", {
        method: req.method,
        path: req.path,
        sessionId: req.sessionID.substring(0, 8) + "...",
      });

      next();
    } catch (error) {
      logger.error("CSRF token validation error", {
        error: error.message,
        method: req.method,
        path: req.path,
        sessionId: req.sessionID.substring(0, 8) + "...",
      });

      return res.status(500).json({
        success: false,
        error: "CSRF token validation failed",
      });
    }
  };
};

/**
 * Add CSRF token to response headers (optional)
 * Allows frontend to use token for subsequent requests
 */
const provideCsrfToken = (req, res, next) => {
  // Set header indicating CSRF token endpoint is available
  res.setHeader("X-CSRF-Token-Endpoint", "/api/v1/auth/csrf-token");
  next();
};

module.exports = {
  csrfProtection,
  provideCsrfToken,
};
