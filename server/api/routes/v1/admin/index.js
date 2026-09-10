/**
 * Admin API Routes Index
 * Mounts admin-specific API endpoints under /api/v1/admin
 */

const express = require("express");
const router = express.Router();

// Admin authentication API
router.use("/auth", require("./auth"));

// Dashboard and profile summary
router.use("/dashboard", require("./dashboard"));

// Marketplace user management
router.use("/users", require("./users"));

// Order operations
router.use("/orders", require("./orders"));

// Employee management
router.use("/employees", require("./employees"));

// Role management
router.use("/roles", require("./roles"));

// Permission management
router.use("/permissions", require("./permissions"));

// Exchange rates management
router.use("/exchange-rates", require("./exchange-rates"));

// Translations management
router.use("/translations", require("./translations"));

// Audit logs (read-only)
router.use("/audit-logs", require("./audit-logs"));

// Background jobs management
router.use("/jobs", require("./jobs"));

// Admin asset uploads
router.use("/uploads", require("./uploads"));

// Admin product management helpers
router.use("/products", require("./products"));

module.exports = router;
