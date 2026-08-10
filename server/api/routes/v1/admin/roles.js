const express = require("express");
const { protect, permission } = require("../../../decorators");
const rolesControllers = require("../../../controllers/v1/admin/roles");
const PERMISSIONS = require("../../../../shared/constants/permissions");

const router = express.Router();

/**
 * Admin Roles Management Routes
 * All routes require authentication and explicit permission checks
 */

router.use(...protect());

// GET /api/v1/admin/roles - List all roles
router.get("/", ...permission(PERMISSIONS.ADMIN.ROLES.READ), rolesControllers.listRoles);

// POST /api/v1/admin/roles - Create new role
router.post("/", ...permission(PERMISSIONS.ADMIN.ROLES.CREATE), rolesControllers.createRole);

// GET /api/v1/admin/roles/:id - Get role with permissions
router.get(
  "/:id",
  ...permission(PERMISSIONS.ADMIN.ROLES.READ),
  rolesControllers.getRoleWithPermissions,
);

// PUT /api/v1/admin/roles/:id - Update role
router.put("/:id", ...permission(PERMISSIONS.ADMIN.ROLES.UPDATE), rolesControllers.updateRole);

// PUT /api/v1/admin/roles/:id/permissions - Assign permissions to role
router.put(
  "/:id/permissions",
  ...permission(PERMISSIONS.ADMIN.ROLES.UPDATE),
  rolesControllers.assignPermissionsToRole,
);

// DELETE /api/v1/admin/roles/:id - Delete role
router.delete(
  "/:id",
  ...permission(PERMISSIONS.ADMIN.ROLES.DELETE),
  rolesControllers.deleteRole,
);

module.exports = router;
