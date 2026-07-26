const jwt = require('jsonwebtoken');
const AuthTokenManager = require('../../infrastructure/security/AuthTokenManager');

const tokenManager = new AuthTokenManager();

/**
 * Verifies a JWT token and returns the decoded payload if valid, otherwise null.
 * Throws only if explicitly requested (for internal use).
 *
 * Checks:
 * 1. JWT signature validity
 * 2. Token expiration
 * 3. Token blacklist (logout)
 */
async function verifyToken(token, { throwOnError = false } = {}) {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('Missing JWT_SECRET');

    // Verify JWT signature and expiration
    const decoded = jwt.verify(token, secret);

    // Check if token is blacklisted (logout)
    const isBlacklisted = await tokenManager.isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new Error('Token has been revoked (logged out)');
    }

    return decoded;
  } catch (err) {
    if (throwOnError) throw err;
    return null;
  }
}

module.exports = verifyToken;

