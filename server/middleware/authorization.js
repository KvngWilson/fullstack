const { errorResponse } = require("../utils/response");

/**
 * Checks if user owns the resource or is admin
 * Resource ownership is determined by comparing req.user.id to resource.user_id
 */
function requireResourceOwnership(resourceType = "resource") {
  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return errorResponse(res, "Unauthorized", 401);
    }

    // Admins bypass ownership checks
    if (user.role === "admin") {
      req.isAdmin = true;
      return next();
    }

    // For non-admins, we'll check ownership in the controller
    // This middleware just ensures the user is authenticated
    req.isAdmin = false;
    return next();
  };
}

/**
 * Requires specific role(s)
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return errorResponse(res, "Unauthorized", 401);
    }

    if (!allowedRoles.includes(user.role)) {
      return errorResponse(
        res,
        `Access denied. Required role: ${allowedRoles.join(" or ")}`,
        403,
      );
    }

    return next();
  };
}

/**
 * Requires admin role
 */
function requireAdmin(req, res, next) {
  return requireRole("admin")(req, res, next);
}

/**
 * Requires customer role (customer or admin)
 */
function requireCustomer(req, res, next) {
  return requireRole("customer", "admin")(req, res, next);
}

module.exports = {
  requireResourceOwnership,
  requireRole,
  requireAdmin,
  requireCustomer,
};
