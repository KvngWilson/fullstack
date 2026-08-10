const { pool } = require("../config/db");
const logger = require("../shared/utils/logger");
const InvitationService = require("./invitation");
const {
  PermissionChecker,
  invalidateEmployeeLookup,
} = require("../api/middleware/rbac");
const PermissionService = require("../shared/core/PermissionService");
const {
  AuthorizationError,
  NotFoundError,
  ValidationError,
} = require("../shared/utils/errors");

const EMPLOYMENT_STATUSES = [
  "active",
  "suspended",
  "on_leave",
  "terminated",
  "inactive",
];

function normalizeInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePagination({ page = 1, pageSize = 20, max = 100 } = {}) {
  const normalizedPage = Math.max(1, normalizeInt(page, 1));
  const normalizedPageSize = Math.min(
    max,
    Math.max(1, normalizeInt(pageSize, 20)),
  );
  const offset = (normalizedPage - 1) * normalizedPageSize;

  return {
    page: normalizedPage,
    pageSize: normalizedPageSize,
    limit: normalizedPageSize,
    offset,
  };
}

function normalizeLimitOffset({ limit = 50, offset = 0, max = 100 } = {}) {
  return {
    limit: Math.min(max, Math.max(1, normalizeInt(limit, 50))),
    offset: Math.max(0, normalizeInt(offset, 0)),
  };
}

function toCount(value) {
  return Number.parseInt(value, 10) || 0;
}

function getErrorStatus(error) {
  return error.statusCode || error.status || 500;
}

async function resolveRole({
  roleId,
  roleCode,
  executor = pool,
  requireActive = true,
} = {}) {
  if (!roleId && !roleCode) {
    throw new ValidationError("roleId or roleCode is required");
  }

  if (roleId) {
    const result = await executor.query(
      `SELECT id, code, name, hierarchy_level
       FROM roles
       WHERE id = $1${requireActive ? " AND is_active = true" : ""}`,
      [roleId],
    );

    if (result.rowCount === 0) {
      throw new ValidationError("Invalid role");
    }

    return result.rows[0];
  }

  const result = await executor.query(
    `SELECT id, code, name, hierarchy_level
     FROM roles
     WHERE code = $1${requireActive ? " AND is_active = true" : ""}`,
    [roleCode],
  );

  if (result.rowCount === 0) {
    throw new ValidationError("Invalid role");
  }

  return result.rows[0];
}

