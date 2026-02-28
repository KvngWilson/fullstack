const express = require("express");
const router = express.Router();
const { pool } = require("../../config/db");
const { redisClient } = require("../../config/redis");

/**
 * Basic health check
 * GET /health
 */
router.get("/", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Detailed health check
 * GET /health/detailed
 */
router.get("/detailed", async (req, res) => {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {},
  };

  // Check database
  try {
    const start = Date.now();
    await pool.query("SELECT 1");
    health.services.database = {
      status: "ok",
      responseTime: `${Date.now() - start}ms`,
    };
  } catch (error) {
    health.status = "degraded";
    health.services.database = {
      status: "error",
      error: error.message,
    };
  }

  // Check Redis
  try {
    if (redisClient.isReady) {
      const start = Date.now();
      await redisClient.ping();
      health.services.redis = {
        status: "ok",
        responseTime: `${Date.now() - start}ms`,
      };
    } else {
      health.services.redis = {
        status: "disconnected",
      };
    }
  } catch (error) {
    health.status = "degraded";
    health.services.redis = {
      status: "error",
      error: error.message,
    };
  }

  const statusCode = health.status === "ok" ? 200 : 503;
  res.status(statusCode).json(health);
});

module.exports = router;
