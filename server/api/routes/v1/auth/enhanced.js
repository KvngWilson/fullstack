const express = require("express");
const router = express.Router();
const { passwordResetRoute, authRoute, protect } = require("../../../decorators");
const { enhancedAuth: enhancedAuthController } = require("../../../controllers/v1/auth");

// Public Routes
/**
 * GET /api/v1/auth/verify-email
 * Verify email address with token
 */
router.get(
  "/verify-email",
  enhancedAuthController.verifyEmail
);

/**
 * POST /api/v1/auth/forgot-password
 * Request password reset
 */
router.post(
  "/forgot-password",
  ...passwordResetRoute(require("../../../validators/auth")),
  enhancedAuthController.forgotPassword
);

/**
 * POST /api/v1/auth/reset-password
 * Reset password with token
 */
router.post(
  "/reset-password",
  ...passwordResetRoute(require("../../../validators/auth")),
  enhancedAuthController.resetPassword
);

// Authenticated Routes

/**
 * POST /api/v1/auth/resend-verification
 * Resend email verification
 */
router.post(
  "/resend-verification",
  ...protect(),
  ...authRoute(require("../../../validators/auth")),
  enhancedAuthController.resendEmailVerification
);

/**
 * POST /api/v1/auth/change-password
 * Change password (requires current password)
 */
router.post(
  "/change-password",
  ...protect(),
  enhancedAuthController.changePassword
);

/**
 * GET /api/v1/auth/sessions
 * Get active sessions for current user
 */
router.get(
  "/sessions",
  ...protect(),
  enhancedAuthController.getActiveSessions
);

/**
 * POST /api/v1/auth/logout-all
 * Logout from all devices
 */
router.post(
  "/logout-all",
  ...protect(),
  enhancedAuthController.logoutAll
);

module.exports = router;
