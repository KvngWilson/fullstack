const { logger } = require("../../../../shared/utils/logger");
const EmployeeManagementService = require("../../../../services/employeeManagement");
const { EMPLOYMENT_STATUSES } = require("../../../../services/employeeManagement");
const { successResponse, errorResponse } = require("../../../../shared/utils/response");

/**
 * Employee Management Controller
 * Handles employee invitations, lifecycle, role management
 */

// ============================================================================
// INVITATION MANAGEMENT
// ============================================================================

/**
 * POST /api/v1/employees/invite
 * Send invitation to new employee
 */
exports.inviteEmployee = async (req, res) => {
  try {
    const { email, roleId } = req.body;
    const invitation = await EmployeeManagementService.inviteEmployee({
      email,
      roleId,
      invitedByUserId: req.user.id,
      expiryHours: 24,
    });

    return successResponse(res, {
      data: {
        id: invitation.id,
        email: invitation.email,
        status: invitation.status,
        expiresAt: invitation.expires_at,
      },
      message: "Invitation created successfully",
      status: 201,
    });
  } catch (error) {
    logger.error("Failed to create invitation", { error: error.message });
    return errorResponse(res, {
      message: error.message,
      status: EmployeeManagementService.getErrorStatus(error),
    });
  }
};

/**
 * GET /api/v1/employees/accept-invitation
 * Validate an invitation token and return preview details
 */
exports.getInvitationPreview = async (req, res) => {
  try {
    const invitation = await EmployeeManagementService.getInvitationPreview(
      req.query.token,
    );

    return successResponse(res, {
      data: invitation,
      message: "Invitation is valid",
    });
  } catch (error) {
    logger.error("Failed to validate invitation", { error: error.message });
    return errorResponse(res, {
      message: error.message,
      status: EmployeeManagementService.getErrorStatus(error),
    });
  }
};

/**
 * POST /api/v1/employees/accept-invitation
 * Accept invitation and create account
 */
exports.acceptInvitation = async (req, res) => {
  try {
    const employee = await EmployeeManagementService.acceptInvitation(req.body);

    return successResponse(res, {
      data: {
        userId: employee.userId,
        email: employee.email,
        name: employee.name,
        roleCode: employee.roleCode,
        roleName: employee.roleName,
      },
      message: "Employee account created successfully",
      status: 201,
    });
  } catch (error) {
    logger.error("Failed to accept invitation", { error: error.message });
    return errorResponse(res, {
      message: error.message,
      status: EmployeeManagementService.getErrorStatus(error),
    });
  }
};

/**
 * GET /api/v1/employees/invitations
 * List pending invitations
 */
exports.getPendingInvitations = async (req, res) => {
  try {
    const invitationPage = await EmployeeManagementService.getPendingInvitations(
      req.query,
    );

    return successResponse(res, {
      data: invitationPage.invitations,
      message: "Pending invitations retrieved",
      meta: {
        page: invitationPage.page,
        pageSize: invitationPage.pageSize,
        total: invitationPage.total,
      },
    });
  } catch (error) {
    logger.error("Failed to fetch pending invitations", {
      error: error.message,
    });
    return errorResponse(res, {
      message: "Failed to fetch invitations",
      status: EmployeeManagementService.getErrorStatus(error),
    });
  }
};

/**
 * POST /api/v1/employees/resend-invitation/:id
 * Resend invitation email
 */
exports.resendInvitation = async (req, res) => {
  try {
    const invitation = await EmployeeManagementService.resendInvitation({
      invitationId: req.params.id,
      invitedByUserId: req.user.id,
    });

    return successResponse(res, {
      data: {
        id: invitation.id,
        email: invitation.email,
        expiresAt: invitation.expires_at,
      },
      message: "Invitation resent successfully",
    });
  } catch (error) {
    logger.error("Failed to resend invitation", { error: error.message });
    return errorResponse(res, {
      message: error.message,
      status: EmployeeManagementService.getErrorStatus(error),
    });
  }
};

// ============================================================================
// EMPLOYEE LIFECYCLE MANAGEMENT
// ============================================================================

