const path = require("path");
const express = require("express");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const { applySessionMiddleware } = require("../config/session");
const { csrfProtection } = require("../api/middleware/csrf");
const { getSecurityMiddleware, getCorsOptions } = require("../config/security");
const { requestLoggerMiddleware } = require("../shared/utils/logger");
const { correlationIdMiddleware, requestTimingMiddleware } = require("../api/middleware/requestContext");
const { metricsMiddleware, metricsEndpoint } = require("../api/middleware/metrics");
const { errorHandler, notFoundHandler } = require("../api/middleware/error");
const { healthCheck, detailedHealthCheck, readinessCheck, livenessCheck } = require("../api/controllers/health");

const adminRoutes = require("../api/routes/admin");

function createAdminApp() {
  const adminApp = express();

  adminApp.set("trust proxy", 1);

  const securityMiddleware = getSecurityMiddleware();
  securityMiddleware.forEach((middleware) => adminApp.use(middleware));

  adminApp.use(require("cors")(getCorsOptions()));
  adminApp.use(requestLoggerMiddleware);
  adminApp.use(correlationIdMiddleware);
  adminApp.use(requestTimingMiddleware);
  adminApp.use(metricsMiddleware);
  adminApp.use(morgan("dev"));
  adminApp.use(express.json({ limit: "10mb" }));
  adminApp.use(express.urlencoded({ extended: true, limit: "10mb" }));
  adminApp.use(cookieParser());
  adminApp.use(
    express.static(path.join(__dirname, "../public"), {
      maxAge: "1y",
      etag: false,
    }),
  );

  applySessionMiddleware(adminApp, {
    cookieName: "admin_sid",
    cookie: {
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    },
  });

  if (process.env.NODE_ENV !== "test") {
    adminApp.use(
      csrfProtection({
        excludePaths: ["/auth"],
        headerName: "x-admin-csrf-token",
        tokenKeyPrefix: "admin-csrf-token",
      }),
    );
  }

  adminApp.set("view engine", "ejs");
  adminApp.set("views", path.join(__dirname, "../views"));

  adminApp.get("/health", healthCheck);
  adminApp.get("/health/detailed", detailedHealthCheck);
  adminApp.get("/health/ready", readinessCheck);
  adminApp.get("/health/live", livenessCheck);
  adminApp.get("/metrics", metricsEndpoint);
  adminApp.get("/favicon.ico", (_req, res) => res.status(204).end());

  // Expose Bull queues status for admin monitoring
  adminApp.get('/health/jobs', async (req, res) => {
    try {
      const { getJobQueuesRuntime } = require('../infrastructure/jobs/runtime');
      const queuesRuntime = getJobQueuesRuntime();

      if (!queuesRuntime) {
        return res.status(503).json({ 
          status: 'unavailable', 
          message: 'Job queues not initialized' 
        });
      }

      // Get stats from all queues
      const queueStats = {};
      if (queuesRuntime.emailJobQueue) {
        queueStats.email = await queuesRuntime.emailJobQueue.getStats();
      }
      if (queuesRuntime.webhookJobQueue) {
        queueStats.webhooks = await queuesRuntime.webhookJobQueue.getStats();
      }
      if (queuesRuntime.exchangeRateJobQueue) {
        queueStats['exchange-rates'] = await queuesRuntime.exchangeRateJobQueue.getStats();
      }

      res.status(200).json({ 
        status: 'ok', 
        queues: queueStats,
        note: 'Jobs are processed by the Bull worker service. See /health/jobs/queue/{name} for details.'
      });
    } catch (err) {
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  adminApp.use("/", adminRoutes);

  adminApp.use(notFoundHandler);
  adminApp.use(errorHandler);

  return adminApp;
}

module.exports = {
  createAdminApp,
};
