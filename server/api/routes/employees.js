const router = require("express").Router();
const { authenticateJWT } = require("../../config/auth");
const {
  requirePermission,
  requireAnyPermission,
} = require("../middleware/rbac");
const employeesController = require("../controllers/employees");

// Accept invitation and create employee account
router.post("/accept-invitation", employeesController.acceptInvitation);

// All routes below require authentication
router.use(authenticateJWT);

/**
 * POST /api/v1/employees/invite
 * Send invitation to new employee
 * Required permission: employee:invite
 */
router.post(
  "/invite",
  requirePermission("employee:invite"),
  employeesController.inviteEmployee,
);

/**
 * GET /api/v1/employees/invitations
 * List pending invitations
 * Required permission: employee:invite or employee:manage
 */
router.get(
  "/invitations",
  requireAnyPermission(["employee:invite", "employee:manage"]),
  employeesController.getPendingInvitations,
);

/**
 * POST /api/v1/employees/resend-invitation/:id
 * Resend invitation email
 * Required permission: employee:invite
 */
router.post(
  "/resend-invitation/:id",
  requirePermission("employee:invite"),
  employeesController.resendInvitation,
);

/**
 * GET /api/v1/employees
 * List all employees
 * Required permission: user:read
 */
router.get(
  "/",
  requirePermission("user:read"),
  employeesController.listEmployees,
);

/**
 * GET /api/v1/employees/:id
 * Get employee details
 * Required permission: user:read
 */
router.get(
  "/:id",
  requirePermission("user:read"),
  employeesController.getEmployee,
);

/**
 * PATCH /api/v1/employees/:id/role
 * Change employee role
 * Required permission: user:role_assign
 */
router.patch(
  "/:id/role",
  requirePermission("user:role_assign"),
  employeesController.updateEmployeeRole,
);

/**
 * PATCH /api/v1/employees/:id/status
 * Update employee employment status
 * Required permission: user:suspend, user:delete, or user:update
 */
router.patch(
  "/:id/status",
  requireAnyPermission(["user:suspend", "user:delete", "user:update"]),
  employeesController.updateEmployeeStatus,
);

/**
 * POST /api/v1/employees/:id/permissions/override
 * Grant or revoke specific permissions
 * Required permission: security:manage
 */
router.post(
  "/:id/permissions/override",
  requirePermission("security:manage"),
  employeesController.setPermissionOverride,
);

/**
 * GET /api/v1/employees/:id/audit-log
 * Get employee audit log
 * Required permission: audit:read
 */
router.get(
  "/:id/audit-log",
  requirePermission("audit:read"),
  employeesController.getEmployeeAuditLog,
);

module.exports = router;
