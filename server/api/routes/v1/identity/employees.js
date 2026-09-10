const router = require("express").Router();
const { protect, permission, anyPermission } = require("../../../decorators");
const { employees: employeesController } = require("../../../controllers/v1/identity");
const PERMISSIONS = require("../../../../shared/constants/permissions");

// Validate invitation token
router.get("/accept-invitation", employeesController.getInvitationPreview);

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
  ...permission(PERMISSIONS.EMPLOYEE.INVITE),
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
  ...anyPermission([PERMISSIONS.EMPLOYEE.INVITE, PERMISSIONS.EMPLOYEE.MANAGE]),
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
  ...permission(PERMISSIONS.EMPLOYEE.INVITE),
  employeesController.resendInvitation,
);

/**
 * GET /api/v1/employees
 * List all employees
 * Required permission: admin:users:read
 */
router.get(
  "/",
  ...protect(),
  ...permission(PERMISSIONS.ADMIN.USERS.READ),
  employeesController.listEmployees,
);

/**
 * GET /api/v1/employees/:id
 * Get employee details
 * Required permission: admin:users:read
 */
router.get(
  "/:id",
  ...protect(),
  ...permission(PERMISSIONS.ADMIN.USERS.READ),
  employeesController.getEmployee,
);

/**
 * PATCH /api/v1/employees/:id/role
 * Change employee role
 * Required permission: admin:roles:update
 */
router.patch(
  "/:id/role",
  ...protect(),
  ...permission(PERMISSIONS.ADMIN.ROLES.UPDATE),
  employeesController.updateEmployeeRole,
);

/**
 * PATCH /api/v1/employees/:id/status
 * Update employee employment status
 * Required permission: admin:users:lock, admin:users:delete, or admin:users:update
 */
router.patch(
  "/:id/status",
  ...protect(),
  ...anyPermission([
    PERMISSIONS.ADMIN.USERS.LOCK,
    PERMISSIONS.ADMIN.USERS.DELETE,
    PERMISSIONS.ADMIN.USERS.UPDATE,
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
  ...permission(PERMISSIONS.SECURITY.MANAGE),
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
  ...permission(PERMISSIONS.AUDIT.READ),
  employeesController.getEmployeeAuditLog,
);

module.exports = router;
