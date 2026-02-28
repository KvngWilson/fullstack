const { ROLE_PERMISSIONS } = require("../../config/permissions");
const { errorResponse } = require("../../utils/response");

// Helper to assert authentication and send error if not authenticated
function assertAuthenticated(req, res) {
  if (!req.user) {
    errorResponse(res, { message: "Unauthorized", status: 401 });
    return false;
  }
  return true;
}

// Role-based access control middleware
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

// Admin-only access
const requireAdmin = requireRole("admin");

// Customer-only access (admin can still access if needed, but this is for routes that should primarily be for customers)
const requireCustomer = requireRole("customer", "admin");

// Permission-based access control middleware
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, { message: "Unauthorized", status: 401 });
    }

    if (!req.user.permissions.includes(permission)) {
      return errorResponse(res, { message: "Forbidden", status: 403 });
    }

    next();
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
  requireRole,
  requireAdmin,
  requireCustomer,
  requireOwnership,
  requireTenantAccess,
  requirePermission,
};
