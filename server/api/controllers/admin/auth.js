/**
 * Admin Authentication Controller (SSR)
 * Hardened to allow only admin/employee authentication paths.
 */

const logger = require("../../../shared/utils/logger");
const domain = require("../../../domain");
const AuthTokenManager = require("../../../infrastructure/security/AuthTokenManager");
const { isInternalAdminRole } = require("../../../shared/constants/userRoles");

const AuthenticationService = domain.identity.services.AuthenticationService;

function setAuthCookie(res, token) {
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });
}

function clearAuthCookie(res) {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });
}

function clearAccessTokenCookie(res) {
  res.clearCookie("access_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });
}

function clearRefreshCookie(res) {
  res.clearCookie("refresh_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });
}

function clearAdminSessionCookie(res) {
  res.clearCookie("admin_sid", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });
}

function getAccessTokenFromRequest(req) {
  const cookieToken = req.cookies?.token || req.cookies?.access_token;
  if (cookieToken) {
    return cookieToken;
  }

  const authHeader = req.headers?.authorization;
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") {
    return parts[1];
  }

  return null;
}

function destroyAdminSession(req) {
  if (!req.session) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    req.session.destroy((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function validateAdminRole(user) {
  if (!user || !user.role) {
    return { valid: false, error: "User role not found" };
  }

  if (!isInternalAdminRole(user.role)) {
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

function renderLoginPage(
  res,
  { status = 200, error = "", success = "", email = "", returnTo = "/dashboard" } = {},
) {
  return res.status(status).render("auth/login", {
    title: "Admin Login",
    user: null,
    cartCount: 0,
    formAction: "/auth/login",
    error_msg: error,
    success_msg: success,
    form: {
      email,
      returnTo,
    },
  });
}

function getAuthenticatedAdminUser(req) {
  const token = req.cookies?.token || req.cookies?.access_token;
  if (!token) {
    return null;
  }

  const decoded = AuthenticationService.verifyJWT(token);
  if (!decoded) {
    return null;
  }

  const roleValidation = validateAdminRole(decoded);
  if (!roleValidation.valid) {
    return null;
  }

  return decoded;
}

function renderLogin(req, res) {
  const user = getAuthenticatedAdminUser(req);
  const returnTo = safeRedirect(req.query.returnTo, "/dashboard");

  if (user) {
    return res.redirect(returnTo);
  }

  return renderLoginPage(res, {
    error: req.query.error || "",
    success: req.query.success || "",
    email: req.query.email || "",
    returnTo,
  });
}

function renderRegister(req, res) {
  logger.warn("Admin registration page requested", {
    path: req.path,
    ip: req.ip,
  });

  return renderLoginPage(res, {
    status: 403,
    error: "Admin self-registration is disabled.",
    returnTo: "/dashboard",
  });
}

async function postRegister(req, res) {
  logger.warn("Admin registration attempted", {
    path: req.path,
    ip: req.ip,
    email: req.body?.email,
  });

  return renderLoginPage(res, {
    status: 403,
    error: "Admin self-registration is disabled.",
    email: req.body?.email || "",
    returnTo: "/dashboard",
  });
}

async function postLogin(req, res) {
  const { email, password, returnTo } = req.body || {};
  const target = safeRedirect(returnTo, "/dashboard");

  try {
    const { user, token } = await AuthenticationService.loginUser({ email, password });

    const roleValidation = validateAdminRole(user);
    if (!roleValidation.valid) {
      logger.warn("Non-admin user attempted admin login", {
        email,
        role: user?.role,
        ip: req.ip,
      });

      return renderLoginPage(res, {
        status: 403,
        error: roleValidation.error,
        email: email || "",
        returnTo: target,
      });
    }

    setAuthCookie(res, token);

    return res.redirect(target);
  } catch (error) {
    if (error.status) {
      return renderLoginPage(res, {
        status: error.status,
        error: error.message,
        email: email || "",
        returnTo: target,
      });
    }

    logger.error("Admin login failed", { email, error: error.message });
    return renderLoginPage(res, {
      status: 500,
      error: "Login failed. Please try again.",
      email: email || "",
      returnTo: target,
    });
  }
}

async function postLogout(req, res) {
  const tokenManager = new AuthTokenManager();
  const accessToken = getAccessTokenFromRequest(req);
  const refreshToken = req.cookies?.refresh_token;

  if (accessToken) {
    try {
      await tokenManager.blacklistToken(accessToken);
    } catch (error) {
      logger.warn("Failed to blacklist admin access token during logout", {
        error: error.message,
      });
    }
  }

  if (refreshToken) {
    try {
      await AuthenticationService.revokeRefreshToken(refreshToken, "logout");
    } catch (error) {
      logger.warn("Failed to revoke admin refresh token during logout", {
        error: error.message,
      });
    }
  }

  try {
    await destroyAdminSession(req);
  } catch (error) {
    logger.error("Failed to destroy admin session during logout", {
      error: error.message,
    });
  }

  clearAuthCookie(res);
  clearAccessTokenCookie(res);
  clearRefreshCookie(res);
  clearAdminSessionCookie(res);
  return res.redirect("/auth/login?success=Signed%20out%20successfully");
}

module.exports = {
  renderLogin,
  renderRegister,
  postRegister,
  postLogin,
  postLogout,
  validateAdminRole,
  getAuthenticatedAdminUser,
};
