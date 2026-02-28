const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const swaggerUI = require("swagger-ui-express");
const yaml = require("js-yaml");
const vhost = require("vhost");

const passport = require("../config/passport");
const { authenticateJWT } = require("../config/auth");
const {
  errorHandler,
  notFoundHandler,
} = require("../api/middleware/errorHandler");
const { handleStripeWebhook } = require("../api/controllers/payment");
const { applySessionMiddleware } = require("../config/session");

const adminRoutes = require("../api/routes/admin");
const healthRoutes = require("../api/routes/health");
const authRoutes = require("../api/routes/auth");
const userRoutes = require("../api/routes/user");
const employeeRoutes = require("../api/routes/employees");
const productRoutes = require("../api/routes/product");
const cartRoutes = require("../api/routes/cart");
const orderRoutes = require("../api/routes/orders");
const shippingRoutes = require("../api/routes/shipping");
const paymentRoutes = require("../api/routes/payment");
const profileRoutes = require("../api/routes/profile");
const wishlistRoutes = require("../api/routes/wishlist");

function loadSwaggerSpec() {
  const swaggerPath = path.join(__dirname, "../swagger.yml");
  return yaml.load(fs.readFileSync(swaggerPath, "utf8"));
}

function createAdminApp() {
  const adminApp = express();

  adminApp.set("view engine", "ejs");
  adminApp.set("views", path.join(__dirname, "../views"));

  adminApp.use("/", adminRoutes);
  return adminApp;
}

function registerCoreMiddleware(app) {
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors());
  app.use(morgan("dev"));

  app.post(
    "/api/v1/payments/webhook/stripe",
    express.raw({ type: "application/json" }),
    handleStripeWebhook,
  );

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(cookieParser());
}

function registerAppSettings(app) {
  app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(loadSwaggerSpec()));
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "../views"));
}

function registerRoutes(app) {
  const adminApp = createAdminApp();

  app.use(express.static(path.join(__dirname, "../public")));
  app.use("/uploads", express.static("uploads"));
  app.use(passport.initialize());

  app.use(vhost("admin.localhost", adminApp));
  app.use(vhost("admin.*", adminApp));


  app.use("/api/auth", authRoutes);
  app.use("/api/v1/health", healthRoutes);
  app.use("/api/v1/users", userRoutes);
  app.use("/api/v1/employees", employeeRoutes);
  app.use("/api/v1/products", productRoutes);
  app.use("/api/v1/cart", authenticateJWT, cartRoutes);
  app.use("/api/v1/orders", orderRoutes);
  app.use("/api/v1/shipping", authenticateJWT, shippingRoutes);
  app.use("/api/v1/payments", paymentRoutes);
  app.use("/api/v1/profile", profileRoutes);
  app.use("/api/v1/wishlist", wishlistRoutes);
}

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
