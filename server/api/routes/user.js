const express = require("express");
const router = express.Router();
const {
  authLimiter,
  passwordResetLimiter,
} = require("../middleware/rateLimiter");
const {
  register,
  login,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  refreshToken,
} = require("../controllers/user");

// Apply rate limiters
router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/password-reset", passwordResetLimiter, requestPasswordReset);
router.post("/password-reset/confirm", passwordResetLimiter, resetPassword);
router.get("/verify-email/:token", verifyEmail);
router.post("/refresh-token", authLimiter, refreshToken);

module.exports = router;
