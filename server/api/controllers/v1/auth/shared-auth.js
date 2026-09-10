const domain = require("../../../../domain");
const { isInternalAdminRole } = require("../../../../shared/constants/userRoles");

const AuthenticationService = domain.identity.services.AuthenticationService;
const permissionService = domain.identity.services.PermissionService;

function getCookieBaseOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  };
}

function setAuthCookie(res, token) {
  res.cookie("token", token, {
    ...getCookieBaseOptions(),
    maxAge: 24 * 60 * 60 * 1000,
  });
}

function setRefreshTokenCookie(res, refreshToken) {
  res.cookie("refresh_token", refreshToken, {
    ...getCookieBaseOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function issueAccessToken(user) {
  return AuthenticationService.generateJWT({
    id: user.id,
    email: user.email,
    role: user.role,
  });
}

async function buildAuthUser(user) {
  const permissions =
    user && isInternalAdminRole(user.role)
      ? await permissionService.resolvePermissionsForUser(user)
      : [];

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    first_name: user.first_name || null,
    last_name: user.last_name || null,
    email_verified: user.email_verified || false,
    permissions,
  };
}

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

function getAuthRequestContext(req) {
  const userAgent = req.headers["user-agent"] || "unknown";

  return {
    ipAddress: req.ip || req.connection?.remoteAddress || null,
    userAgent,
    deviceInfo: {
      type: userAgent.includes("Mobile") ? "mobile" : "desktop",
      browser: parseBrowser(userAgent),
      os: parseOS(userAgent),
    },
  };
}

async function registerFromRequest(req, options = {}) {
  const { sendVerificationEmail = false, onVerificationError } = options;
  const { email, password } = req.body || {};

  const result = await AuthenticationService.registerUser({ email, password });

  if (sendVerificationEmail && result.user && !result.alreadyRegistered) {
    try {
      await AuthenticationService.sendEmailVerification(result.user.id, email);
    } catch (error) {
      if (onVerificationError) {
        onVerificationError(error, result.user);
      } else {
        throw error;
      }
    }
  }

  return result;
}

async function loginFromRequest(req) {
  const { email, password } = req.body || {};
  return AuthenticationService.loginUser({ email, password });
}

async function createRefreshSession(userId, req) {
  const { ipAddress, userAgent, deviceInfo } = getAuthRequestContext(req);
  return AuthenticationService.createRefreshToken(
    userId,
    ipAddress,
    userAgent,
    deviceInfo,
  );
}

async function rotateRefreshSession(refreshToken, req) {
  const { ipAddress, userAgent } = getAuthRequestContext(req);
  return AuthenticationService.validateAndRotateRefreshToken(
    refreshToken,
    ipAddress,
    userAgent,
  );
}

async function verifyRefreshSession(refreshToken) {
  const verified = await AuthenticationService.verifyRefreshToken(refreshToken);

  return {
    userId: verified.user_id,
    email: verified.email,
    role: verified.role,
  };
}

module.exports = {
  AuthenticationService,
  buildAuthUser,
  createRefreshSession,
  getCookieBaseOptions,
  issueAccessToken,
  loginFromRequest,
  registerFromRequest,
  rotateRefreshSession,
  setAuthCookie,
  setRefreshTokenCookie,
  verifyRefreshSession,
};
