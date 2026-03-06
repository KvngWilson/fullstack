const express = require("express");
const { protect, permission } = require("../../../decorators");
const permissionsControllers = require("../../../controllers/v1/admin/permissions");
const adminPolicy = require("../../../../policies/adminPolicy");

const router = express.Router();

/**
 * Admin Permissions Management Routes
 * All routes require authentication and explicit permission checks
 */

router.use(...protect());

// GET /api/v1/admin/permissions - List all permissions
router.get(
  "/",
  ...permission(adminPolicy.permissions.read),
  permissionsControllers.listPermissions,
);

// GET /api/v1/admin/permissions/matrix - Get permission matrix (roles x permissions)
router.get(
  "/matrix",
  ...permission(adminPolicy.permissions.read),
  permissionsControllers.getPermissionMatrix,
);

// GET /api/v1/admin/permissions/categories - Get permission categories
router.get(
  "/categories",
  ...permission(adminPolicy.permissions.read),
  permissionsControllers.getPermissionsByCategory,
);

// POST /api/v1/admin/permissions - Create new permission
router.post(
  "/",
  ...permission(adminPolicy.permissions.create),
  permissionsControllers.createPermission,
);

// GET /api/v1/admin/permissions/:id - Get permission details
router.get(
  "/:id",
  ...permission(adminPolicy.permissions.read),
  permissionsControllers.getPermission,
);

// PUT /api/v1/admin/permissions/:id - Update permission
router.put(
  "/:id",
  ...permission(adminPolicy.permissions.update),
  permissionsControllers.updatePermission,
);

// DELETE /api/v1/admin/permissions/:id - Delete permission
router.delete(
  "/:id",
  ...permission(adminPolicy.permissions.delete),
  permissionsControllers.deletePermission,
);

module.exports = router;
