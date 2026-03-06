const router = require("express").Router();
const { protect, permission, anyPermission } = require("../../../decorators");
const { employees: employeesController } = require("../../../controllers/v1/identity");
const adminPolicy = require("../../../../policies/adminPolicy");

// Accept invitation and create employee account
router.post("/accept-invitation", employeesController.acceptInvitation);

// All routes below require authentication
/**
 * POST /api/v1/employees/invite
 * Send invitation to new employee
 * Required permission: employee:invite
 */
router.post(
  "/invite",
  ...protect(),
  ...permission(adminPolicy.employees.invite),
  employeesController.inviteEmployee,
);

/**
 * GET /api/v1/employees/invitations
 * List pending invitations
 * Required permission: employee:invite or employee:manage
 */
router.get(
  "/invitations",
  ...protect(),
  ...anyPermission([adminPolicy.employees.invite, adminPolicy.employees.manage]),
  employeesController.getPendingInvitations,
);

/**
 * POST /api/v1/employees/resend-invitation/:id
 * Resend invitation email
 * Required permission: employee:invite
 */
router.post(
  "/resend-invitation/:id",
  ...protect(),
  ...permission(adminPolicy.employees.invite),
  employeesController.resendInvitation,
);

/**
 * GET /api/v1/employees
 * List all employees
 * Required permission: user:read
 */
router.get(
  "/",
  ...protect(),
  ...permission(adminPolicy.users.read),
  employeesController.listEmployees,
);

/**
 * GET /api/v1/employees/:id
 * Get employee details
 * Required permission: user:read
 */
router.get(
  "/:id",
  ...protect(),
  ...permission(adminPolicy.users.read),
  employeesController.getEmployee,
);

/**
 * PATCH /api/v1/employees/:id/role
 * Change employee role
 * Required permission: user:role_assign
 */
router.patch(
  "/:id/role",
  ...protect(),
  ...permission(adminPolicy.users.roleAssign),
  employeesController.updateEmployeeRole,
);

/**
 * PATCH /api/v1/employees/:id/status
 * Update employee employment status
 * Required permission: user:suspend, user:delete, or user:update
 */
router.patch(
  "/:id/status",
  ...protect(),
  ...anyPermission([
    adminPolicy.users.suspend,
    adminPolicy.users.delete,
    adminPolicy.users.update,
  ]),
  employeesController.updateEmployeeStatus,
);

/**
 * POST /api/v1/employees/:id/permissions/override
 * Grant or revoke specific permissions
 * Required permission: security:manage
 */
router.post(
  "/:id/permissions/override",
  ...protect(),
  ...permission(adminPolicy.security.manage),
  employeesController.setPermissionOverride,
);

/**
 * GET /api/v1/employees/:id/audit-log
 * Get employee audit log
 * Required permission: audit:read
 */
router.get(
  "/:id/audit-log",
  ...protect(),
  ...permission(adminPolicy.audit.read),
  employeesController.getEmployeeAuditLog,
);

module.exports = router;
