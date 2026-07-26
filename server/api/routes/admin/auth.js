/**
 * Admin Authentication Routes
 * Dedicated authentication for admin and employee users only
 * Customer/vendor access is explicitly denied
 */

const express = require("express");
const router = express.Router();
const { rateAuth } = require("../../decorators");
const adminAuth = require("../../controllers/admin/auth");

// SSR Routes (Server-Side Rendered for Admin Panel)
router.get("/login", adminAuth.renderLogin);
router.post("/login", ...rateAuth(), adminAuth.postLogin);
router.get("/logout", adminAuth.postLogout);
router.post("/logout", adminAuth.postLogout);

module.exports = router;
