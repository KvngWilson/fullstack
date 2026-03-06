const path = require("path");
const express = require("express");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const { applySessionMiddleware } = require("../config/session");
const { csrfProtection } = require("../api/middleware/csrf");
const { getSecurityMiddleware, getCorsOptions } = require("../config/security");
const { correlationIdMiddleware, requestTimingMiddleware } = require("../api/middleware/requestContext");
const { errorHandler, notFoundHandler } = require("../api/middleware/error");

const adminRoutes = require("../api/routes/admin");

function createAdminApp() {
  const adminApp = express();

  adminApp.set("trust proxy", 1);

  const securityMiddleware = getSecurityMiddleware();
  securityMiddleware.forEach((middleware) => adminApp.use(middleware));

  adminApp.use(require("cors")(getCorsOptions()));
  adminApp.use(correlationIdMiddleware);
  adminApp.use(requestTimingMiddleware);
  adminApp.use(morgan("dev"));
  adminApp.use(express.json({ limit: "10mb" }));
  adminApp.use(express.urlencoded({ extended: true, limit: "10mb" }));
  adminApp.use(cookieParser());

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
  adminApp.use("/", adminRoutes);

  adminApp.use(notFoundHandler);
  adminApp.use(errorHandler);

  return adminApp;
}

module.exports = {
  createAdminApp,
};
