/**
 * Platform-wide Authentication Controller
 * Handles simplified authentication for the entire platform
 * Delegates to Identity domain services
 */

const crypto = require("crypto");
const logger = require("../../../../shared/utils/logger");
const { redisClient } = require("../../../../config/redis");
const AuthTokenManager = require("../../../../infrastructure/security/AuthTokenManager");
const {
  AuthenticationService,
  buildAuthUser,
  createRefreshSession,
  getCookieBaseOptions,
  issueAccessToken,
  loginFromRequest,
  registerFromRequest,
  rotateRefreshSession,
  setAuthCookie,
  setRefreshTokenCookie,
} = require("./shared-auth");

/**
 * Register a new user (platform-wide)
 * POST /api/v1/auth/register
 *
 * Creates new user account and sends verification email
 * If successful, automatically logs in user with httpOnly cookies
 */
const register = async (req, res) => {
  try {
    const result = await registerFromRequest(req, {
      sendVerificationEmail: true,
      onVerificationError: (emailError, user) => {
        logger.error("Failed to send verification email on registration", {
          userId: user.id,
          error: emailError.message,
        });
      },
    });

    // If user just registered, automatically log them in
    if (result.user && !result.alreadyRegistered) {
      const token = issueAccessToken(result.user);
      const refreshToken = await createRefreshSession(result.user.id, req);

      //  Set httpOnly cookies
      setAuthCookie(res, token);
      setRefreshTokenCookie(res, refreshToken);

      // Return user data (not tokens)
      return res.status(201).json({
        success: true,
        message:
          "Registration successful. Please check your email to verify your account.",
        user: await buildAuthUser(result.user),
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Registration successful. Please check your email to verify your account.",
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        error: error.message,
      });
    }

    logger.error("Platform registration error", {
      email: req.body?.email,
      error: error.message,
    });

    return res.status(500).json({
      success: false,
      error: "Registration failed",
    });
  }
};

/**
 * Login user (platform-wide)
 * POST /api/v1/auth/login
 *
 * SECURITY: Token is stored in httpOnly cookie, NOT returned in JSON response
 * to prevent XSS attacks. Frontend must use cookies for authentication.
 */
const login = async (req, res) => {
  try {
    const { user, token } = await loginFromRequest(req);
    const refreshToken = await createRefreshSession(user.id, req);

    //  Set HTTP-only cookies (inaccessible to JavaScript)
    setAuthCookie(res, token);

    // Set refresh token in separate httpOnly cookie
    setRefreshTokenCookie(res, refreshToken);

    //  Return ONLY user data, NOT tokens
    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: await buildAuthUser(user),
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        error: error.message,
      });
    }

    logger.error("Platform login error", {
      email: req.body?.email,
      error: error.message,
    });

    return res.status(500).json({
      success: false,
      error: "Login failed",
    });
  }
};

/**
 * Refresh authentication token (platform-wide)
 * POST /api/v1/auth/refresh-token
 *
 * Gets refresh token from httpOnly cookie, returns new access token in cookie
 * SECURITY: Token is stored in httpOnly cookie, NOT returned in JSON response
 */
const refreshToken = async (req, res) => {
  try {
    //  Get refresh token from httpOnly cookie (not from request body)
    const refresh_token = req.cookies?.refresh_token;
    if (!refresh_token) {
      return res.status(401).json({
        success: false,
        error: "No refresh token found",
      });
    }

    // Validate and rotate refresh token
    const result = await rotateRefreshSession(refresh_token, req);

    // Generate new access token
    const token = issueAccessToken({
      id: result.userId,
      email: result.email,
      role: result.role,
    });

    //  Set new token in httpOnly cookie
    setAuthCookie(res, token);

    //  Set new refresh token in httpOnly cookie
    setRefreshTokenCookie(res, result.newRefreshToken);

    //  Return ONLY user data, NOT tokens
    return res.status(200).json({
      success: true,
      user: await buildAuthUser({
        id: result.userId,
        email: result.email,
        role: result.role,
      }),
    });
  } catch (error) {
    logger.error("Platform refresh token error", {
      error: error.message,
    });

    return res.status(401).json({
      success: false,
      error: "Invalid or expired refresh token",
    });
  }
};

/**
 * Logout user (platform-wide)
 * POST /api/v1/auth/logout
 *
 * Clears httpOnly cookies and revokes refresh token
 */
const logout = async (req, res) => {
  try {
    const tokenManager = new AuthTokenManager();

    // Get access token from cookie or Authorization header
    let accessToken = req.cookies?.token || req.cookies?.access_token;
    if (!accessToken && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        accessToken = parts[1];
      }
    }

    // Blacklist the access token (invalidate all subsequent uses)
    if (accessToken) {
      try {
        await tokenManager.blacklistToken(accessToken);
        logger.info('Access token blacklisted on logout', { userId: req.user?.id });
      } catch (error) {
        logger.warn('Failed to blacklist access token on logout', {
          error: error.message,
        });
        // Continue with logout even if blacklist fails
      }
    }

    // Get refresh token from cookie for revocation
    const refresh_token = req.cookies?.refresh_token;

    // Revoke refresh token
    if (refresh_token) {
      try {
        await AuthenticationService.revokeRefreshToken(refresh_token, "logout");
      } catch (error) {
        logger.warn("Failed to revoke refresh token on logout", {
          error: error.message,
        });
      }
    }

    //  Clear authentication cookies
    res.clearCookie("token", {
      ...getCookieBaseOptions(),
    });

    res.clearCookie("refresh_token", {
      ...getCookieBaseOptions(),
    });

    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    logger.error("Platform logout error", {
      error: error.message,
    });

    return res.status(500).json({
      success: false,
      error: "Logout failed",
    });
  }
};

/**
 * Generate CSRF token (platform-wide)
 * GET /api/v1/auth/csrf-token
 *
 * Returns a new CSRF token that must be included in subsequent state-changing requests
 * in the X-CSRF-Token header. Token is regenerated on each request.
 *
 * Token is stored in Redis with the session ID for validation on subsequent requests.
 */
const getCsrfToken = async (req, res) => {
  try {
    const shouldPersistCsrfState = process.env.NODE_ENV !== "test";

    // Ensure session is initialized and persisted so client receives session cookie
    if (shouldPersistCsrfState && req.session) {
      req.session.csrf_issued_at = Date.now();
      await new Promise((resolve, reject) => {
        req.session.save((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }

    // Generate a cryptographically secure random token
    const csrfToken = crypto.randomBytes(32).toString("hex");

    // Store token in Redis associated with session ID
    // Token expires after 24 hours to match session TTL
    if (shouldPersistCsrfState && req.sessionID) {
      const csrfTokenKey = `csrf-token:${req.sessionID}`;
      const TOKEN_TTL = 24 * 60 * 60; // 24 hours in seconds

      try {
        await redisClient.setEx(csrfTokenKey, TOKEN_TTL, csrfToken);
        logger.debug("CSRF token stored in session", {
          sessionId: req.sessionID.substring(0, 8) + "...",
          tokenPrefix: csrfToken.substring(0, 8) + "...",
        });
      } catch (redisError) {
        logger.warn("Failed to store CSRF token in Redis", {
          error: redisError.message,
          sessionId: req.sessionID.substring(0, 8) + "...",
        });
      }
    }

    res.json({
      success: true,
      token: csrfToken,
    });
  } catch (error) {
    logger.error("CSRF token generation error", {
      error: error.message,
    });

    return res.status(500).json({
      success: false,
      error: "Failed to generate CSRF token",
    });
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getCsrfToken,
};
