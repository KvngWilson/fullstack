const { pool } = require("../../config/db");
const BaseService = require("../base/BaseService");
const PERMISSIONS = require("../../shared/constants/permissions");
const { AuthorizationError, NotFoundError } = require("../../shared/utils/errors");
const { logger } = require("../../shared/utils/logger");

/**
 * Admin Authentication & Authorization Service
 * Provides server-side validation for SSR admin pages
 * 
 * Usage in controller:
 * ```
 * const adminAuthService = new AdminAuthService();
 * const props = await adminAuthService.validateAdminPageAccess(req.user, req.employee, 'order:read');
 * // props contains authenticated user data safe for SSR hydration
 * ```
 */
class AdminAuthService extends BaseService {
  /**
   * Validate that user can access an admin page.
   * Returns authenticated data safe for SSR hydration.
   * Throws AuthorizationError if user cannot access.
   *
   * @param {object} user - User object from session (req.user)
   * @param {object} employee - Employee object from session (req.employee)
   * @param {string} requiredPermission - Permission code required (e.g., 'order:read')
   * @returns {Promise<object>} Safe data for SSR hydration
   */
  async validateAdminPageAccess(user, employee, requiredPermission) {
    if (!requiredPermission || typeof requiredPermission !== 'string') {
      throw new AuthorizationError('Access denied: Permission is required');
    }

    if (!user || !user.id) {
      logger.warn("Unauthorized admin page access: No authenticated user");
      throw new AuthorizationError("Unauthorized: Not logged in");
    }

    if (!employee || !employee.id) {
      logger.warn("Unauthorized admin page access: User is not an employee", {
        userId: user.id,
      });
      throw new AuthorizationError(
        "Access denied: Employee access required",
        { userId: user.id }
      );
    }

    await this.validatePermission(employee.id, requiredPermission);

    await this.auditLog(employee.id, 'access', 'admin_page', null, {
      permission: requiredPermission,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
      },
      employee: {
        id: employee.id,
        userId: employee.userId,
      },
    };
  }

  /**
   * Get full admin user profile for dashboard
   */
  async getAdminUserProfile(employeeId) {
    await this.validatePermission(employeeId, PERMISSIONS.ADMIN.DASHBOARD.READ);

    const result = await pool.query(
      `SELECT 
        u.id, u.email, u.first_name, u.last_name,
        e.id as employee_id,
        r.code as role_code, r.name as role_name, r.hierarchy_level
      FROM employees e
      JOIN users u ON e.user_id = u.id
      JOIN roles r ON e.role_id = r.id
      WHERE e.id = $1 AND e.employment_status = 'active'`,
      [employeeId]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError("Employee profile not found");
    }

    return result.rows[0];
  }

  /**
   * Validate employee can perform sensitive action
   * Returns employee details if authorized
   */
  async validateSensitiveAction(employeeId, action, targetResourceId = null) {
    const result = await pool.query(
      `SELECT 
        e.id, e.user_id,
        r.code as role_code, r.hierarchy_level,
        u.email
      FROM employees e
      JOIN roles r ON e.role_id = r.id
      JOIN users u ON e.user_id = u.id
      WHERE e.id = $1 AND e.employment_status = 'active'`,
      [employeeId]
    );

    if (result.rowCount === 0) {
      throw new AuthorizationError("Employee not found or inactive");
    }

    const employee = result.rows[0];

    // Additional validation: check if this is a sensitive action
    const sensitiveActions = [
      PERMISSIONS.ADMIN.USERS.DELETE,
      PERMISSIONS.ADMIN.USERS.LOCK,
      PERMISSIONS.ORDER.CANCEL,
      PERMISSIONS.PAYMENT.REFUND,
      PERMISSIONS.SECURITY.MANAGE,
    ];

    if (sensitiveActions.includes(action)) {
      await this.auditLog(employeeId, action, targetResourceId || 'unknown', null, {
        timestamp: new Date().toISOString(),
      });
    }

    return employee;
  }

  /**
   * Check if employee can manage other employee
   * (Hierarchy-based access control)
   */
  async canManageEmployee(managerId, targetEmployeeId) {
    const result = await pool.query(
      `SELECT 
        manager_role.hierarchy_level AS manager_level,
        target_role.hierarchy_level AS target_level
      FROM employees manager_employee
      JOIN roles manager_role ON manager_employee.role_id = manager_role.id
      JOIN employees target_employee ON target_employee.id = $2
      JOIN roles target_role ON target_employee.role_id = target_role.id
      WHERE manager_employee.id = $1
        AND manager_employee.employment_status = 'active'
        AND target_employee.employment_status = 'active'`,
      [managerId, targetEmployeeId]
    );

    if (result.rowCount === 0) {
      return false;
    }

    const { manager_level, target_level } = result.rows[0];

    return manager_level > target_level;
  }

  /**
   * Get list of employees a manager can access
   */
  async getAccessibleEmployees(employeeId) {
    const managerResult = await pool.query(
      `SELECT r.hierarchy_level
       FROM employees e
       JOIN roles r ON e.role_id = r.id
       WHERE e.id = $1`,
      [employeeId]
    );

    if (managerResult.rowCount === 0) {
      throw new AuthorizationError("Employee not found");
    }

    const { hierarchy_level } = managerResult.rows[0];

    const result = await pool.query(
      `SELECT 
        e.id, u.email, u.first_name, u.last_name,
        r.code as role_code, r.name as role_name,
        e.employment_status
      FROM employees e
      JOIN users u ON e.user_id = u.id
      JOIN roles r ON e.role_id = r.id
      WHERE r.hierarchy_level < $1
        AND e.employment_status = 'active'
      ORDER BY u.last_name, u.first_name`,
      [hierarchy_level]
    );

    return result.rows;
  }

  /**
   * Validate email for new employee invitation
   */
  async validateEmailForInvitation(email) {
    const result = await pool.query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1)`,
      [email]
    );

    if (result.rowCount > 0) {
      throw new AuthorizationError(
        `User with email ${email} already exists`,
        { email }
      );
    }

    // Could add additional email validation here
    return true;
  }

  /**
   * Check if employee has specific permission (for UI conditionals)
   * Safe to call from controllers to determine what's allowed
   */
  async hasPermission(employeeId, permissionCode, scope = null) {
    try {
      const permissions = await this._getEmployeePermissions(employeeId);
      
      return permissions.some((p) => {
        if (p.code !== permissionCode) return false;
        if (scope && p.scope) {
          return p.scope === scope;
        }
        return true;
      });
    } catch (error) {
      logger.error("Permission check failed", { error: error.message });
      return false;
    }
  }

  /**
   * Get all permissions for an employee (for UI permission state)
   */
  async getEmployeePermissions(employeeId) {
    await this.validatePermission(employeeId, PERMISSIONS.ADMIN.DASHBOARD.READ);
    return await this._getEmployeePermissions(employeeId);
  }
}

module.exports = AdminAuthService;
