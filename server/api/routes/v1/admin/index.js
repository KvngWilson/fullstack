/**
 * Admin API Routes Index
 * Mounts admin-specific API endpoints under /api/v1/admin
 */

const express = require("express");
const router = express.Router();

// Admin authentication API
router.use("/auth", require("./auth"));
// Admin SSR (server-side rendering) and hydration
router.use("/ssr", require("./ssr"));

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

// Legacy admin management API endpoints migrated from SSR router
router.use("/", require("../../admin/management"));

module.exports = router;
