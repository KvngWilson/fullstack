const logger = require("../../shared/utils/logger");
const { pool } = require("../../config/db");

/**
 * guestOrAuth() Decorator
 * Allows EITHER authenticated users OR guests with valid token
 * Attaches either req.user (authenticated) or req.guest (guest session) to request
 * 
 * Usage:
 *   router.get("/", ...guestOrAuth(), controller.getData)
 * 
 * Sets one of:
 *   - req.user (from JWT)
 *   - req.guest (from guest token in header/cookie)
 */
function guestOrAuth() {
  const { verifyToken } = require("../../config/auth");
  const { redisClient } = require("../../config/redis");

  const getAuthTokenFromCookies = (cookies = {}) =>
    cookies.token || cookies.authToken || cookies.access_token;

  return [
    async (req, res, next) => {
      try {
        // Try to get JWT from cookie first (authenticated user)
        const token = getAuthTokenFromCookies(req.cookies);

        if (token) {
          // Attempt JWT verification
          try {
            const payload = verifyToken(token);
            const userResult = await pool.query(
              "SELECT id, email, role FROM users WHERE id = $1",
              [payload.userId]
            );

            if (userResult.rows.length > 0) {
              req.user = userResult.rows[0];
              req.isAuthenticated = true;
              return next();
            }
          } catch (jwtError) {
            // JWT invalid, continue to check for guest token
            logger.debug("JWT verification failed, checking for guest token");
          }
        }

        // Try guest token from header or cookie
        const guestToken =
          req.headers["x-guest-token"] || req.cookies?.guestToken;

        if (guestToken) {
          // Validate guest token exists in Redis
          const sessionKey = `guest_session:${guestToken}`;
          const sessionData = await redisClient.get(sessionKey);

          if (sessionData) {
            req.guest = {
              token: guestToken,
              session: JSON.parse(sessionData),
            };
            req.isGuest = true;
            return next();
          } else {
            // Guest token expired or invalid
            logger.warn("Guest token invalid or expired", {
              token: guestToken.substring(0, 8),
            });
          }
        }

        // Neither authenticated nor guest
        // Return 401, but allow OPTIONS requests for CORS
        if (req.method === "OPTIONS") {
          return next();
        }

        return res.status(401).json({
          error: "Unauthorized",
          message: "Please log in or include valid guest token",
        });
      } catch (error) {
        logger.error("guestOrAuth middleware error", { error: error.message });
        return res.status(500).json({
          error: "Authentication error",
        });
      }
    },
  ];
}

/**
 * guestOnly() Decorator
 * Allows ONLY guests (unauthenticated)
 * Useful for guest-specific endpoints like creating guest checkout
 */
function guestOnly() {
  const { redisClient } = require("../../config/redis");

  const getAuthTokenFromCookies = (cookies = {}) =>
    cookies.token || cookies.authToken || cookies.access_token;

  return [
    async (req, res, next) => {
      try {
        // Reject if user is authenticated
        const authToken = getAuthTokenFromCookies(req.cookies);
        if (authToken) {
          const { verifyToken } = require("../../config/auth");
          try {
            verifyToken(authToken);
            return res.status(403).json({
              error: "Forbidden",
              message: "This endpoint is for guests only. Log out first.",
            });
          } catch (error) {
            // Invalid JWT, continue to guest check
          }
        }

        // Require valid guest token
        const guestToken =
          req.headers["x-guest-token"] || req.cookies?.guestToken;

        if (!guestToken) {
          return res.status(401).json({
            error: "Guest token required",
            message: "Please include x-guest-token header or guestToken cookie",
          });
        }

        // Validate guest token in Redis
        const sessionKey = `guest_session:${guestToken}`;
        const sessionData = await redisClient.get(sessionKey);

        if (!sessionData) {
          logger.warn("Guest token invalid or expired", {
            token: guestToken.substring(0, 8),
          });
          return res.status(401).json({
            error: "Invalid guest token",
            message: "Token expired or not found",
          });
        }

        req.guest = {
          token: guestToken,
          session: JSON.parse(sessionData),
        };
        req.isGuest = true;

        next();
      } catch (error) {
        logger.error("guestOnly middleware error", { error: error.message });
        return res.status(500).json({
          error: "Authentication error",
        });
      }
    },
  ];
}

module.exports = {
  guestOrAuth,
  guestOnly,
};
