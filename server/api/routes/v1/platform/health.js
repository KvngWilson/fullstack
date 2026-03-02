const express = require("express");
const router = express.Router();
const {
  healthCheck,
  detailedHealthCheck,
  readinessCheck,
  livenessCheck,
} = require("../../../controllers/health");

/**
 * Basic health check
 * GET /
 */
router.get("/", (req, res) => {
  return healthCheck(req, res);
});

/**
 * Detailed health check
 * GET /detailed
 */
router.get("/detailed", detailedHealthCheck);

/**
 * Readiness check
 * GET /ready
 */
router.get("/ready", readinessCheck);

/**
 * Liveness check
 * GET /live
 */
router.get("/live", livenessCheck);

module.exports = router;
