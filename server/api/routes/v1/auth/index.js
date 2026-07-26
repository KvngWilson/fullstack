/**
 * Authentication Routes
 * Aggregates all auth-related routes: traditional, platform, and enhanced
 */

const express = require("express");
const router = express.Router();

const platformAuth = require("./platform");
const enhancedAuth = require("./enhanced");

// Platform-wide unified auth (core endpoints)
router.use("/", platformAuth);

// Enhanced auth features (advanced capabilities)
router.use("/advanced", enhancedAuth);

module.exports = router;
