const { pool } = require("../../../../config/db");
const AdminAuthService = require("../../../../domain/admin/AdminAuthService");
const { logger } = require("../../../../shared/utils/logger");

const adminAuthService = new AdminAuthService();

/**
 * Admin Employees Controllers
 * Endpoints:
 * - GET /api/v1/admin/employees - List all employees
 * - POST /api/v1/admin/employees/invite - Send employee invitation
 * - GET /api/v1/admin/employees/:id - Get employee details
 * - PUT /api/v1/admin/employees/:id - Update employee
 * - PUT /api/v1/admin/employees/:id/role - Update employee role
 * - PUT /api/v1/admin/employees/:id/status - Suspend/activate employee
 * - DELETE /api/v1/admin/employees/:id - Delete employee
 */

// GET /api/v1/admin/employees
// List all employees with filtering
exports.listEmployees = async (req, res) => {
  try {
    const { role, status, search, limit = 50, offset = 0 } = req.query;

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
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Count total
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

    res.json({
      employees: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    logger.error("List employees error", { error: error.message });
    res.status(500).json({ error: "Failed to list employees" });
  }
};

// POST /api/v1/admin/employees/invite
// Send employee invitation via email
exports.inviteEmployee = async (req, res) => {
  try {
    const { email, roleCode } = req.body;

    if (!email || !roleCode) {
      return res.status(400).json({ error: "Email and role required" });
    }

    // Validate email doesn't exist
    await adminAuthService.validateEmailForInvitation(email);

    // Validate role exists and get role ID
    const roleResult = await pool.query(
      `SELECT id FROM roles WHERE code = $1 AND is_active = true`,
      [roleCode]
    );

    if (roleResult.rowCount === 0) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const roleId = roleResult.rows[0].id;

    // Generate invitation token
    const token = require("crypto").randomBytes(32).toString("hex");
    const tokenHash = require("crypto").createHash("sha256").update(token).digest("hex");

    // Create invitation
    const inviteResult = await pool.query(
      `INSERT INTO employee_invitations 
       (email, role_id, invitation_token, token_hash, invited_by_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, now() + interval '7 days')
       RETURNING id, invitation_token`,
      [email, roleId, token, tokenHash, req.user.id]
    );

    // Log audit
    await adminAuthService.auditLog(req.employee.id, 'invite', 'employee', null, {
      email,
      roleCode,
    });

    // Queue email (simplified - implement actual email service)
    logger.info("Employee invitation created", {
      email,
      roleCode,
      inviteId: inviteResult.rows[0].id,
    });

    res.status(201).json({
      message: "Invitation sent",
      inviteId: inviteResult.rows[0].id,
      email,
    });
  } catch (error) {
    logger.error("Invite employee error", { error: error.message });
    res.status(500).json({ error: "Failed to send invitation" });
  }
};

// GET /api/v1/admin/employees/:id
// Get employee details
exports.getEmployee = async (req, res) => {
  try {
    const { id } = req.params;

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
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error("Get employee error", { error: error.message });
    res.status(500).json({ error: "Failed to get employee" });
  }
};

// PUT /api/v1/admin/employees/:id/role
// Update employee role
exports.updateEmployeeRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { roleCode } = req.body;

    if (!roleCode) {
      return res.status(400).json({ error: "Role required" });
    }

    // Get role ID
    const roleResult = await pool.query(
      `SELECT id FROM roles WHERE code = $1`,
      [roleCode]
    );

    if (roleResult.rowCount === 0) {
      return res.status(400).json({ error: "Invalid role" });
    }

    // Update employee role
    const updateResult = await pool.query(
      `UPDATE employees SET role_id = $1, updated_at = now() WHERE id = $2 RETURNING id`,
      [roleResult.rows[0].id, id]
    );

    if (updateResult.rowCount === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Audit log
    await adminAuthService.auditLog(req.employee.id, 'update_role', 'employee', id, {
      newRole: roleCode,
    });

    res.json({ message: "Employee role updated", employeeId: id });
  } catch (error) {
    logger.error("Update employee role error", { error: error.message });
    res.status(500).json({ error: "Failed to update role" });
  }
};

// PUT /api/v1/admin/employees/:id/status
// Suspend or activate employee
exports.updateEmployeeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'suspended', 'on_leave', 'terminated'].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // Update status
    const result = await pool.query(
      `UPDATE employees SET employment_status = $1, updated_at = now() WHERE id = $2 RETURNING id`,
      [status, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Audit log
    await adminAuthService.auditLog(req.employee.id, 'update_status', 'employee', id, {
      newStatus: status,
    });

    res.json({ message: "Employee status updated", employeeId: id });
  } catch (error) {
    logger.error("Update employee status error", { error: error.message });
    res.status(500).json({ error: "Failed to update status" });
  }
};
