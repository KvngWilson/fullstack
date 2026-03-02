/**
 * Platform Domain Routes
 * System health checks and platform-level operations
 */

const express = require("express");
const router = express.Router();

const healthRoutes = require("./health");

router.use("/health", healthRoutes);

module.exports = router;