/**
 * GET /api/v1/employees
 * List all employees with pagination and filtering
 */
exports.listEmployees = async (req, res) => {
  try {
    const employeePage = await EmployeeManagementService.listEmployeesForIdentity(
      req.query,
    );

    return successResponse(res, {
      data: employeePage.employees,
      message: "Employees retrieved",
      meta: {
        page: employeePage.page,
        pageSize: employeePage.pageSize,
        total: employeePage.total,
      },
    });
  } catch (error) {
    logger.error("Failed to list employees", { error: error.message });
    return errorResponse(res, {
      message: "Failed to fetch employees",
      status: EmployeeManagementService.getErrorStatus(error),
    });
  }
};

/**
 * GET /api/v1/employees/:id
 * Get employee details
 */
exports.getEmployee = async (req, res) => {
  try {
    const employee = await EmployeeManagementService.getEmployeeDetailsForIdentity(
      req.params.id,
    );

    return successResponse(res, {
      data: employee,
      message: "Employee details retrieved",
    });
  } catch (error) {
    logger.error("Failed to get employee", { error: error.message });
    return errorResponse(res, {
      message: error.message,
      status: EmployeeManagementService.getErrorStatus(error),
    });
  }
};

/**
 * PATCH /api/v1/employees/:id/role
 * Change employee role
 */
exports.updateEmployeeRole = async (req, res) => {
  try {
    const updateResult = await EmployeeManagementService.updateEmployeeRole({
      employeeId: req.params.id,
      roleId: req.body.roleId,
      actorEmployeeId: req.employee.id,
      actorUserId: req.user.id,
      reason: req.body.reason,
    });

    return successResponse(res, {
      data: updateResult,
      message: "Employee role updated successfully",
    });
  } catch (error) {
    logger.error("Failed to update employee role", { error: error.message });
    return errorResponse(res, {
      message: error.message,
      status: EmployeeManagementService.getErrorStatus(error),
    });
  }
};

/**
 * PATCH /api/v1/employees/:id/status
 * Update employee employment status
 */
exports.updateEmployeeStatus = async (req, res) => {
  try {
    const result = await EmployeeManagementService.updateEmployeeStatus({
      employeeId: req.params.id,
      status: req.body.status,
      actorEmployeeId: req.employee.id,
      actorUserId: req.user.id,
      reason: req.body.reason,
      allowedStatuses: EMPLOYMENT_STATUSES,
    });

    return successResponse(res, {
      data: result,
      message: "Employee status updated successfully",
    });
  } catch (error) {
    logger.error("Failed to update employee status", { error: error.message });
    return errorResponse(res, {
      message: error.message,
      status: EmployeeManagementService.getErrorStatus(error),
    });
  }
};

/**
 * POST /api/v1/employees/:id/permissions/override
 * Grant or revoke specific permissions to employee
 */
exports.setPermissionOverride = async (req, res) => {
  try {
    const result = await EmployeeManagementService.setPermissionOverride({
      employeeId: req.params.id,
      permissionCode: req.body.permissionCode,
      grantType: req.body.grantType,
      scope: req.body.scope,
      reason: req.body.reason,
      grantedByUserId: req.user.id,
    });

    return successResponse(res, {
      data: result.rows[0],
      message: "Permission override applied",
    });
  } catch (error) {
    logger.error("Failed to set permission override", {
      error: error.message,
    });
    return errorResponse(res, {
      message: error.message,
      status: EmployeeManagementService.getErrorStatus(error),
    });
  }
};

/**
 * GET /api/v1/employees/:id/audit-log
 * Get audit log for employee
 */
exports.getEmployeeAuditLog = async (req, res) => {
  try {
    const result = await EmployeeManagementService.getEmployeeAuditLog({
      employeeId: req.params.id,
      limit: req.query.limit,
      offset: req.query.offset,
    });

    return successResponse(res, {
      data: result,
      message: "Audit log retrieved",
    });
  } catch (error) {
    logger.error("Failed to get employee audit log", { error: error.message });
    return errorResponse(res, {
      message: error.message,
      status: EmployeeManagementService.getErrorStatus(error),
    });
  }
};

module.exports = exports;
