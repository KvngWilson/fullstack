/**
 * Admin Authentication Routes
 * Dedicated authentication for admin and employee users only
 * Customer/vendor access is explicitly denied
 */

const express = require("express");
const router = express.Router();
const { rateAuth } = require("../../decorators");
const adminAuth = require("../../controllers/v1/auth/admin-auth");

// SSR Routes (Server-Side Rendered for Admin Panel)
router.get("/login", adminAuth.renderAdminLogin);
router.post("/login", ...rateAuth(), adminAuth.postAdminLogin);
router.post("/logout", adminAuth.postAdminLogout);

module.exports = router;
