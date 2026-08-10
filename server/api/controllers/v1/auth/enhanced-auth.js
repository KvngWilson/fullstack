const domain = require("../../../../domain");
const AuthenticationService = domain.identity.services.AuthenticationService;
const { successResponse, errorResponse } = require("../../../../shared/utils/response");
const { logger } = require("../../../../shared/utils/logger");
const { pool } = require("../../../../config/db");

/**
 * Enhanced Authentication Controller
 * Email verification, password reset, and improved token management
 */

/**
 * POST /api/v1/auth/resend-verification
 * Resend email verification
 */
exports.resendEmailVerification = async (req, res) => {
  try {
    const userId = req.user.id;
    const email = req.user.email;

    await AuthenticationService.sendEmailVerification(userId, email);

    return successResponse(res, {
      message: "Verification email sent successfully",
    });
  } catch (error) {
    logger.error("Failed to resend verification email", {
      userId: req.user?.id,
      error: error.message,
    });

    return errorResponse(res, {
      message: error.message || "Failed to send verification email",
      status: 500,
    });
  }
};

/**
 * GET /api/v1/auth/verify-email
 * Verify email with token
 */
exports.verifyEmail = async (req, res) => {
  try {
    const {token} = req.query;

    if (!token) {
      return errorResponse(res, {
        message: "Verification token is required",
        status: 400,
      });
    }

    const result = await AuthenticationService.verifyEmail(token);

    return successResponse(res, {
      data: {
        email: result.email,
        verified: result.verified,
      },
      message: "Email verified successfully",
    });
  } catch (error) {
    logger.error("Email verification failed", {
      error: error.message,
    });

    return errorResponse(res, {
      message: error.message || "Email verification failed",
      status: 400,
    });
  }
};

/**
 * POST /api/v1/auth/forgot-password
 * Request password reset
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    if (!email) {
      return errorResponse(res, {
        message: "Email is required",
        status: 400,
      });
    }

    await AuthenticationService.requestPasswordReset(email, ipAddress);

    // Always return success to prevent email enumeration
    return successResponse(res, {
      message: "If an account exists with that email, a password reset link has been sent",
    });
  } catch (error) {
    logger.error("Password reset request failed", {
      error: error.message,
    });

    return successResponse(res, {
      message: "If an account exists with that email, a password reset link has been sent",
    });
  }
};

/**
 * POST /api/v1/auth/reset-password
 * Reset password with token
 */
exports.resetPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    if (!token || !password) {
      return errorResponse(res, {
        message: "Token and password are required",
        status: 400,
      });
    }

    if (password !== confirmPassword) {
      return errorResponse(res, {
        message: "Passwords do not match",
        status: 400,
      });
    }

    if (password.length < 8) {
      return errorResponse(res, {
        message: "Password must be at least 8 characters",
        status: 400,
      });
    }

    const result = await AuthenticationService.resetPassword(
      token,
      password,
      ipAddress
    );

    return successResponse(res, {
      message: "Password reset successfully. Please login with your new password.",
    });
  } catch (error) {
    logger.error("Password reset failed", {
      error: error.message,
    });

    return errorResponse(res, {
      message: error.message || "Password reset failed",
      status: 400,
    });
  }
};

/**
 * POST /api/v1/auth/change-password
 * Change password (authenticated)
 */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return errorResponse(res, {
        message: "Current password and new password are required",
        status: 400,
      });
    }

    if (newPassword !== confirmPassword) {
      return errorResponse(res, {
        message: "New passwords do not match",
        status: 400,
      });
    }

    if (newPassword.length < 8) {
      return errorResponse(res, {
        message: "Password must be at least 8 characters",
        status: 400,
      });
    }

    // Verify current password
    const userResult = await pool.query(
      "SELECT password_hash FROM users WHERE id = $1",
      [userId]
    );

    if (userResult.rowCount === 0) {
      return errorResponse(res, {
        message: "User not found",
        status: 404,
      });
    }

    const argon2 = require("argon2");
    const isValid = await argon2.verify(
      userResult.rows[0].password_hash,
      currentPassword
    );

    if (!isValid) {
      return errorResponse(res, {
        message: "Current password is incorrect",
        status: 401,
      });
    }

    // Use password reset logic (includes history check)
    const ipAddress = req.ip || req.connection.remoteAddress;

    // Generate temporary token for password change
    const crypto = require("crypto");
    const tempToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(tempToken).digest("hex");

    // Create temporary reset token
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, ip_address)
      VALUES ($1, $2, NOW() + INTERVAL '5 minutes', $3)`,
      [userId, tokenHash, ipAddress]
    );

    // Use reset password function
    await AuthenticationService.resetPassword(tempToken, newPassword, ipAddress);

    return successResponse(res, {
      message: "Password changed successfully",
    });
  } catch (error) {
    logger.error("Password change failed", {
      userId: req.user?.id,
      error: error.message,
    });

    return errorResponse(res, {
      message: error.message || "Password change failed",
      status: 500,
    });
  }
};

/**
 * GET /api/v1/auth/sessions
 * Get active sessions (authenticated)
 */
exports.getActiveSessions = async (req, res) => {
  try {
    const userId = req.user.id;

    const sessions = await AuthenticationService.getActiveSessions(userId);

    return successResponse(res, {
      data: sessions,
      message: "Sessions retrieved successfully",
    });
  } catch (error) {
    logger.error("Failed to fetch sessions", {
      userId: req.user?.id,
      error: error.message,
    });

    return errorResponse(res, {
      message: "Failed to fetch sessions",
      status: 500,
    });
  }
};

/**
 * POST /api/v1/auth/logout-all
 * Logout from all devices (authenticated)
 */
exports.logoutAll = async (req, res) => {
  try {
    const userId = req.user.id;

    const count = await AuthenticationService.revokeAllRefreshTokens(userId, "logout_all");

    return successResponse(res, {
      data: { revokedCount: count },
      message: "Logged out from all devices successfully",
    });
  } catch (error) {
    logger.error("Failed to logout all sessions", {
      userId: req.user?.id,
      error: error.message,
    });

    return errorResponse(res, {
      message: "Failed to logout from all devices",
      status: 500,
    });
  }
};

module.exports = exports;