async function insertSecurityAuditLog(
  executor,
  { eventType, actorId, targetId = null, description, metadata = {} },
) {
  await executor.query(
    `INSERT INTO security_audit_log (event_type, actor_id, target_id, description, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [eventType, actorId, targetId, description, JSON.stringify(metadata)],
  );
}

class EmployeeManagementService {
  static getErrorStatus(error) {
    return getErrorStatus(error);
  }

  static async inviteEmployee({
    email,
    roleId,
    roleCode,
    invitedByUserId,
    expiryHours = 24,
  }) {
    if (!email) {
      throw new ValidationError("Email is required");
    }

    if (!invitedByUserId) {
      throw new ValidationError("invitedByUserId is required");
    }

    const role = await resolveRole({ roleId, roleCode });

    return InvitationService.createInvitation(
      email,
      role.id,
      invitedByUserId,
      expiryHours,
    );
  }

  static async getInvitationPreview(token) {
    if (!token) {
      throw new ValidationError("Invitation token is required");
    }

    return InvitationService.getInvitationPreview(token);
  }

  static async acceptInvitation({
    token,
    firstName,
    lastName,
    password,
    confirmPassword,
  }) {
    if (!token || !firstName || !lastName || !password) {
      throw new ValidationError("All fields are required");
    }

    if (password !== confirmPassword) {
      throw new ValidationError("Passwords do not match");
    }

    if (password.length < 8) {
      throw new ValidationError("Password must be at least 8 characters");
    }

    return InvitationService.acceptInvitation(token, {
      firstName,
      lastName,
      password,
    });
  }

  static async getPendingInvitations({ page = 1, pageSize = 20 } = {}) {
    const pagination = normalizePagination({ page, pageSize });
    const invitations = await InvitationService.getPendingInvitations(
      pagination.limit,
      pagination.offset,
    );
    const countResult = await pool.query(
      "SELECT COUNT(*) as count FROM employee_invitations WHERE status = 'pending' AND expires_at > now()",
    );

    return {
      invitations,
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: toCount(countResult.rows[0]?.count),
    };
  }

  static async resendInvitation({ invitationId, invitedByUserId }) {
    if (!invitationId) {
      throw new ValidationError("invitationId is required");
    }

    if (!invitedByUserId) {
      throw new ValidationError("invitedByUserId is required");
    }

    return InvitationService.resendInvitation(invitationId, invitedByUserId);
  }

  static async listEmployeesForIdentity({
    page = 1,
    pageSize = 20,
    status,
    roleId,
  } = {}) {
    const pagination = normalizePagination({ page, pageSize });

    let query = `
      SELECT 
        e.id, e.user_id, e.role_id, e.employment_status, e.mfa_enabled, e.last_login_at, e.created_at,
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
      query += ` AND e.employment_status = $${paramIndex++}`;
      params.push(status);
    }

    if (roleId) {
      query += ` AND e.role_id = $${paramIndex++}`;
      params.push(roleId);
    }

    query += ` ORDER BY e.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(pagination.limit, pagination.offset);

    const result = await pool.query(query, params);

    let countQuery = "SELECT COUNT(*) as count FROM employees WHERE 1=1";
    const countParams = [];
    let countParamIndex = 1;

    if (status) {
      countQuery += ` AND employment_status = $${countParamIndex++}`;
      countParams.push(status);
    }

    if (roleId) {
      countQuery += ` AND role_id = $${countParamIndex++}`;
      countParams.push(roleId);
    }

    const countResult = await pool.query(countQuery, countParams);

    return {
      employees: result.rows,
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: toCount(countResult.rows[0]?.count),
    };
  }

  static async listEmployeesForAdmin({
    role,
    status,
    search,
    limit = 50,
    offset = 0,
  } = {}) {
    const pagination = normalizeLimitOffset({ limit, offset });

    let query = `
      SELECT 
        e.id, u.email, u.first_name, u.last_name,
        r.code as role_code, r.name as role_name, r.hierarchy_level,
        e.employment_status, e.created_at
      FROM employees e
      JOIN users u ON e.user_id = u.id
      JOIN roles r ON e.role_id = r.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (role) {
      query += ` AND r.code = $${paramIndex++}`;
      params.push(role);
    }

    if (status) {
      query += ` AND e.employment_status = $${paramIndex++}`;
      params.push(status);
    }

    if (search) {
      query += ` AND (LOWER(u.email) LIKE LOWER($${paramIndex}) OR LOWER(u.first_name) LIKE LOWER($${paramIndex}) OR LOWER(u.last_name) LIKE LOWER($${paramIndex}))`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY u.last_name, u.first_name LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(pagination.limit, pagination.offset);

    const result = await pool.query(query, params);

    let countQuery = `
      SELECT COUNT(*) as total
      FROM employees e
      JOIN users u ON e.user_id = u.id
      JOIN roles r ON e.role_id = r.id
      WHERE 1=1
    `;
    const countParams = [];
    let countParamIndex = 1;

    if (role) {
      countQuery += ` AND r.code = $${countParamIndex++}`;
      countParams.push(role);
    }

    if (status) {
      countQuery += ` AND e.employment_status = $${countParamIndex++}`;
      countParams.push(status);
    }

    if (search) {
      countQuery += ` AND (LOWER(u.email) LIKE LOWER($${countParamIndex}) OR LOWER(u.first_name) LIKE LOWER($${countParamIndex}) OR LOWER(u.last_name) LIKE LOWER($${countParamIndex}))`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }

    const countResult = await pool.query(countQuery, countParams);

    return {
      employees: result.rows,
      total: toCount(countResult.rows[0]?.total),
      limit: pagination.limit,
      offset: pagination.offset,
    };
  }

  static async getEmployeeDetailsForIdentity(employeeId) {
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
      [employeeId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError("Employee");
    }

    return result.rows[0];
  }

  static async getEmployeeDetailsForAdmin(employeeId) {
    const result = await pool.query(
      `SELECT 
        e.id, u.email, u.first_name, u.last_name,
        r.code as role_code, r.name as role_name,
        e.employment_status, e.created_at, e.last_login_at,
        e.mfa_enabled, e.account_locked_until
      FROM employees e
      JOIN users u ON e.user_id = u.id
      JOIN roles r ON e.role_id = r.id
      WHERE e.id = $1`,
      [employeeId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError("Employee");
    }

    return result.rows[0];
  }

  static async updateEmployeeRole({
    employeeId,
    roleId,
    roleCode,
    actorEmployeeId,
    actorUserId,
    reason = null,
    enforceHierarchy = true,
  }) {
    if (!employeeId) {
      throw new ValidationError("employeeId is required");
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const employeeResult = await client.query(
        "SELECT role_id, user_id FROM employees WHERE id = $1",
        [employeeId],
      );

      if (employeeResult.rowCount === 0) {
        throw new NotFoundError("Employee");
      }

      const currentEmployee = employeeResult.rows[0];
      const targetRole = await resolveRole({
        roleId,
        roleCode,
        executor: client,
      });

      if (enforceHierarchy) {
        const actorRole =
          await PermissionChecker.getEmployeeRole(actorEmployeeId);

        if (
          !actorRole ||
          targetRole.hierarchy_level > actorRole.hierarchy_level
        ) {
          throw new AuthorizationError(
            "Cannot assign role with higher hierarchy level than your own",
          );
        }
      }

      const updateResult = await client.query(
        `UPDATE employees SET role_id = $1, updated_at = now()
         WHERE id = $2
         RETURNING id`,
        [targetRole.id, employeeId],
      );

      await client.query(
        `UPDATE users SET role = $1, updated_at = now() WHERE id = $2`,
        [targetRole.code || "employee", currentEmployee.user_id],
      );

      await insertSecurityAuditLog(client, {
        eventType: "role_changed",
        actorId: actorUserId || actorEmployeeId,
        targetId: currentEmployee.user_id,
        description: `Employee role changed from ${currentEmployee.role_id} to ${targetRole.id}`,
        metadata: {
          oldRoleId: currentEmployee.role_id,
          newRoleId: targetRole.id,
          newRoleCode: targetRole.code,
          reason,
        },
      });

      await client.query("COMMIT");

      await PermissionService.invalidateEmployeePermissions(employeeId);

      return {
        ...updateResult.rows[0],
        roleId: targetRole.id,
        roleCode: targetRole.code,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error("Failed to update employee role", {
        employeeId,
        error: error.message,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  static async updateEmployeeStatus({
    employeeId,
    status,
    actorEmployeeId,
    actorUserId,
    reason = null,
    allowedStatuses = EMPLOYMENT_STATUSES,
  }) {
    if (!employeeId) {
      throw new ValidationError("employeeId is required");
    }

    if (!allowedStatuses.includes(status)) {
      throw new ValidationError(
        `Status must be one of: ${allowedStatuses.join(", ")}`,
      );
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const employeeResult = await client.query(
        "SELECT user_id, employment_status FROM employees WHERE id = $1",
        [employeeId],
      );

      if (employeeResult.rowCount === 0) {
        throw new NotFoundError("Employee");
      }

      const currentEmployee = employeeResult.rows[0];
      const result = await client.query(
        `UPDATE employees SET employment_status = $1, updated_at = now()
         WHERE id = $2
         RETURNING id, employment_status`,
        [status, employeeId],
      );

      await insertSecurityAuditLog(client, {
        eventType: "employment_status_changed",
        actorId: actorUserId || actorEmployeeId,
        targetId: currentEmployee.user_id,
        description: `Employment status changed from ${currentEmployee.employment_status} to ${status}`,
        metadata: {
          oldStatus: currentEmployee.employment_status,
          newStatus: status,
          reason,
        },
      });

      await client.query("COMMIT");

      await PermissionService.invalidateEmployeePermissions(employeeId);
      await invalidateEmployeeLookup(currentEmployee.user_id);

      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error("Failed to update employee status", {
        employeeId,
        error: error.message,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  static async setPermissionOverride({
    employeeId,
    permissionCode,
    grantType = "grant",
    scope = null,
    reason = null,
    grantedByUserId,
  }) {
    if (!employeeId) {
      throw new ValidationError("employeeId is required");
    }

    if (!permissionCode) {
      throw new ValidationError("permissionCode is required");
    }

    if (!["grant", "revoke"].includes(grantType)) {
      throw new ValidationError("grantType must be grant or revoke");
    }

    if (!grantedByUserId) {
      throw new ValidationError("grantedByUserId is required");
    }

    const permissionResult = await pool.query(
      "SELECT id FROM permissions WHERE code = $1",
      [permissionCode],
    );

    if (permissionResult.rowCount === 0) {
      throw new NotFoundError("Permission");
    }

    const result = await pool.query(
      `INSERT INTO employee_permission_overrides 
       (employee_id, permission_id, grant_type, scope, reason, granted_by_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (employee_id, permission_id, scope) DO UPDATE SET
       grant_type = $3, reason = $5
       RETURNING id, grant_type, permission_id, scope`,
      [
        employeeId,
        permissionResult.rows[0].id,
        grantType,
        scope,
        reason,
        grantedByUserId,
      ],
    );

    await PermissionService.invalidateEmployeePermissions(employeeId);

    logger.info("Permission override set", {
      employeeId,
      permissionCode,
      grantType,
    });

    return result.rows[0];
  }

  static async getEmployeeAuditLog({ employeeId, limit = 50, offset = 0 }) {
    const pagination = normalizeLimitOffset({ limit, offset });

    const result = await pool.query(
      `SELECT id, event_type, actor_id, description, metadata, created_at
       FROM security_audit_log
       WHERE target_id = (SELECT user_id FROM employees WHERE id = $1)
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [employeeId, pagination.limit, pagination.offset],
    );

    return result.rows;
  }
}

module.exports = EmployeeManagementService;
module.exports.EMPLOYMENT_STATUSES = EMPLOYMENT_STATUSES;
