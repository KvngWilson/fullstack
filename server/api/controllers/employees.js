const { pool } = require("../../config/db");
const { logger } = require("../../utils/logger");
const InvitationService = require("../../services/invitation");
const { PermissionChecker } = require("../middleware/rbac");
const { successResponse, errorResponse } = require("../../utils/response");

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

    if (!email || !roleId) {
      return errorResponse(res, {
        message: "Email and roleId are required",
        status: 400,
      });
    }

    const invitation = await InvitationService.createInvitation(
      email,
      roleId,
      req.user.id,
      24,
    );

    // TODO: Send invitation email with invitation_token
    logger.info("Invitation email would be sent", {
      email,
      invitationId: invitation.id,
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
      status: 400,
    });
  }
};

/**
 * POST /api/v1/employees/accept-invitation
 * Accept invitation and create account
 */
exports.acceptInvitation = async (req, res) => {
  try {
    const { token, firstName, lastName, password, confirmPassword } = req.body;

    if (!token || !firstName || !lastName || !password) {
      return errorResponse(res, {
        message: "All fields are required",
        status: 400,
      });
    }

    if (password !== confirmPassword) {
      return errorResponse(res, {
        message: "Passwords do not match",
        status: 400,
      });
    }

    if (password.length < 8) {
      return errorResponse(res, {
        message: "Password must be at least 8 characters",
        status: 400,
      });
    }

    const employee = await InvitationService.acceptInvitation(token, {
      firstName,
      lastName,
      password,
    });

    return successResponse(res, {
      data: {
        userId: employee.userId,
        email: employee.email,
        name: employee.name,
      },
      message: "Employee account created successfully",
      status: 201,
    });
  } catch (error) {
    logger.error("Failed to accept invitation", { error: error.message });
    return errorResponse(res, {
      message: error.message,
      status: 400,
    });
  }
};

/**
 * GET /api/v1/employees/invitations
 * List pending invitations
 */
exports.getPendingInvitations = async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const limit = Math.min(parseInt(pageSize) || 20, 100);
    const offset = (Math.max(1, parseInt(page) || 1) - 1) * limit;

    const invitations = await InvitationService.getPendingInvitations(
      limit,
      offset,
    );

    const countResult = await pool.query(
      "SELECT COUNT(*) as count FROM employee_invitations WHERE status = 'pending' AND expires_at > now()",
    );

    return successResponse(res, {
      data: invitations,
      message: "Pending invitations retrieved",
      meta: {
        page: parseInt(page),
        pageSize: limit,
        total: parseInt(countResult.rows[0].count),
      },
    });
  } catch (error) {
    logger.error("Failed to fetch pending invitations", {
      error: error.message,
    });
    return errorResponse(res, {
      message: "Failed to fetch invitations",
      status: 500,
    });
  }
};

/**
 * POST /api/v1/employees/resend-invitation/:id
 * Resend invitation email
 */
exports.resendInvitation = async (req, res) => {
  try {
    const { id } = req.params;

    const invitation = await InvitationService.resendInvitation(
      id,
      req.user.id,
    );

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
      status: 400,
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
    const { page = 1, pageSize = 20, status = "active", roleId } = req.query;
    const limit = Math.min(parseInt(pageSize) || 20, 100);
    const offset = (Math.max(1, parseInt(page) || 1) - 1) * limit;

    let query = `
      SELECT 
        e.id, e.user_id, e.employment_status, e.mfa_enabled, e.last_login_at, e.created_at,
        u.email, u.first_name, u.last_name,
        r.code as role_code, r.name as role_name, r.hierarchy_level
      FROM employees e
      JOIN users u ON e.user_id = u.id
      JOIN roles r ON e.role_id = r.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND e.employment_status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (roleId) {
      query += ` AND e.role_id = $${paramIndex}`;
      params.push(roleId);
      paramIndex++;
    }

    query += ` ORDER BY e.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    const countResult = await pool.query(
      "SELECT COUNT(*) as count FROM employees WHERE employment_status = $1",
      [status],
    );

    return successResponse(res, {
      data: result.rows,
      message: "Employees retrieved",
      meta: {
        page: parseInt(page),
        pageSize: limit,
        total: parseInt(countResult.rows[0].count),
      },
    });
  } catch (error) {
    logger.error("Failed to list employees", { error: error.message });
    return errorResponse(res, {
      message: "Failed to fetch employees",
      status: 500,
    });
  }
};

/**
 * GET /api/v1/employees/:id
 * Get employee details
 */
