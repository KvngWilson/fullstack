const { pool } = require("../../../../config/db");
const AdminAuthService = require("../../../../domain/admin/AdminAuthService");
const PermissionService = require("../../../../shared/core/PermissionService");

const adminAuthService = new AdminAuthService();

/**
 * Roles Controller
 * Manages roles, permissions assignments, and role hierarchy
 */

exports.listRoles = async (req, res) => {
  try {
    const { includePermissions = false, hierarchyLevel = null } = req.query;

    let query = `
      SELECT 
        r.id,
        r.code,
        r.name,
        r.description,
        r.hierarchy_level,
        r.is_system,
        r.vendor_id,
        COUNT(DISTINCT rp.permission_id) as permission_count,
        r.created_at,
        r.updated_at
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      WHERE 1=1
    `;

    const params = [];

    // Filter by hierarchy level if provided
    if (hierarchyLevel !== null) {
      query += ` AND r.hierarchy_level = $${params.length + 1}`;
      params.push(parseInt(hierarchyLevel, 10));
    }

    // Exclude system roles if user is not super_admin
    const userRole = await pool.query(
      "SELECT r.code FROM roles r WHERE r.id = $1",
      [
        (
          await pool.query("SELECT role_id FROM employees WHERE id = $1", [
            req.employee.id,
          ])
        ).rows[0].role_id,
      ],
    );

    if (userRole.rows[0].code !== "super_admin") {
      query += ` AND r.is_system = false`;
    }

    query += ` GROUP BY r.id ORDER BY r.hierarchy_level ASC, r.name ASC`;

    const result = await pool.query(query, params);

    // Optionally include permissions for each role
    if (includePermissions === "true") {
      for (const role of result.rows) {
        const permsQuery = `
          SELECT p.id, p.code, p.name, p.category
          FROM permissions p
          JOIN role_permissions rp ON p.id = rp.permission_id
          WHERE rp.role_id = $1
          ORDER BY p.category, p.code
        `;
        const permsResult = await pool.query(permsQuery, [role.id]);
        role.permissions = permsResult.rows;
      }
    }

    res.json(result.rows);
  } catch (error) {
    console.error("Error listing roles:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.createRole = async (req, res) => {
  try {
    const { code, name, description, hierarchyLevel } = req.body;

    // Validation
    if (!code || !name) {
      return res.status(400).json({ error: "Code and name are required" });
    }

    if (
      typeof hierarchyLevel !== "number" ||
      hierarchyLevel < 0 ||
      hierarchyLevel > 100
    ) {
      return res.status(400).json({
        error: "Hierarchy level must be a number between 0 and 100",
      });
    }

    // Check code uniqueness
    const existing = await pool.query("SELECT id FROM roles WHERE code = $1", [
      code,
    ]);
    if (existing.rows.length > 0) {
      return res
        .status(400)
        .json({ error: `Role code '${code}' already exists` });
    }

    // Insert new role
    const query = `
      INSERT INTO roles (code, name, description, hierarchy_level, is_system, created_at, updated_at)
      VALUES ($1, $2, $3, $4, false, NOW(), NOW())
      RETURNING id, code, name, description, hierarchy_level, created_at
    `;

    const result = await pool.query(query, [
      code,
      name,
      description || null,
      hierarchyLevel,
    ]);

    // Audit log
    await adminAuthService.auditLog(
      req.employee.id,
      "role:create",
      "role",
      result.rows[0].id,
      { code, name, hierarchyLevel },
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating role:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getRoleWithPermissions = async (req, res) => {
  try {
    const { id } = req.params;

    // Get role
    const roleQuery = `
      SELECT 
        id, code, name, description, hierarchy_level, is_system, created_at, updated_at
      FROM roles
      WHERE id = $1
    `;

    const roleResult = await pool.query(roleQuery, [id]);
    if (roleResult.rows.length === 0) {
      return res.status(404).json({ error: "Role not found" });
    }

    const role = roleResult.rows[0];

    // Get permissions for this role
    const permsQuery = `
      SELECT 
        p.id, 
        p.code, 
        p.name, 
        p.category,
        p.description,
        rp.created_at as assigned_at
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = $1
      ORDER BY p.category, p.code
    `;

    const permsResult = await pool.query(permsQuery, [id]);
    role.permissions = permsResult.rows;

    // Get override permissions for this role
    const overrideQuery = `
      SELECT 
        permission_id,
        is_granted,
        reason
      FROM employee_permission_overrides
      WHERE role_id = $1
      ORDER BY created_at DESC
    `;

    const overrideResult = await pool.query(overrideQuery, [id]);
    role.overrides = overrideResult.rows;

    res.json(role);
  } catch (error) {
    if (error.name === "NotFoundError") {
      return res.status(404).json({ error: error.message });
    }
    console.error("Error getting role:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, hierarchyLevel } = req.body;

    // Check role exists
    const existing = await pool.query(
      "SELECT id, code FROM roles WHERE id = $1",
      [id],
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Role not found" });
    }

    // Cannot update system roles
    const roleCheck = await pool.query(
      "SELECT is_system FROM roles WHERE id = $1",
      [id],
    );
    if (roleCheck.rows[0].is_system) {
      return res.status(403).json({ error: "Cannot modify system roles" });
    }

    // Build update query
    let updateQuery = "UPDATE roles SET updated_at = NOW()";
    const params = [];

    if (name !== undefined) {
      updateQuery += `, name = $${params.length + 1}`;
      params.push(name);
    }

    if (description !== undefined) {
      updateQuery += `, description = $${params.length + 1}`;
      params.push(description);
    }

    if (hierarchyLevel !== undefined) {
      if (
        typeof hierarchyLevel !== "number" ||
        hierarchyLevel < 0 ||
        hierarchyLevel > 100
      ) {
        return res.status(400).json({
          error: "Hierarchy level must be a number between 0 and 100",
        });
      }
      updateQuery += `, hierarchy_level = $${params.length + 1}`;
      params.push(hierarchyLevel);
    }

    updateQuery += ` WHERE id = $${params.length + 1} RETURNING id, code, name, description, hierarchy_level`;
    params.push(id);

    const result = await pool.query(updateQuery, params);

    // Audit log
    await adminAuthService.auditLog(
      req.employee.id,
      "role:update",
      "role",
      id,
      { changes: { name, description, hierarchyLevel } },
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating role:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.assignPermissionsToRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissionIds } = req.body;

    if (!Array.isArray(permissionIds)) {
      return res.status(400).json({ error: "permissionIds must be an array" });
    }

    // Check role exists
    const roleCheck = await pool.query("SELECT id FROM roles WHERE id = $1", [
      id,
    ]);
    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ error: "Role not found" });
    }

    // Clear existing permissions for this role
    await pool.query("DELETE FROM role_permissions WHERE role_id = $1", [id]);

    // Insert new permissions
    if (permissionIds.length > 0) {
      let insertQuery =
        "INSERT INTO role_permissions (role_id, permission_id) VALUES ";
      const params = [id];
      const placeholders = [];

      for (let i = 0; i < permissionIds.length; i++) {
        params.push(permissionIds[i]);
        placeholders.push(`($1, $${i + 2})`);
      }

      insertQuery += placeholders.join(", ");
      await pool.query(insertQuery, params);
    }

    // Audit log
    await adminAuthService.auditLog(
      req.employee.id,
      "role:permissions",
      "role",
      id,
      { permissionIds },
    );

    // Role permissions affect every employee holding the role
    await PermissionService.invalidateAllPermissions();

    res.json({
      success: true,
      roleId: id,
      permissionCount: permissionIds.length,
    });
  } catch (error) {
    console.error("Error assigning permissions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    // Check role exists
    const roleCheck = await pool.query(
      "SELECT id, is_system, code FROM roles WHERE id = $1",
      [id],
    );
    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ error: "Role not found" });
    }

    // Cannot delete system roles
    if (roleCheck.rows[0].is_system) {
      return res.status(403).json({ error: "Cannot delete system roles" });
    }

    // Check if role is in use
    const inUse = await pool.query(
      "SELECT COUNT(*) FROM employees WHERE role_id = $1",
      [id],
    );
    if (parseInt(inUse.rows[0].count, 10) > 0) {
      return res.status(400).json({
        error: "Cannot delete role that is assigned to employees",
      });
    }

    // Delete role (cascades to role_permissions)
    await pool.query("DELETE FROM roles WHERE id = $1", [id]);

    // Audit log
    await adminAuthService.auditLog(
      req.employee.id,
      "role:delete",
      "role",
      id,
      { code: roleCheck.rows[0].code },
    );

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting role:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
