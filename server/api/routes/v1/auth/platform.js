/**
 * Platform-wide Authentication Routes
 * Simplified authentication endpoints for the entire platform
 * These delegate to the Identity domain services
 */

const express = require("express");
const router = express.Router();
const {
  authRoute,
  passwordResetRoute,
  protect,
} = require("../../../decorators");
const {
  validateRegister,
  validateLogin,
  validateRefreshToken,
  validateForgotPassword,
  validateResetPassword,
} = require("../../../validators/auth");
const {
  authPlatform,
  enhancedAuth: enhancedAuthController,
} = require("../../../controllers/v1/auth");
const { register, login, refreshToken, logout, getCsrfToken } = authPlatform;

// Public Authentication Endpoints
// CSRF protection
router.get("/csrf-token", getCsrfToken);

// Core authentication
router.post("/register", ...authRoute(validateRegister), register);
router.post("/login", ...authRoute(validateLogin), login);
router.post("/refresh-token", ...authRoute(validateRefreshToken), refreshToken);

// Email verification
router.get("/verify-email", enhancedAuthController.verifyEmail);

// Password reset
router.post(
  "/forgot-password",
  ...passwordResetRoute(validateForgotPassword),
  enhancedAuthController.forgotPassword,
);
router.post(
  "/reset-password",
  ...passwordResetRoute(validateResetPassword),
  enhancedAuthController.resetPassword,
);

// Authenticated Endpoints
// Logout
router.post("/logout", ...protect(), logout);

// Password changes
router.post(
  "/change-password",
  ...protect(),
  enhancedAuthController.changePassword,
);

// Session management
router.get("/sessions", ...protect(), enhancedAuthController.getActiveSessions);
router.post("/logout-all", ...protect(), enhancedAuthController.logoutAll);

module.exports = router;
