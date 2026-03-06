/**
 * Admin API Authentication Routes
 * JSON API for admin/employee authentication
 * Mounted at /api/v1/admin/auth
 */

const express = require("express");
const router = express.Router();
const { rateAuth, protect } = require("../../../decorators");
const adminAuth = require("../../../controllers/v1/auth/admin-auth");

// Admin API login
router.post(
  "/login",
  ...rateAuth(),
  // We could add validation here but login already handles it
  adminAuth.apiAdminLogin,
);

// Admin API logout
router.post("/logout", ...protect(), adminAuth.apiAdminLogout);

module.exports = router;
