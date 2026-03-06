const express = require("express");
const { protect, permission } = require("../../../decorators");
const rolesControllers = require("../../../controllers/v1/admin/roles");
const adminPolicy = require("../../../../policies/adminPolicy");

const router = express.Router();

/**
 * Admin Roles Management Routes
 * All routes require authentication and explicit permission checks
 */

router.use(...protect());

// GET /api/v1/admin/roles - List all roles
router.get("/", ...permission(adminPolicy.roles.read), rolesControllers.listRoles);

// POST /api/v1/admin/roles - Create new role
router.post("/", ...permission(adminPolicy.roles.create), rolesControllers.createRole);

// GET /api/v1/admin/roles/:id - Get role with permissions
router.get(
  "/:id",
  ...permission(adminPolicy.roles.read),
  rolesControllers.getRoleWithPermissions,
);

// PUT /api/v1/admin/roles/:id - Update role
router.put("/:id", ...permission(adminPolicy.roles.update), rolesControllers.updateRole);

// PUT /api/v1/admin/roles/:id/permissions - Assign permissions to role
router.put(
  "/:id/permissions",
  ...permission(adminPolicy.roles.permissions),
  rolesControllers.assignPermissionsToRole,
);

// DELETE /api/v1/admin/roles/:id - Delete role
router.delete(
  "/:id",
  ...permission(adminPolicy.roles.delete),
  rolesControllers.deleteRole,
);

module.exports = router;
