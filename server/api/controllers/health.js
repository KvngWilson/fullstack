/**
 * Enhanced Health Check System
 * Comprehensive health monitoring for all system dependencies
 */

const { pool } = require("../../config/db");
const { redisClient } = require("../../config/redis");
const logger = require("../../shared/utils/logger");
const { getMetricsSnapshot } = require("../middleware/metrics");

// Check database connectivity

async function checkDatabase() {
  try {
    const start = Date.now();
    await pool.query("SELECT 1");
    const duration = Date.now() - start;

    return {
      status: "healthy",
      latency: `${duration}ms`,
    };
  } catch (error) {
    logger.error("Database health check failed", { error: error.message });
    return {
      status: "unhealthy",
      error: error.message,
    };
  }
}

// Check Redis connectivity (if configured)
async function checkRedis() {
  try {
    // Skip if Redis not configured
    if (!process.env.REDIS_HOST) {
      return {
        status: "not_configured",
      };
    }

    // Check redis client
    if (!redisClient) {
      return { status: "not_initialized" };
    }

    const start = Date.now();
    await redisClient.ping();
    const duration = Date.now() - start;

    return {
      status: "healthy",
      latency: `${duration}ms`,
    };
  } catch (error) {
    logger.error("Redis health check failed", { error: error.message });
    return {
      status: "unhealthy",
      error: error.message,
    };
  }
}

// Get system information
function getSystemInfo() {
  const memUsage = process.memoryUsage();

  return {
    uptime: `${Math.floor(process.uptime())}s`,
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    },
    node_version: process.version,
    environment: process.env.NODE_ENV,
  };
}

// Basic health check endpoint (fast)
async function healthCheck(req, res) {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}

// Detailed health check endpoint (includes all dependencies)
async function detailedHealthCheck(req, res) {
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);

  const allHealthy =
    database.status === "healthy" &&
    (redis.status === "healthy" || redis.status === "not_configured");

  const statusCode = allHealthy ? 200 : 503;
  const status = allHealthy ? "healthy" : "degraded";

  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    system: getSystemInfo(),
    dependencies: {
      database,
      redis,
    },
    metrics: getMetricsSnapshot(),
  });
}

// Readiness check (for Kubernetes/container orchestration)
async function readinessCheck(req, res) {
  const database = await checkDatabase();

  if (database.status === "healthy") {
    res.status(200).json({ status: "ready" });
  } else {
    res
      .status(503)
      .json({ status: "not_ready", reason: "database_unavailable" });
  }
}

// Liveness check (for Kubernetes/container orchestration)
async function livenessCheck(req, res) {
  // Simple check that process is alive
  res.status(200).json({ status: "alive" });
}

module.exports = {
  healthCheck,
  detailedHealthCheck,
  readinessCheck,
  livenessCheck,
  checkDatabase,
  checkRedis,
};
