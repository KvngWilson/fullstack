const express = require("express");
const { protect, permission } = require("../../../decorators");
const auditLogsControllers = require("../../../controllers/v1/admin/audit-logs");
const adminPolicy = require("../../../../policies/adminPolicy");

const router = express.Router();

/**
 * Admin Audit Logs Routes
 * All routes require authentication and explicit permission checks
 * Audit logs are read-only, no write operations
 */

router.use(...protect());

// GET /api/v1/admin/audit-logs - List audit logs with filters
router.get(
  "/",
  ...permission(adminPolicy.audit.read),
  auditLogsControllers.listAuditLogs,
);

// GET /api/v1/admin/audit-logs/statistics - Get audit statistics
router.get(
  "/statistics",
  ...permission(adminPolicy.audit.read),
  auditLogsControllers.getAuditStatistics,
);

// GET /api/v1/admin/audit-logs/search - Search audit logs
router.get(
  "/search",
  ...permission(adminPolicy.audit.read),
  auditLogsControllers.searchAuditLogs,
);

// GET /api/v1/admin/audit-logs/export - Export audit logs
router.get(
  "/export",
  ...permission(adminPolicy.audit.export),
  auditLogsControllers.exportAuditLogs,
);

// GET /api/v1/admin/audit-logs/:id - Get single audit log entry
router.get(
  "/:id",
  ...permission(adminPolicy.audit.read),
  auditLogsControllers.getAuditLog,
);

module.exports = router;
