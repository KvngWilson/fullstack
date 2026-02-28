const { pool } = require("../../config/db");
const { logger } = require("../../utils/logger");

class PermissionChecker {
  /**
   * Get all permissions for an employee
   * Includes role permissions + individual overrides
   */
  static async getEmployeePermissions(employeeId) {
    try {
      const result = await pool.query(
        `WITH role_perms AS (
          SELECT DISTINCT p.code, p.id, NULL::varchar AS scope, 'role' AS source
          FROM employees e
          JOIN roles r ON e.role_id = r.id
          JOIN role_permissions rp ON r.id = rp.role_id
          JOIN permissions p ON rp.permission_id = p.id
          WHERE e.id = $1 AND r.is_active AND p.is_active
        ),
        override_perms AS (
          SELECT DISTINCT p.code, p.id, epo.scope, 'override' AS source
          FROM employee_permission_overrides epo
          JOIN permissions p ON epo.permission_id = p.id
          WHERE epo.employee_id = $1 
            AND epo.grant_type = 'grant'
            AND (epo.valid_until IS NULL OR epo.valid_until > now())
            AND epo.valid_from <= now()
            AND p.is_active
        ),
        revoked_perms AS (
          SELECT DISTINCT p.code
          FROM employee_permission_overrides epo
          JOIN permissions p ON epo.permission_id = p.id
          WHERE epo.employee_id = $1 
            AND epo.grant_type = 'revoke'
            AND (epo.valid_until IS NULL OR epo.valid_until > now())
        )
        SELECT code, id, scope, source
        FROM (SELECT * FROM role_perms UNION ALL SELECT * FROM override_perms) combined
        WHERE code NOT IN (SELECT code FROM revoked_perms)
        ORDER BY code`,
        [employeeId],
      );

      return result.rows;
    } catch (error) {
      logger.error("Failed to fetch employee permissions", {
        employeeId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Check if employee has specific permission
   */
  static async hasPermission(employeeId, permissionCode, scope = null) {
    try {
      const permissions =
        await PermissionChecker.getEmployeePermissions(employeeId);

      // Find matching permission
      const hasPermission = permissions.some((p) => {
        // Exact code match
        if (p.code === permissionCode) {
          // If scope specified, must match or be null (unrestricted)
          if (scope) {
            return !p.scope || p.scope === scope;
          }
          return true;
        }
        return false;
      });

      return hasPermission;
    } catch (error) {
      logger.error("Permission check failed", {
        employeeId,
        permissionCode,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Check if employee has ANY of the specified permissions
   */
  static async hasAnyPermission(employeeId, permissionCodes) {
    try {
      const permissions =
        await PermissionChecker.getEmployeePermissions(employeeId);

      return permissions.some((p) => permissionCodes.includes(p.code));
    } catch (error) {
      logger.error("Multi-permission check failed", {
        employeeId,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Check if employee has ALL specified permissions
   */
  static async hasAllPermissions(employeeId, permissionCodes) {
    try {
      const permissions =
        await PermissionChecker.getEmployeePermissions(employeeId);
      const permissionSet = new Set(permissions.map((p) => p.code));

      return permissionCodes.every((code) => permissionSet.has(code));
    } catch (error) {
      logger.error("All-permissions check failed", {
        employeeId,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Get employee role details with hierarchy
   */
  static async getEmployeeRole(employeeId) {
    try {
      const result = await pool.query(
        `SELECT r.id, r.code, r.name, r.hierarchy_level, r.description
         FROM employees e
         JOIN roles r ON e.role_id = r.id
         WHERE e.id = $1`,
        [employeeId],
      );

      return result.rowCount > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error("Failed to fetch employee role", {
        employeeId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get all employees at or below a certain hierarchy level
   */
  static async getSubordinateRoles(hierarchyLevel) {
    try {
      const result = await pool.query(
        `SELECT id, code, name, hierarchy_level
         FROM roles
         WHERE hierarchy_level <= $1 AND is_active
         ORDER BY hierarchy_level DESC`,
        [hierarchyLevel],
      );

      return result.rows;
    } catch (error) {
      logger.error("Failed to fetch subordinate roles", {
        error: error.message,
      });
      throw error;
    }
  }
}

/**
 * RBAC Middleware for Express
 */
function requirePermission(permissionCode, scope = null) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get employee ID associated with user
      const employeeResult = await pool.query(
        "SELECT id FROM employees WHERE user_id = $1 AND employment_status = 'active'",
        [req.user.id],
      );

      if (employeeResult.rowCount === 0) {
        logger.warn("Non-employee user attempted to access protected route", {
          userId: req.user.id,
          permission: permissionCode,
        });
        return res.status(403).json({
          error: "Access denied. Employee status required.",
        });
      }

      const employeeId = employeeResult.rows[0].id;
      const hasPermission = await PermissionChecker.hasPermission(
        employeeId,
        permissionCode,
        scope,
      );

      if (!hasPermission) {
        logger.warn("Permission denied", {
          userId: req.user.id,
          employeeId,
          permission: permissionCode,
          ip: req.ip,
        });

        return res.status(403).json({
          error: `Permission denied: ${permissionCode}`,
        });
      }

      // Attach employee info to request
      req.employee = {
        id: employeeId,
        userId: req.user.id,
      };

      next();
    } catch (error) {
      logger.error("RBAC middleware error", { error: error.message });
      return res.status(500).json({ error: "Internal server error" });
    }
  };
}

/**
 * RBAC Middleware for multiple permissions (ANY)
 */
function requireAnyPermission(permissionCodes) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const employeeResult = await pool.query(
        "SELECT id FROM employees WHERE user_id = $1 AND employment_status = 'active'",
        [req.user.id],
      );

      if (employeeResult.rowCount === 0) {
        return res.status(403).json({
          error: "Access denied. Employee status required.",
        });
      }

      const employeeId = employeeResult.rows[0].id;
      const hasPermission = await PermissionChecker.hasAnyPermission(
        employeeId,
        permissionCodes,
      );

      if (!hasPermission) {
        logger.warn("Permission denied (any check)", {
          userId: req.user.id,
          permissions: permissionCodes,
        });
        return res.status(403).json({
          error: "Permission denied",
        });
      }

      req.employee = {
        id: employeeId,
        userId: req.user.id,
      };

      next();
    } catch (error) {
      logger.error("RBAC middleware error", { error: error.message });
      return res.status(500).json({ error: "Internal server error" });
    }
  };
}

/**
 * RBAC Middleware for multiple permissions (ALL)
 */
function requireAllPermissions(permissionCodes) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const employeeResult = await pool.query(
        "SELECT id FROM employees WHERE user_id = $1 AND employment_status = 'active'",
        [req.user.id],
      );

      if (employeeResult.rowCount === 0) {
        return res.status(403).json({
          error: "Access denied. Employee status required.",
        });
      }

      const employeeId = employeeResult.rows[0].id;
      const hasPermission = await PermissionChecker.hasAllPermissions(
        employeeId,
        permissionCodes,
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: "Permission denied. Multiple permissions required.",
        });
      }

      req.employee = {
        id: employeeId,
        userId: req.user.id,
      };

      next();
    } catch (error) {
      logger.error("RBAC middleware error", { error: error.message });
      return res.status(500).json({ error: "Internal server error" });
    }
  };
}

module.exports = {
  PermissionChecker,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
};
