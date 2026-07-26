const express = require("express");
const { protect, permission } = require("../../../decorators");
const permissionsControllers = require("../../../controllers/v1/admin/permissions");
const PERMISSIONS = require("../../../../shared/constants/permissions");

const router = express.Router();

/**
 * Admin Permissions Management Routes
 * All routes require authentication and explicit permission checks
 */

router.use(...protect());

// GET /api/v1/admin/permissions - List all permissions
router.get(
  "/",
  ...permission(PERMISSIONS.ADMIN.PERMISSIONS.READ),
  permissionsControllers.listPermissions,
);

// GET /api/v1/admin/permissions/matrix - Get permission matrix (roles x permissions)
router.get(
  "/matrix",
  ...permission(PERMISSIONS.ADMIN.PERMISSIONS.READ),
  permissionsControllers.getPermissionMatrix,
);

// GET /api/v1/admin/permissions/categories - Get permission categories
router.get(
  "/categories",
  ...permission(PERMISSIONS.ADMIN.PERMISSIONS.READ),
  permissionsControllers.getPermissionsByCategory,
);

// POST /api/v1/admin/permissions - Create new permission
router.post(
  "/",
  ...permission(PERMISSIONS.ADMIN.PERMISSIONS.CREATE),
  permissionsControllers.createPermission,
);

// GET /api/v1/admin/permissions/:id - Get permission details
router.get(
  "/:id",
  ...permission(PERMISSIONS.ADMIN.PERMISSIONS.READ),
  permissionsControllers.getPermission,
);

// PUT /api/v1/admin/permissions/:id - Update permission
router.put(
  "/:id",
  ...permission(PERMISSIONS.ADMIN.PERMISSIONS.UPDATE),
  permissionsControllers.updatePermission,
);

// DELETE /api/v1/admin/permissions/:id - Delete permission
router.delete(
  "/:id",
  ...permission(PERMISSIONS.ADMIN.PERMISSIONS.DELETE),
  permissionsControllers.deletePermission,
);

module.exports = router;