exports.getEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT 
        e.id, e.user_id, e.employment_status, e.mfa_enabled, e.mfa_verified_at,
        e.last_login_at, e.failed_login_attempts, e.account_locked_until, e.created_at,
        u.email, u.first_name, u.last_name,
        r.id as role_id, r.code as role_code, r.name as role_name,
        COALESCE(json_agg(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL), '[]'::json) as permissions
      FROM employees e
      JOIN users u ON e.user_id = u.id
      JOIN roles r ON e.role_id = r.id
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN permissions p ON rp.permission_id = p.id
      WHERE e.id = $1
      GROUP BY e.id, u.id, r.id
      `,
      [id],
    );

    if (result.rowCount === 0) {
      return errorResponse(res, {
        message: "Employee not found",
        status: 404,
      });
    }

    return successResponse(res, {
      data: result.rows[0],
      message: "Employee details retrieved",
    });
  } catch (error) {
    logger.error("Failed to get employee", { error: error.message });
    return errorResponse(res, {
      message: "Failed to fetch employee",
      status: 500,
    });
  }
};

/**
 * PATCH /api/v1/employees/:id/role
 * Change employee role
 */
exports.updateEmployeeRole = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { roleId, reason } = req.body;

    if (!roleId) {
      return errorResponse(res, {
        message: "roleId is required",
        status: 400,
      });
    }

    await client.query("BEGIN");

    // Get employee's current role
    const empResult = await client.query(
      "SELECT role_id, user_id FROM employees WHERE id = $1",
      [id],
    );

    if (empResult.rowCount === 0) {
      throw new Error("Employee not found");
    }

    const oldRoleId = empResult.rows[0].role_id;
    const targetUserId = empResult.rows[0].user_id;

    // Check hierarchy: can only assign roles at or below your level
    const myRole = await PermissionChecker.getEmployeeRole(
      req.employee.id,
    );
    const targetRole = await client.query(
      "SELECT hierarchy_level FROM roles WHERE id = $1",
      [roleId],
    );

    if (
      !myRole ||
      !targetRole.rows[0] ||
      targetRole.rows[0].hierarchy_level > myRole.hierarchy_level
    ) {
      throw new Error(
        "Cannot assign role with higher hierarchy level than your own",
      );
    }

    // Update role
    const updateResult = await client.query(
      `UPDATE employees SET role_id = $1, updated_at = now()
       WHERE id = $2
       RETURNING id`,
      [roleId, id],
    );

    // Log security event
    await client.query(
      `INSERT INTO security_audit_log (event_type, actor_id, target_id, description, metadata)
       VALUES ('role_changed', $1, $2, $3, $4)`,
      [
        req.user.id,
        targetUserId,
        `Employee role changed from ${oldRoleId} to ${roleId}`,
        JSON.stringify({ oldRoleId, newRoleId: roleId, reason }),
      ],
    );

    await client.query("COMMIT");

    return successResponse(res, {
      data: updateResult.rows[0],
      message: "Employee role updated successfully",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("Failed to update employee role", { error: error.message });
    return errorResponse(res, {
      message: error.message,
      status: 400,
    });
  } finally {
    client.release();
  }
};

/**
 * PATCH /api/v1/employees/:id/status
 * Update employee employment status
 */
exports.updateEmployeeStatus = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    const validStatuses = [
      "active",
      "suspended",
      "on_leave",
      "terminated",
      "inactive",
    ];
    if (!validStatuses.includes(status)) {
      return errorResponse(res, {
        message: `Status must be one of: ${validStatuses.join(", ")}`,
        status: 400,
      });
    }

    await client.query("BEGIN");

    const empResult = await client.query(
      "SELECT user_id, employment_status FROM employees WHERE id = $1",
      [id],
    );

    if (empResult.rowCount === 0) {
      throw new Error("Employee not found");
    }

    const oldStatus = empResult.rows[0].employment_status;
    const targetUserId = empResult.rows[0].user_id;

    const result = await client.query(
      `UPDATE employees SET employment_status = $1, updated_at = now()
       WHERE id = $2
       RETURNING id, employment_status`,
      [status, id],
    );

    // Log security event
    await client.query(
      `INSERT INTO security_audit_log (event_type, actor_id, target_id, description, metadata)
       VALUES ('employment_status_changed', $1, $2, $3, $4)`,
      [
        req.user.id,
        targetUserId,
        `Employment status changed from ${oldStatus} to ${status}`,
        JSON.stringify({ oldStatus, newStatus: status, reason }),
      ],
    );

    await client.query("COMMIT");

    return successResponse(res, {
      data: result.rows[0],
      message: "Employee status updated successfully",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("Failed to update employee status", { error: error.message });
    return errorResponse(res, {
      message: error.message,
      status: 400,
    });
  } finally {
    client.release();
  }
};

/**
 * POST /api/v1/employees/:id/permissions/override
 * Grant or revoke specific permissions to employee
 */
exports.setPermissionOverride = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissionCode, grantType = "grant", scope, reason } = req.body;

    if (!permissionCode) {
      return errorResponse(res, {
        message: "permissionCode is required",
        status: 400,
      });
    }

    // Get permission ID
    const permResult = await pool.query(
      "SELECT id FROM permissions WHERE code = $1",
      [permissionCode],
    );

    if (permResult.rowCount === 0) {
      return errorResponse(res, {
        message: "Permission not found",
        status: 404,
      });
    }

    const permissionId = permResult.rows[0].id;

    const result = await pool.query(
      `INSERT INTO employee_permission_overrides 
       (employee_id, permission_id, grant_type, scope, reason, granted_by_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (employee_id, permission_id, scope) DO UPDATE SET
       grant_type = $3, reason = $5
       RETURNING id, grant_type, permission_id, scope`,
      [id, permissionId, grantType, scope, reason, req.user.id],
    );

    logger.info("Permission override set", {
      employeeId: id,
      permissionCode,
      grantType,
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
      status: 400,
    });
  }
};

/**
 * GET /api/v1/employees/:id/audit-log
 * Get audit log for employee
 */
exports.getEmployeeAuditLog = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT id, event_type, actor_id, description, metadata, created_at
       FROM security_audit_log
       WHERE target_id = (SELECT user_id FROM employees WHERE id = $1)
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset],
    );

    return successResponse(res, {
      data: result.rows,
      message: "Audit log retrieved",
    });
  } catch (error) {
    logger.error("Failed to get employee audit log", { error: error.message });
    return errorResponse(res, {
      message: "Failed to fetch audit log",
      status: 500,
    });
  }
};

module.exports = exports;
