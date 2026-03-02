const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const setupSwagger = require("../config/swagger");
const vhost = require("vhost");
const yaml = require("js-yaml");

const passport = require("../config/passport");
const {
  errorHandler,
  notFoundHandler,
} = require("../api/middleware/error");
const { csrfProtection } = require("../api/middleware/csrf");
const { payment } = require("../api/controllers/v1/payments");
const { handleStripeWebhook } = payment;
const { applySessionMiddleware } = require("../config/session");
const { getSecurityMiddleware, getCorsOptions } = require("../config/security");
const { correlationIdMiddleware, requestTimingMiddleware } = require("../api/middleware/requestContext");
const { metricsMiddleware, metricsEndpoint } = require("../api/middleware/metrics");
const { 
  healthCheck, 
  detailedHealthCheck, 
  readinessCheck, 
  livenessCheck 
} = require("../api/controllers/health");

const adminRoutes = require("../api/routes/admin");
const authRoutes = require("../api/routes/v1/auth");
const identityRoutes = require("../api/routes/v1/identity");
const catalogRoutes = require("../api/routes/v1/catalog");
const orderingRoutes = require("../api/routes/v1/ordering");
const paymentsRoutes = require("../api/routes/v1/payments");
const vendorRoutes = require("../api/routes/v1/vendor");
const wishlistRoutes = require("../api/routes/v1/wishlist");
const platformRoutes = require("../api/routes/v1/platform");

// Build isolated admin sub-application for vhost mounting
function createAdminApp() {
  const adminApp = express();

  adminApp.set("view engine", "ejs");
  adminApp.set("views", path.join(__dirname, "../views"));

  adminApp.use("/", adminRoutes);
  return adminApp;
}

function registerCoreMiddleware(app) {
  app.set("trust proxy", 1);
  
  // Enhanced security middleware
  const securityMiddleware = getSecurityMiddleware();
  securityMiddleware.forEach(middleware => app.use(middleware));
  
  app.use(cors(getCorsOptions()));
  
  app.use(correlationIdMiddleware);
  app.use(requestTimingMiddleware);
  
  app.use(metricsMiddleware);
  
  app.use(morgan("dev"));

  app.post(
    "/api/v1/ordering/payments/webhook/stripe",
    express.raw({ type: "application/json" }),
    handleStripeWebhook,
  );

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(cookieParser());
}

function registerAppSettings(app) {
  // Setup Swagger/OpenAPI documentation
  setupSwagger(app);
  
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "../views"));
}

function registerRoutes(app) {
  const adminApp = createAdminApp();

  app.use(express.static(path.join(__dirname, "../public")));
  app.use("/uploads", express.static("uploads"));
  app.use(passport.initialize());

  app.get("/health", healthCheck);
  app.get("/health/detailed", detailedHealthCheck);
  app.get("/health/ready", readinessCheck);
  app.get("/health/live", livenessCheck);
  app.get("/metrics", metricsEndpoint);

  app.use(vhost("admin.localhost", adminApp));
  app.use(vhost("admin.*", adminApp));

  // ✅ CSRF protection middleware for all API state-changing requests
  app.use("/api/v1", csrfProtection());

  // Domain-specific routes
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/identity", identityRoutes);
  app.use("/api/v1/catalog", catalogRoutes);
  app.use("/api/v1/ordering", orderingRoutes);
  app.use("/api/v1/payments", paymentsRoutes);
  app.use("/api/v1/vendors", vendorRoutes);
  app.use("/api/v1/wishlist", wishlistRoutes);
  app.use("/api/v1/platform", platformRoutes);
}

// Register terminal middleware last in chain
function registerErrorHandlers(app) {
  app.use(notFoundHandler);
  app.use(errorHandler);
}

function createApp() {
  const app = express();

  registerAppSettings(app);
  registerCoreMiddleware(app);
  applySessionMiddleware(app);
  registerRoutes(app);
  registerErrorHandlers(app);

  return app;
}

module.exports = {
  createApp,
};

// Export app instance for testing
if (process.env.NODE_ENV === 'test') {
  module.exports.app = createApp();
}
