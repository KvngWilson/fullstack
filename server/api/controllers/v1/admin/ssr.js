const { pool } = require("../../../../config/db");
const AdminAuthService = require("../../../../domain/admin/AdminAuthService");
const PERMISSIONS = require("../../../../shared/constants/permissions");
const logger = require("../../../../shared/utils/logger");

const adminAuthService = new AdminAuthService();

/**
 * SSR Context Controller
 * Handles server-side validation for admin pages before hydration
 * Prevents rendering unauthorized admin interfaces to users
 */

/**
 * Middleware: Validate Admin Page Access
 * Applied before SSR rendering of admin pages
 * Returns 401/403 if user lacks required permissions
 * Returns validated props for page hydration if authorized
 */
exports.validateAdminPageAccess = async (req, res, next) => {
  try {
    // Check user is authenticated
    if (!req.user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required",
      });
    }

    // Check user is an employee (has employee_id in session)
    if (!req.employee || !req.employee.id) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Employee access required",
      });
    }

    // Get required permission from request
    const requiredPermission = req.query.permission || null;

    // Validate permission if specified
    if (requiredPermission) {
      const hasPermission = await adminAuthService.hasPermission(
        req.employee.id,
        requiredPermission
      );
      
      if (!hasPermission) {
        return res.status(403).json({
          error: "Unauthorized",
          message: `Permission required: ${requiredPermission}`,
        });
      }
    }

    // Load employee with full details for hydration
    const hydrationData = await adminAuthService.getAdminUserProfile(
      req.employee.id
    );

    // Log access to admin page
    await adminAuthService.auditLog(
      req.employee.id,
      "admin:page-access",
      "admin_page",
      req.path,
      {
        page: req.path,
        permission: requiredPermission,
      }
    );

    // Attach validated props to request for page rendering
    req.ssrProps = {
      user: req.user,
      employee: req.employee,
      hydration: hydrationData,
      timestamp: new Date().toISOString(),
    };

    next();
  } catch (error) {
    logger.error("Admin page access validation failed:", error);
    
    if (error.name === "AuthorizationError") {
      return res.status(403).json({
        error: "Unauthorized",
        message: error.message,
      });
    }

    res.status(500).json({
      error: "Internal server error",
      message: "Failed to validate admin access",
    });
  }
};

/**
 * Middleware: Get SSR Hydration Data
 * Loads data for specific admin page from request context
 */
exports.getSSRHydrationData = async (req, res, next) => {
  try {
    // Check validation already happened
    if (!req.ssrProps) {
      return res.status(500).json({
        error: "Invalid request state",
        message: "SSR validation not completed",
      });
    }

    // Return hydration data to client
    // Client will embed this in initial page state
    res.json({
      success: true,
      hydration: req.ssrProps,
    });
  } catch (error) {
    logger.error("Failed to get SSR hydration data:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
};

/**
 * Get Admin Dashboard Data
 * Returns summary data and available admin functions for dashboard context
 */
exports.getAdminDashboardData = async (req, res) => {
  try {
    // Validate access
    await adminAuthService.validatePermission(req.employee.id, PERMISSIONS.ADMIN.DASHBOARD.READ);

    // Get admin profile with role and permissions
    const profile = await adminAuthService.getAdminUserProfile(req.employee.id);

    // Get summary statistics
    const statsQuery = `
      SELECT
        (SELECT COUNT(*) FROM employees) as total_employees,
        (SELECT COUNT(*) FROM roles) as total_roles,
        (SELECT COUNT(*) FROM permissions) as total_permissions,
        (SELECT COUNT(*) FROM exchange_rates WHERE is_active = true) as active_exchange_rates,
        (SELECT COUNT(*) FROM security_audit_log WHERE created_at > NOW() - INTERVAL '24 hours') as events_24h
    `;

    const stats = await pool.query(statsQuery);

    // Get recent audit events
    const auditQuery = `
      SELECT id, action, resource_type, created_at, employee_id
      FROM security_audit_log
      ORDER BY created_at DESC
      LIMIT 10
    `;

    const audit = await pool.query(auditQuery);

    res.json({
      profile,
      stats: stats.rows[0],
      recentEvents: audit.rows,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.name === "AuthorizationError") {
      return res.status(403).json({
        error: "Unauthorized",
        message: error.message,
      });
    }

    logger.error("Failed to get admin dashboard data:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
};

/**
 * Validate Access for Specific Admin Resource
 * Used by admin pages to verify access before loading data
 */
exports.validateResourceAccess = async (req, res) => {
  try {
    const { resourceType, permission } = req.body;

    if (!resourceType || !permission) {
      return res.status(400).json({
        error: "Bad request",
        message: "resourceType and permission required",
      });
    }

    // Check permission
    const hasAccess = await adminAuthService.hasPermission(
      req.employee.id,
      permission
    );

    if (!hasAccess) {
      return res.status(403).json({
        allowed: false,
        message: `Permission denied: ${permission}`,
      });
    }

    // Log resource access attempt
    await adminAuthService.auditLog(
      req.employee.id,
      "resource:access",
      resourceType,
      "validation",
      { permission }
    );

    res.json({
      allowed: true,
      resourceType,
      permission,
    });
  } catch (error) {
    logger.error("Resource access validation failed:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
};

/**
 * Get Admin UI Configuration
 * Returns available modules and permissions for navigation/menu rendering
 */
exports.getAdminUIConfig = async (req, res) => {
  try {
    // Get all permissions for current employee
    const permissions = await adminAuthService._getEmployeePermissions(
      req.employee.id
    );

    // Determine available admin modules based on permissions
    const availableModules = {
      employees: permissions.some((p) => p.code.startsWith("employee:")),
      roles: permissions.some((p) => p.code.startsWith("role:")),
      permissions: permissions.some((p) => p.code.startsWith("permission:")),
      exchangeRates: permissions.some((p) =>
        p.code.startsWith("exchange-rates:")
      ),
      translations: permissions.some(
        (p) =>
          p.code === "translations:manage"
          || p.code.startsWith("translation:"),
      ),
      auditLogs: permissions.some((p) => p.code.startsWith("audit:")),
      orders: permissions.some((p) => p.code.startsWith("order:")),
      products: permissions.some((p) => p.code.startsWith("product:")),
      users: permissions.some((p) => p.code.startsWith("user:")),
    };

    res.json({
      availableModules,
      permissions: permissions.map((p) => p.code),
      canAccessAdmin: Object.values(availableModules).some((v) => v),
    });
  } catch (error) {
    logger.error("Failed to get admin UI config:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
};

/**
 * SSR Page Props Helper
 * Generates complete props object for admin page rendering
 */
exports.generateSSRProps = async (employeeId, pageType = null) => {
  try {
    const profile = await adminAuthService.getAdminUserProfile(employeeId);
    const permissions = await adminAuthService._getEmployeePermissions(employeeId);
    const role = await pool.query(
      "SELECT r.code, r.name FROM roles r JOIN employees e ON e.role_id = r.id WHERE e.id = $1",
      [employeeId]
    );

    return {
      employee: profile,
      role: role.rows[0],
      permissions: permissions.map((p) => p.code),
      pageType,
      timestamp: new Date().toISOString(),
      // For React SSR, include in initial state
      __SSR_DATA__: true,
    };
  } catch (error) {
    logger.error("Failed to generate SSR props:", error);
    throw error;
  }
};

module.exports = exports;
