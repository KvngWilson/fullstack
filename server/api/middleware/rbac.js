const { pool } = require("../../config/db");
const { redisClient } = require("../../config/redis");
const { logger } = require("../../shared/utils/logger");
const PermissionService = require("../../shared/core/PermissionService");

// Caches the user → active-employee-id lookup that runs on every RBAC-guarded
// request. Short TTL because a deactivated employee must lose access quickly;
// employment status changes also invalidate explicitly.
const EMPLOYEE_ID_CACHE_PREFIX = "rbac:employee-id:user:";
const EMPLOYEE_ID_CACHE_TTL_SECONDS = parseInt(
  process.env.EMPLOYEE_ID_CACHE_TTL_SECONDS || "300",
  10,
);

/**
 * Permission Checker.
 * Resolves employee permissions from roles and overrides.
 * Now delegates to unified PermissionService to eliminate duplication.
 */
class PermissionChecker {
  /**
   * Get all permissions for an employee
   * Includes role permissions + individual overrides
   */
  static async getEmployeePermissions(employeeId) {
    return PermissionService.getEmployeePermissions(employeeId);
  }

  /**
   * Check if employee has specific permission
   */
  static async hasPermission(employeeId, permissionCode, scope = null) {
    return PermissionService.hasPermission(employeeId, permissionCode, scope);
  }

  /**
   * Check if employee has ANY of the specified permissions
   */
  static async hasAnyPermission(employeeId, permissionCodes) {
    return PermissionService.hasAnyPermission(employeeId, permissionCodes);
  }

  /**
   * Check if employee has ALL specified permissions
   */
  static async hasAllPermissions(employeeId, permissionCodes) {
    return PermissionService.hasAllPermissions(employeeId, permissionCodes);
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
 * Extract employee lookup to reduce duplication in middleware
 * Positive results are cached in Redis; failures always fall back to the DB.
 * @private
 */
async function getEmployeeIdFromUser(userId) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const cacheKey = `${EMPLOYEE_ID_CACHE_PREFIX}${userId}`;

  if (redisClient.isReady) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return Number(cached);
      }
    } catch (error) {
      logger.warn("Employee ID cache read failed, falling back to database", {
        userId,
        error: error.message,
      });
    }
  }

  const result = await pool.query(
    "SELECT id FROM employees WHERE user_id = $1 AND employment_status = 'active'",
    [userId]
  );

  if (result.rowCount === 0) {
    const error = new Error("Access denied. Employee status required.");
    error.status = 403;
    throw error;
  }

  const employeeId = result.rows[0].id;

  if (redisClient.isReady) {
    try {
      await redisClient.set(cacheKey, String(employeeId), {
        EX: EMPLOYEE_ID_CACHE_TTL_SECONDS,
      });
    } catch (error) {
      logger.warn("Employee ID cache write failed", {
        userId,
        error: error.message,
      });
    }
  }

  return employeeId;
}

/**
 * Invalidate the cached user → employee-id mapping.
 * Call when an employee's employment status changes.
 */
async function invalidateEmployeeLookup(userId) {
  if (!redisClient.isReady) return;
  try {
    await redisClient.del(`${EMPLOYEE_ID_CACHE_PREFIX}${userId}`);
  } catch (error) {
    logger.warn("Employee ID cache invalidation failed", {
      userId,
      error: error.message,
    });
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

      const employeeId = await getEmployeeIdFromUser(req.user.id);

      const hasPermission = await PermissionChecker.hasPermission(
        employeeId,
        permissionCode,
        scope
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

      req.employee = {
        id: employeeId,
        userId: req.user.id,
      };

      next();
    } catch (error) {
      if (error.status === 403) {
        logger.warn("RBAC check failed", {
          userId: req.user?.id,
          error: error.message,
        });
        return res.status(403).json({ error: error.message });
      }
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

      const employeeId = await getEmployeeIdFromUser(req.user.id);

      const hasPermission = await PermissionChecker.hasAnyPermission(
        employeeId,
        permissionCodes
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
      if (error.status === 403) {
        return res.status(403).json({ error: error.message });
      }
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

      const employeeId = await getEmployeeIdFromUser(req.user.id);

      const hasPermission = await PermissionChecker.hasAllPermissions(
        employeeId,
        permissionCodes
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
      if (error.status === 403) {
        return res.status(403).json({ error: error.message });
      }
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
  invalidateEmployeeLookup,
};
