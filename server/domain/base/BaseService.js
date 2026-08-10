const { pool } = require("../../config/db");
const { AuthorizationError } = require("../../shared/utils/errors");
const { logger } = require("../../shared/utils/logger");
const PermissionService = require("../../shared/core/PermissionService");

/**
 * Base Service class with RBAC validation built-in.
 * All domain services should extend this class.
 */
class BaseService {
  /**
   * Validate that employee has required permission before executing operation
   * This is the APPLICATION-LEVEL guard (in addition to middleware guard)
   *
   * @param {number} employeeId - Employee ID from session
   * @param {string} permissionCode - Permission to check (e.g., 'order:read', 'order:update')
   * @param {object} context - Additional context for scope-based validation
   *
   * @throws {AuthorizationError} if employee lacks permission
   */
  async validatePermission(employeeId, permissionCode, context = {}) {
    try {
      const permissions = await PermissionService.getEmployeePermissions(employeeId);

      const hasPermission = permissions.some((p) => {
        if (p.code !== permissionCode) return false;

        // Scope-based validation for context-specific permissions
        if (context.scope && p.scope) {
          return p.scope === context.scope;
        }
        return true;
      });

      if (!hasPermission) {
        logger.warn("Permission denied by service", {
          employeeId,
          permission: permissionCode,
          context,
        });
        throw new AuthorizationError(
          `Permission denied: ${permissionCode}`,
          { permission: permissionCode, context }
        );
      }

      return true;
    } catch (error) {
      if (error instanceof AuthorizationError) throw error;
      logger.error("Permission validation failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Validate cross-tenant isolation: ensure employee belongs to correct vendor/tenant
   *
   * @param {number} employeeId - Employee ID
   * @param {number} vendorId - Vendor ID being accessed
   *
   * @throws {AuthorizationError} if employee doesn't belong to vendor (unless admin)
   */
  async validateVendorAccess(employeeId, vendorId) {
    try {
      // Get employee's vendor (if vendor staff) or admin status
      const result = await pool.query(
        `SELECT 
          e.id,
          vs.vendor_id,
          r.code as role_code
         FROM employees e
         LEFT JOIN vendor_staff vs ON e.user_id = vs.user_id
         JOIN roles r ON e.role_id = r.id
         WHERE e.id = $1`,
        [employeeId]
      );

      if (result.rowCount === 0) {
        throw new AuthorizationError("Employee not found");
      }

      const employee = result.rows[0];

      // Super admin and admin can access all vendors
      if (["super_admin", "admin"].includes(employee.role_code)) {
        return true;
      }

      // Vendor staff can only access their own vendor
      if (employee.vendor_id !== vendorId) {
        logger.warn("Cross-tenant access attempt blocked", {
          employeeId,
          attemptedVendorId: vendorId,
          userVendorId: employee.vendor_id,
        });
        throw new AuthorizationError(
          "Access denied: Vendor mismatch",
          { requiredVendorId: employee.vendor_id, attemptedVendorId: vendorId }
        );
      }

      return true;
    } catch (error) {
      if (error instanceof AuthorizationError) throw error;
      logger.error("Vendor access validation failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Log sensitive operation for audit trail
   */
  async auditLog(employeeId, action, resource, resourceId, metadata = {}) {
    try {
      await pool.query(
        `INSERT INTO security_audit_log 
         (event_type, actor_id, description, metadata)
         VALUES ($1, $2, $3, $4)`,
        [`${resource}:${action}`, employeeId, `${action} ${resource}`, JSON.stringify(metadata)]
      );
    } catch (error) {
      logger.error("Audit log failed", { error: error.message });
      // Don't throw - audit failure shouldn't stop operation
    }
  }
}

module.exports = BaseService;
