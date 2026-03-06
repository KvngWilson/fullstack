/**
 * Admin-Only Authentication Controller
 * Handles authentication exclusively for admin and employee users
 * Rejects customer/vendor authentication attempts
 */

const logger = require("../../../../shared/utils/logger");
const { verifyToken } = require("../../../../config/auth");
const domain = require("../../../../domain");
const { AuthServiceError, loginUser, setAuthCookie, clearAuthCookie } =
  domain.identity.services.AuthService;
const EnhancedAuthService = domain.identity.services.EnhancedAuthService;

// Admin and employee roles
const ALLOWED_ADMIN_ROLES = ["admin", "employee"];

function clearRefreshCookie(res) {
  res.clearCookie("refresh_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });
}

function validateAdminRole(user) {
  if (!user || !user.role) {
    return { valid: false, error: "User role not found" };
  }

  if (!ALLOWED_ADMIN_ROLES.includes(user.role)) {
    return {
      valid: false,
      error: "Access denied. This login is for administrative staff only.",
    };
  }

  return { valid: true };
}

function safeRedirect(target, fallback = "/dashboard") {
  if (typeof target !== "string") {
    return fallback;
  }

  const trimmed = target.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  return trimmed;
}

function getAuthenticatedAdminUser(req) {
  const token = req.cookies?.token || req.cookies?.access_token;
  if (!token) {
    return null;
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return null;
  }

  // Validate admin role
  const validation = validateAdminRole(decoded);
  if (!validation.valid) {
    return null;
  }

  return decoded;
}

/**
 * GET /admin/auth/login
 * Render admin login page (SSR)
 */
function renderAdminLogin(req, res) {
  const user = getAuthenticatedAdminUser(req);
  const returnTo = safeRedirect(req.query.returnTo, "/dashboard");

  if (user) {
    return res.redirect(returnTo);
  }

  return res.render("auth/login", {
    title: "Admin Login",
    user: null,
    cartCount: 0,
    error_msg: req.query.error || "",
    success_msg: req.query.success || "",
    form: {
      email: req.query.email || "",
      returnTo,
    },
  });
}

/**
 * POST /admin/auth/login
 * Process admin login (SSR)
 */
async function postAdminLogin(req, res) {
  const { email, password, returnTo } = req.body || {};

  try {
    const { user, token } = await loginUser({ email, password });

    // Validate user is admin or employee
    const validation = validateAdminRole(user);
    if (!validation.valid) {
      logger.warn("Non-admin user attempted admin login", {
        email,
        role: user.role,
      });

      return res.status(403).render("auth/login", {
        title: "Admin Login",
        user: null,
        cartCount: 0,
        error_msg: validation.error,
        success_msg: "",
        form: {
          email: email || "",
          returnTo: safeRedirect(returnTo, "/dashboard"),
        },
      });
    }

    setAuthCookie(res, token);

    return res.redirect(safeRedirect(returnTo, "/dashboard"));
  } catch (error) {
    if (error instanceof AuthServiceError) {
      return res.status(error.status).render("auth/login", {
        title: "Admin Login",
        user: null,
        cartCount: 0,
        error_msg: error.message,
        success_msg: "",
        form: {
          email: email || "",
          returnTo: safeRedirect(returnTo, "/dashboard"),
        },
      });
    }

    logger.error("Admin login failed", { error: error.message });
    return res.status(500).render("auth/login", {
      title: "Admin Login",
      user: null,
      cartCount: 0,
      error_msg: "Login failed. Please try again.",
      success_msg: "",
      form: {
        email: email || "",
        returnTo: safeRedirect(returnTo, "/dashboard"),
      },
    });
  }
}

/**
 * POST /api/v1/admin/auth/login
 * Admin API login endpoint (JSON)
 */
async function apiAdminLogin(req, res) {
  try {
    const { email, password, remember_me } = req.body || {};
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"] || "unknown";

    const { user, token } = await loginUser({ email, password });

    // Validate user is admin or employee
    const validation = validateAdminRole(user);
    if (!validation.valid) {
      logger.warn("Non-admin user attempted admin API login", {
        email,
        role: user.role,
        ipAddress,
      });

      return res.status(403).json({
        success: false,
        error: validation.error,
      });
    }

    // Generate refresh token
    const deviceInfo = {
      type: userAgent.includes("Mobile") ? "mobile" : "desktop",
      browser: parseBrowser(userAgent),
      os: parseOS(userAgent),
    };

    const refreshToken = await EnhancedAuthService.generateRefreshToken(
      user.id,
      ipAddress,
      userAgent,
      deviceInfo
    );

    // Set HTTP-only cookies
    setAuthCookie(res, token);

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({
      success: true,
      message: "Admin login successful",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name || null,
        last_name: user.last_name || null,
        email_verified: user.email_verified || false,
      },
    });
  } catch (error) {
    if (error instanceof AuthServiceError) {
      return res.status(error.status).json({
        success: false,
        error: error.message,
      });
    }

    logger.error("Admin API login failed", {
      email: req.body?.email,
      error: error.message,
    });

    return res.status(500).json({
      success: false,
      error: "Login failed",
    });
  }
}

/**
 * POST /admin/auth/logout
 * Admin logout (SSR)
 */
async function postAdminLogout(req, res) {
  const refreshToken = req.cookies?.refresh_token;
  if (refreshToken) {
    try {
      await EnhancedAuthService.revokeRefreshToken(refreshToken, "logout");
    } catch (error) {
      logger.warn("Failed to revoke admin refresh token during SSR logout", {
        error: error.message,
      });
    }
  }

  clearAuthCookie(res);
  clearRefreshCookie(res);
  return res.redirect("/admin/auth/login?success=Signed%20out%20successfully");
}

/**
 * POST /api/v1/admin/auth/logout
 * Admin API logout
 */
async function apiAdminLogout(req, res) {
  const refreshToken = req.cookies?.refresh_token;
  if (refreshToken) {
    try {
      await EnhancedAuthService.revokeRefreshToken(refreshToken, "logout");
    } catch (error) {
      logger.warn("Failed to revoke admin refresh token during API logout", {
        error: error.message,
      });
    }
  }

  clearAuthCookie(res);
  clearRefreshCookie(res);
  return res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
}

// Helper functions for user agent parsing
function parseBrowser(userAgent) {
  if (userAgent.includes("Chrome")) return "Chrome";
  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("Safari")) return "Safari";
  if (userAgent.includes("Edge")) return "Edge";
  return "Unknown";
}

function parseOS(userAgent) {
  if (userAgent.includes("Windows")) return "Windows";
  if (userAgent.includes("Mac")) return "macOS";
  if (userAgent.includes("Linux")) return "Linux";
  if (userAgent.includes("Android")) return "Android";
  if (userAgent.includes("iOS")) return "iOS";
  return "Unknown";
}

module.exports = {
  // SSR endpoints
  renderAdminLogin,
  postAdminLogin,
  postAdminLogout,

  // API endpoints
  apiAdminLogin,
  apiAdminLogout,

  // Utility
  validateAdminRole,
  getAuthenticatedAdminUser,
};
