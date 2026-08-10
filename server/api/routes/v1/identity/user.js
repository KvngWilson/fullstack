const express = require("express");
const router = express.Router();
const { 
  authRoute, 
  passwordResetRoute 
} = require("../../../decorators");
const {
  validateRegister,
  validateLogin,
  validateRefreshToken,
} = require("../../../validators/auth");
const { user } = require("../../../controllers/v1/identity");
const {
  register,
  login,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  refreshToken,
} = user;

// Apply rate limiters and validators
router.post("/register", ...authRoute(validateRegister), register);
router.post("/login", ...authRoute(validateLogin), login);
router.post("/password-reset", ...passwordResetRoute(validateRegister), requestPasswordReset);
router.post("/password-reset/confirm", ...passwordResetRoute(validateLogin), resetPassword);
router.get("/verify-email/:token", verifyEmail);
router.post("/refresh-token", ...authRoute(validateRefreshToken), refreshToken);

module.exports = router;
