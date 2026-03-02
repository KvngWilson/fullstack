/**
 * Authentication Routes
 * Aggregates all auth-related routes: traditional, platform, and enhanced
 */

const express = require("express");
const router = express.Router();

const traditionalAuth = require("./traditional");
const platformAuth = require("./platform");
const enhancedAuth = require("./enhanced");

// Traditional session-based auth
router.use("/session", traditionalAuth);

// Platform-wide unified auth (core endpoints)
router.use("/", platformAuth);

// Enhanced auth features (advanced capabilities)
router.use("/advanced", enhancedAuth);

module.exports = router;
