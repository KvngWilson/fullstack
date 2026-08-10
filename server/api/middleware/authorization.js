/**
 * Authorization Middleware.
 * Enforces authentication, role-based access, and permission-based access control.
 */
const { errorResponse } = require("../..//shared/utils/response");
const domain = require("../../domain");
const permissionService = domain.identity.services.PermissionService;

function assertAuthenticated(req, res) {
  if (!req.user) {
    errorResponse(res, { message: "Unauthorized", status: 401 });
    return false;
  }
  return true;
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!assertAuthenticated(req, res)) return;

    if (!roles.includes(req.user.role)) {
      return errorResponse(res, {
        message: `Access denied. Required role: ${roles.join(" or ")}`,
        status: 403,
      });
    }

    return next();
  };
}

const requireAdmin = requireRole("admin");
const requireCustomer = requireRole("customer", "admin");

function authorize(permission) {
  return async (req, res, next) => {
    if (!assertAuthenticated(req, res)) return;

    if (!permission) {
      return errorResponse(res, {
        message: "Access denied",
        status: 403,
      });
    }

    const allowed = await permissionService.hasPermission(req.user, permission);
    if (!allowed) {
      return errorResponse(res, {
        message: "Forbidden",
        status: 403,
      });
    }

    return next();
  };
}

function requirePermission(permission) {
  return authorize(permission);
}

function requireAnyPermission(permissions = []) {
  return async (req, res, next) => {
    if (!assertAuthenticated(req, res)) return;

    const allowed = await permissionService.hasAnyPermission(req.user, permissions);
    if (!allowed) {
      return errorResponse(res, {
        message: "Forbidden",
        status: 403,
      });
    }

    return next();
  };
}

function requireAllPermissions(permissions = []) {
  return async (req, res, next) => {
    if (!assertAuthenticated(req, res)) return;

    const allowed = await permissionService.hasAllPermissions(req.user, permissions);
    if (!allowed) {
      return errorResponse(res, {
        message: "Forbidden",
        status: 403,
      });
    }

    return next();
  };
}

function requireTenantAccess(getVendorId) {
  return (req, res, next) => {
    const vendorId = getVendorId(req);

    const hasAccess = req.user.roles.some(
      r =>
        r.vendorId === vendorId ||
        r.role === "platform_admin"
    );

    if (!hasAccess) {
      return errorResponse(res, {
        message: "Tenant access denied",
        status: 403,
      });
    }

    req.vendorId = vendorId;
    next();
  };
}

// Ownership-based access control middleware
function requireOwnership({ getResource }) {
  if (typeof getResource !== "function") {
    throw new Error("requireOwnership requires a getResource function");
  }

  return async (req, res, next) => {
    if (!assertAuthenticated(req, res)) return;

    // Admin bypass
    if (req.user.role === "admin") {
      req.isAdmin = true;
      return next();
    }

    try {
      const resource = await getResource(req);

      if (!resource) {
        return errorResponse(res, {
          message: "Resource not found",
          status: 404,
        });
      }

      if (resource.user_id !== req.user.id) {
        return errorResponse(res, {
          message: "Forbidden",
          status: 403,
        });
      }

      req.resource = resource;
      req.isAdmin = false;

      return next();
    } catch (err) {
      return errorResponse(res, {
        message: err,
        status: 500,
      });
    }
  };
}

module.exports = {
  authorize,
  requireRole,
  requireAdmin,
  requireCustomer,
  requireOwnership,
  requireTenantAccess,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
};
