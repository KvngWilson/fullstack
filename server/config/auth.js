const jwt = require('jsonwebtoken');
const { errorResponse } = require('../utils/response');

const JWT_SECRET = process.env.JWT_SECRET; // No fallback - will fail env validation
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Generates JWT access token
 */
function generateToken(payload, expiresIn = JWT_EXPIRES_IN) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Verifies JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Middleware: Authenticate JWT from header
 */
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return errorResponse(res, 'No token provided', 401);
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return errorResponse(res, 'Invalid token format. Use: Bearer <token>', 401);
  }

  const token = parts[1];

  const decoded = verifyToken(token);

  if (!decoded) {
    return errorResponse(res, 'Invalid or expired token', 401);
  }

  req.user = decoded;
  next();
}

/**
 * Optional authentication - doesn't fail if no token
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      const token = parts[1];
      const decoded = verifyToken(token);
      if (decoded) {
        req.user = decoded;
      }
    }
  }

  next();
}

// Single module.exports (no mixing)
module.exports = {
  generateToken,
  verifyToken,
  authenticateJWT,
  optionalAuth,
  JWT_SECRET, // Export for testing only
  JWT_EXPIRES_IN,
};