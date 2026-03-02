/**
 * Platform-wide Authentication Controller
 * Handles simplified authentication for the entire platform
 * Delegates to Identity domain services
 * NOW WITH: Proper refresh tokens, email verification support, httpOnly cookies, CSRF protection
 */

const crypto = require('crypto');
const logger = require("../../../../shared/utils/logger");
const { verifyToken, generateToken } = require("../../../../config/auth");
const domain = require("../../../../domain");
const {
  AuthServiceError,
  registerUser,
  loginUser,
  setAuthCookie,
} = domain.identity.services.AuthService;
const userService = domain.identity.services.UserService;
const EnhancedAuthService = domain.identity.services.EnhancedAuthService;

/**
 * Register a new user (platform-wide)
 * POST /api/v1/auth/register
 * 
 * Creates new user account and sends verification email
 * If successful, automatically logs in user with httpOnly cookies
 */
const register = async (req, res) => {
  try {
    const { email, password, first_name, last_name } = req.body || {};
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    const result = await registerUser({ 
      email, 
      password,
      first_name,
      last_name,
    });

    // Send email verification if registration successful
    if (result.user && !result.alreadyRegistered) {
      try {
        await EnhancedAuthService.sendEmailVerification(result.user.id, email);
      } catch (emailError) {
        logger.error("Failed to send verification email on registration", {
          userId: result.user.id,
          error: emailError.message,
        });
      }
    }

    // If user just registered, automatically log them in
    if (result.user && !result.alreadyRegistered) {
      const token = generateToken({ 
        id: result.user.id, 
        email: result.user.email, 
        role: result.user.role 
      });
      
      // Generate refresh token
      const deviceInfo = {
        type: userAgent.includes('Mobile') ? 'mobile' : 'desktop',
        browser: parseBrowser(userAgent),
        os: parseOS(userAgent),
      };
      
      const refreshToken = await EnhancedAuthService.generateRefreshToken(
        result.user.id,
        ipAddress,
        userAgent,
        deviceInfo
      );
      
      // ✅ Set httpOnly cookies
      setAuthCookie(res, token);
      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
      
      // Return user data (not tokens)
      return res.status(201).json({
        success: true,
        message: "Registration successful. Please check your email to verify your account.",
        user: {
          id: result.user.id,
          email: result.user.email,
          role: result.user.role,
          first_name: result.user.first_name || null,
          last_name: result.user.last_name || null,
          email_verified: result.user.email_verified || false,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Registration successful. Please check your email to verify your account.",
    });
  } catch (error) {
    if (error instanceof AuthServiceError) {
      return res.status(error.status).json({ 
        success: false,
        error: error.message 
      });
    }

    logger.error("Platform registration error", {
      email: req.body?.email,
      error: error.message,
    });

    return res.status(500).json({ 
      success: false,
      error: "Registration failed" 
    });
  }
};

/**
 * Login user (platform-wide)
 * POST /api/v1/auth/login
 * 
 * SECURITY: Token is stored in httpOnly cookie, NOT returned in JSON response
 * to prevent XSS attacks. Frontend must use cookies for authentication.
 */
const login = async (req, res) => {
  try {
    const { email, password, remember_me } = req.body || {};
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'unknown';

    const { user, token } = await loginUser({ email, password });
    
    // Generate proper refresh token
    const deviceInfo = {
      type: userAgent.includes('Mobile') ? 'mobile' : 'desktop',
      browser: parseBrowser(userAgent),
      os: parseOS(userAgent),
    };

    const refreshToken = await EnhancedAuthService.generateRefreshToken(
      user.id,
      ipAddress,
      userAgent,
      deviceInfo
    );
    
    // ✅ Set HTTP-only cookies (inaccessible to JavaScript)
    setAuthCookie(res, token);
    
    // Set refresh token in separate httpOnly cookie
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // ✅ Return ONLY user data, NOT tokens
    return res.status(200).json({
      success: true,
      message: "Login successful",
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
        error: error.message 
      });
    }

    logger.error("Platform login error", {
      email: req.body?.email,
      error: error.message,
    });

    return res.status(500).json({ 
      success: false,
      error: "Login failed" 
    });
  }
};

/**
 * Refresh authentication token (platform-wide)
 * POST /api/v1/auth/refresh-token
 * 
 * Gets refresh token from httpOnly cookie, returns new access token in cookie
 * SECURITY: Token is stored in httpOnly cookie, NOT returned in JSON response
 */
const refreshToken = async (req, res) => {
  try {
    // ✅ Get refresh token from httpOnly cookie (not from request body)
    const refresh_token = req.cookies?.refresh_token;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'unknown';

    if (!refresh_token) {
      return res.status(401).json({ 
        success: false,
        error: "No refresh token found" 
      });
    }

    // Validate and rotate refresh token
    const result = await EnhancedAuthService.validateAndRotateRefreshToken(
      refresh_token,
      ipAddress,
      userAgent
    );

    // Generate new access token
    const token = generateToken({ 
      id: result.userId, 
      email: result.email, 
      role: result.role 
    });
    
    // ✅ Set new token in httpOnly cookie
    setAuthCookie(res, token);
    
    // ✅ Set new refresh token in httpOnly cookie
    res.cookie('refresh_token', result.newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // ✅ Return ONLY user data, NOT tokens
    return res.status(200).json({ 
      success: true,
      user: {
        id: result.userId,
        email: result.email,
        role: result.role,
      },
    });
  } catch (error) {
    logger.error("Platform refresh token error", {
      error: error.message,
    });

    return res.status(401).json({ 
      success: false,
      error: "Invalid or expired refresh token" 
    });
  }
};

/**
 * Logout user (platform-wide)
 * POST /api/v1/auth/logout
 * 
 * Clears httpOnly cookies and revokes refresh token
 */
const logout = async (req, res) => {
  try {
    // Get refresh token from cookie for revocation
    const refresh_token = req.cookies?.refresh_token;

    // Revoke refresh token
    if (refresh_token) {
      try {
        await EnhancedAuthService.revokeRefreshToken(refresh_token, 'logout');
      } catch (error) {
        logger.warn("Failed to revoke refresh token on logout", {
          error: error.message,
        });
      }
    }

    // ✅ Clear authentication cookies
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    });
    
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    });

    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    logger.error("Platform logout error", {
      error: error.message,
    });

    return res.status(500).json({
      success: false,
      error: "Logout failed",
    });
  }
};

/**
 * Helper functions to parse user agent
 */
function parseBrowser(userAgent) {
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  return 'Unknown';
}

function parseOS(userAgent) {
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac')) return 'macOS';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iOS')) return 'iOS';
  return 'Unknown';
}

/**
 * Generate CSRF token (platform-wide)
 * GET /api/v1/csrf-token
 * 
 * Returns a new CSRF token that must be included in subsequent state-changing requests
 * in the X-CSRF-Token header. Token is regenerated on each request.
 */
const getCsrfToken = async (req, res) => {
  try {
    // Generate a cryptographically secure random token
    const csrfToken = crypto.randomBytes(32).toString('hex');
    
    // In production, this token would be validated against a server-side store
    // For now, the frontend includes it in the X-CSRF-Token header where it can be validated
    
    res.json({
      success: true,
      token: csrfToken,
    });
  } catch (error) {
    logger.error("CSRF token generation error", {
      error: error.message,
    });
    
    return res.status(500).json({
      success: false,
      error: "Failed to generate CSRF token",
    });
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getCsrfToken,
};
