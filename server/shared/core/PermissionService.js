const { pool } = require("../../config/db");
const { redisClient } = require("../../config/redis");
const { logger } = require("../utils/logger");

// Redis cache settings. Cache failures always fall back to the database.
const PERMISSION_CACHE_PREFIX = "rbac:perms:employee:";
const PERMISSION_CACHE_TTL_SECONDS = parseInt(
  process.env.PERMISSION_CACHE_TTL_SECONDS || "1800",
  10,
);

async function readPermissionCache(employeeId) {
  if (!redisClient.isReady) return null;
  try {
    const cached = await redisClient.get(`${PERMISSION_CACHE_PREFIX}${employeeId}`);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    logger.warn("Permission cache read failed, falling back to database", {
      employeeId,
      error: error.message,
    });
    return null;
  }
}

async function writePermissionCache(employeeId, permissions) {
  if (!redisClient.isReady) return;
  try {
    await redisClient.set(
      `${PERMISSION_CACHE_PREFIX}${employeeId}`,
      JSON.stringify(permissions),
      { EX: PERMISSION_CACHE_TTL_SECONDS },
    );
  } catch (error) {
    logger.warn("Permission cache write failed", {
      employeeId,
      error: error.message,
    });
  }
}

/**
 * Unified permission resolution service.
 * Single source of truth for employee permission logic.
 * Replaces duplicated implementations in BaseService and rbac.js
 *
 * Permissions are cached in Redis per employee (TTL via
 * PERMISSION_CACHE_TTL_SECONDS, default 30 min). Mutation endpoints must call
 * invalidateEmployeePermissions() / invalidateAllPermissions() so changes
 * take effect before the TTL expires.
 */
class PermissionService {
  /**
   * Get all permissions for an employee (role + overrides - revokes)
   * Combines role-based permissions with employee-specific overrides
   * @param {number} employeeId - Employee ID
   * @returns {Promise<Array>} Permission objects with {code, id, scope, source}
   */
  static async getEmployeePermissions(employeeId) {
    const cached = await readPermissionCache(employeeId);
    if (cached) return cached;

    try {
      const result = await pool.query(
        `WITH role_perms AS (
          SELECT DISTINCT
            COALESCE(
              NULLIF(TRIM(p.code), ''),
              CONCAT_WS(':', NULLIF(TRIM(p.resource), ''), NULLIF(TRIM(p.action), ''))
            ) AS code,
            p.id,
            NULL::varchar AS scope,
            'role' AS source
          FROM employees e
          JOIN roles r ON e.role_id = r.id
          JOIN role_permissions rp ON r.id = rp.role_id
          JOIN permissions p ON rp.permission_id = p.id
          WHERE e.id = $1 AND r.is_active AND p.is_active
        ),
        override_perms AS (
          SELECT DISTINCT
            COALESCE(
              NULLIF(TRIM(p.code), ''),
              CONCAT_WS(':', NULLIF(TRIM(p.resource), ''), NULLIF(TRIM(p.action), ''))
            ) AS code,
            p.id,
            epo.scope,
            'override' AS source
          FROM employee_permission_overrides epo
          JOIN permissions p ON epo.permission_id = p.id
          WHERE epo.employee_id = $1
            AND epo.grant_type = 'grant'
            AND (epo.valid_until IS NULL OR epo.valid_until > now())
            AND epo.valid_from <= now()
            AND p.is_active
        ),
        revoked_perms AS (
          SELECT DISTINCT
            COALESCE(
              NULLIF(TRIM(p.code), ''),
              CONCAT_WS(':', NULLIF(TRIM(p.resource), ''), NULLIF(TRIM(p.action), ''))
            ) AS code
          FROM employee_permission_overrides epo
          JOIN permissions p ON epo.permission_id = p.id
          WHERE epo.employee_id = $1
            AND epo.grant_type = 'revoke'
            AND (epo.valid_until IS NULL OR epo.valid_until > now())
        )
        SELECT code, id, scope, source
        FROM (SELECT * FROM role_perms UNION ALL SELECT * FROM override_perms) combined
        WHERE code IS NOT NULL
          AND code NOT IN (SELECT code FROM revoked_perms WHERE code IS NOT NULL)
        ORDER BY code`,
        [employeeId]
      );

      await writePermissionCache(employeeId, result.rows);

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
   * Invalidate the cached permissions for a single employee.
   * Call after role reassignment or permission override changes.
   */
  static async invalidateEmployeePermissions(employeeId) {
    if (!redisClient.isReady) return;
    try {
      await redisClient.del(`${PERMISSION_CACHE_PREFIX}${employeeId}`);
    } catch (error) {
      logger.warn("Permission cache invalidation failed", {
        employeeId,
        error: error.message,
      });
    }
  }

  /**
   * Invalidate every cached employee permission set.
   * Call after role-level or permission-definition changes, which can affect
   * any number of employees.
   */
  static async invalidateAllPermissions() {
    if (!redisClient.isReady) return;
    try {
      const keys = [];
      for await (const entry of redisClient.scanIterator({
        MATCH: `${PERMISSION_CACHE_PREFIX}*`,
        COUNT: 100,
      })) {
        // node-redis v4 yields strings, v5 yields batches of strings
        if (Array.isArray(entry)) {
          keys.push(...entry);
        } else {
          keys.push(entry);
        }
      }
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    } catch (error) {
      logger.warn("Bulk permission cache invalidation failed", {
        error: error.message,
      });
    }
  }

  /**
   * Check if employee has a specific permission
   * @param {number} employeeId - Employee ID
   * @param {string} permissionCode - Permission code to check (e.g., 'product:read')
   * @param {string|null} scope - Optional scope restriction
   * @returns {Promise<boolean>} True if permission granted
   */
  static async hasPermission(employeeId, permissionCode, scope = null) {
    try {
      const permissions = await PermissionService.getEmployeePermissions(employeeId);

      const hasPermission = permissions.some((p) => {
        if (p.code !== permissionCode) return false;
        if (scope && p.scope && p.scope !== scope) return false;
        return true;
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
   * @param {number} employeeId - Employee ID
   * @param {string[]} permissionCodes - Array of permission codes
   * @returns {Promise<boolean>} True if any permission granted
   */
  static async hasAnyPermission(employeeId, permissionCodes) {
    try {
      const permissions = await PermissionService.getEmployeePermissions(employeeId);
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
   * Check if employee has ALL of the specified permissions
   * @param {number} employeeId - Employee ID
   * @param {string[]} permissionCodes - Array of permission codes
   * @returns {Promise<boolean>} True if all permissions granted
   */
  static async hasAllPermissions(employeeId, permissionCodes) {
    try {
      const permissions = await PermissionService.getEmployeePermissions(employeeId);
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
}

module.exports = PermissionService;
