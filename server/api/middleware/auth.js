/**
 * Authentication Middleware
 *
 * Handles JWT token and session-based authentication
 * Attaches authenticated user to req.user
 */

const jwt = require("jsonwebtoken");
const { pool } = require("../../config/db");
const { logger } = require("../../shared/utils/logger");

/**
 * Authenticate user via JWT token or session
 * Attaches user object to req.user if authenticated
 * Does NOT block request if no auth provided
 */
async function authenticate(req, res, next) {
  try {
    // Try JWT authentication first
    const token = extractToken(req);

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "test-secret");

        // Fetch user from database
        const userId = decoded.id || decoded.userId;
        const result = await pool.query(
          "SELECT id, email, role FROM users WHERE id = $1",
          [userId],
        );

        if (result.rows[0]) {
          req.user = {
            ...result.rows[0],
            is_verified: true,
          };
          req.authMethod = "jwt";
          return next();
        }
      } catch (jwtError) {
        // Invalid token - log but don't fail
        logger.debug("Invalid JWT token", { error: jwtError.message });
      }
    }

    // Try session authentication
    if (req.session && req.session.userId) {
      const result = await pool.query(
        "SELECT id, email, role FROM users WHERE id = $1",
        [req.session.userId],
      );

      if (result.rows[0]) {
        req.user = {
          ...result.rows[0],
          is_verified: true,
        };
        req.authMethod = "session";
        return next();
      }
    }

    // No authentication found - continue without user
    next();
  } catch (error) {
    logger.error("Authentication middleware error", { error: error.message });
    next(); // Continue without authentication
  }
}

// Require authentication - blocks request if not authenticated
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Authentication required",
    });
  }
  next();
}

// Require verified email
function requireVerified(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Authentication required",
    });
  }

  if (!req.user.is_verified) {
    return res.status(403).json({
      success: false,
      error: "Email verification required",
    });
  }

  next();
}

// Optional authentication - attaches user if present, but doesn't require it
// Alias for authenticate for clarity
const optionalAuth = authenticate;

// Extract JWT token from request
// Checks Authorization header and cookies
function extractToken(req) {
  // Check Authorization header (Bearer token)
  if (req.headers.authorization) {
    const parts = req.headers.authorization.split(" ");
    if (parts.length === 2 && parts[0] === "Bearer") {
      return parts[1];
    }
  }

  // Check cookie
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  return null;
}

// Attach user ID to request from various sources
// Useful for logging and tracing
function attachUserId(req, res, next) {
  if (req.user) {
    req.userId = req.user.id;
  } else if (req.session && req.session.userId) {
    req.userId = req.session.userId;
  }
  next();
}

module.exports = {
  authenticate,
  requireAuth,
  requireVerified,
  requireEmployee: requireAuth, // Alias for requireAuth (all employees must be authenticated)
  optionalAuth,
  attachUserId,
  extractToken,
};
