const { pool } = require("../../../../config/db");
const AdminAuthService = require("../../../../domain/admin/AdminAuthService");

const adminAuthService = new AdminAuthService();

/**
 * Permissions Controller
 * Manages permissions and their assignments to roles
 */

exports.listPermissions = async (req, res) => {
  try {
    const { category = null, roleId = null } = req.query;

    let query = `
      SELECT 
        p.id,
        p.code,
        p.name,
        p.description,
        p.category,
        COUNT(DISTINCT rp.role_id) as role_count,
        p.created_at
      FROM permissions p
      LEFT JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE 1=1
    `;

    const params = [];

    // Filter by category if provided
    if (category) {
      query += ` AND p.category = $${params.length + 1}`;
      params.push(category);
    }

    // Filter by role if provided
    if (roleId) {
      query += ` AND (
        p.id IN (SELECT permission_id FROM role_permissions WHERE role_id = $${params.length + 1})
        OR p.id NOT IN (SELECT permission_id FROM role_permissions)
      )`;
      params.push(roleId);
    }

    query += ` GROUP BY p.id, p.code ORDER BY p.category, p.code`;

    const result = await pool.query(query, params);

    // Group by category if requested
    const grouped = {};
    for (const perm of result.rows) {
      if (!grouped[perm.category]) {
        grouped[perm.category] = [];
      }
      grouped[perm.category].push(perm);
    }

    res.json({
      total: result.rows.length,
      byCategory: grouped,
      flat: result.rows,
    });
  } catch (error) {
    console.error("Error listing permissions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getPermission = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        p.id,
        p.code,
        p.name,
        p.description,
        p.category,
        ARRAY_AGG(DISTINCT r.id) as role_ids,
        ARRAY_AGG(DISTINCT r.code) as role_codes,
        p.created_at
      FROM permissions p
      LEFT JOIN role_permissions rp ON p.id = rp.permission_id
      LEFT JOIN roles r ON rp.role_id = r.id
      WHERE p.id = $1
      GROUP BY p.id
    `;

    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Permission not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error getting permission:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getPermissionMatrix = async (req, res) => {
  try {
    // Get all roles with hierarchy
    const rolesQuery = `
      SELECT id, code, name, hierarchy_level
      FROM roles
      ORDER BY hierarchy_level ASC, name ASC
    `;

    const rolesResult = await pool.query(rolesQuery);

    // Get all permissions grouped by category
    const permsQuery = `
      SELECT id, code, name, category
      FROM permissions
      ORDER BY category, code
    `;

    const permsResult = await pool.query(permsQuery);

    // Get all role_permissions mappings
    const mappingsQuery = `
      SELECT role_id, permission_id
      FROM role_permissions
    `;

    const mappingsResult = await pool.query(mappingsQuery);

    // Build matrix
    const mappingSet = new Set();
    for (const row of mappingsResult.rows) {
      mappingSet.add(`${row.role_id}:${row.permission_id}`);
    }

    const matrix = {
      roles: rolesResult.rows,
      permissions: permsResult.rows,
      assignments: Array.from(mappingSet).map((entry) => {
        const [roleId, permId] = entry.split(":");
        return { roleId: parseInt(roleId, 10), permissionId: parseInt(permId, 10) };
      }),
    };

    res.json(matrix);
  } catch (error) {
    console.error("Error getting permission matrix:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getPermissionsByCategory = async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT category
      FROM permissions
      ORDER BY category
    `;

    const result = await pool.query(query);
    const categories = result.rows.map((row) => row.category);

    res.json({ categories });
  } catch (error) {
    console.error("Error getting categories:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.createPermission = async (req, res) => {
  try {
    const { code, name, category, description } = req.body;

    // Validation
    if (!code || !name || !category) {
      return res.status(400).json({
        error: "Code, name, and category are required",
      });
    }

    // Check code uniqueness
    const existing = await pool.query(
      "SELECT id FROM permissions WHERE code = $1",
      [code]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: `Permission code '${code}' already exists`,
      });
    }

    // Insert new permission
    const query = `
      INSERT INTO permissions (code, name, category, description, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id, code, name, category, description, created_at
    `;

    const result = await pool.query(query, [code, name, category, description || null]);

    // Audit log
    await adminAuthService.auditLog(
      req.employee.id,
      "permission:create",
      "permission",
      result.rows[0].id,
      { code, name, category }
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating permission:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.updatePermission = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    // Check permission exists
    const existing = await pool.query("SELECT id FROM permissions WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Permission not found" });
    }

    // Build update query (code and category are immutable)
    let updateQuery = "UPDATE permissions SET ";
    const params = [];
    const updates = [];

    if (name !== undefined) {
      updates.push(`name = $${params.length + 1}`);
      params.push(name);
    }

    if (description !== undefined) {
      updates.push(`description = $${params.length + 1}`);
      params.push(description);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    updateQuery += updates.join(", ");
    updateQuery += ` WHERE id = $${params.length + 1}`;
    params.push(id);
    updateQuery += ` RETURNING id, code, name, category, description`;

    const result = await pool.query(updateQuery, params);

    // Audit log
    await adminAuthService.auditLog(
      req.employee.id,
      "permission:update",
      "permission",
      id,
      { changes: { name, description } }
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating permission:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.deletePermission = async (req, res) => {
  try {
    const { id } = req.params;

    // Check permission exists
    const existing = await pool.query("SELECT id, code FROM permissions WHERE id = $1", [
      id,
    ]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Permission not found" });
    }

    // Check if permission is in use
    const inUse = await pool.query(
      "SELECT COUNT(*) FROM role_permissions WHERE permission_id = $1",
      [id]
    );
    if (parseInt(inUse.rows[0].count, 10) > 0) {
      return res.status(400).json({
        error: "Cannot delete permission that is assigned to roles",
      });
    }

    // Delete permission
    await pool.query("DELETE FROM permissions WHERE id = $1", [id]);

    // Audit log
    await adminAuthService.auditLog(
      req.employee.id,
      "permission:delete",
      "permission",
      id,
      { code: existing.rows[0].code }
    );

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting permission:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
