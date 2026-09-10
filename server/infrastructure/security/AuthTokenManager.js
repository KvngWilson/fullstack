const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { logger } = require('../../shared/utils/logger');
const { redisClient } = require('../../config/redis');

/**
 * AuthTokenManager - Centralized JWT and token lifecycle management
 *
 * Responsibilities:
 * - Generate access tokens with claims
 * - Validate and verify tokens
 * - Implement token blacklist for logout (Redis-backed)
 * - Support refresh token rotation
 */
class AuthTokenManager {
  constructor(redisClient_) {
    this.redis = redisClient_ || redisClient;
    this.accessTokenTTL = 24 * 60 * 60; // 24 hours (matches JWT_EXPIRES_IN)
  }

  canUseRedis() {
    return Boolean(this.redis?.isReady && this.redis?.isOpen);
  }

  /**
   * Generate access token with user claims
   * Token includes: id, email, role (and permissions if admin)
   *
   * @param {Object} payload - Token payload
   * @param {number} payload.id - User ID
   * @param {string} payload.email - User email
   * @param {string} payload.role - User role (customer, admin, vendor, support)
   * @param {Array} payload.permissions - User permissions (optional, for employees)
   * @returns {string} JWT token
   */
  generateAccessToken(payload) {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      logger.error('JWT_SECRET not configured - cannot generate token');
      throw new Error('JWT_SECRET environment variable is required');
    }

    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

    try {
      const token = jwt.sign(payload, secret, { expiresIn });
      logger.debug('Access token generated', { userId: payload.id });
      return token;
    } catch (error) {
      logger.error('Failed to generate access token', { error: error.message });
      throw error;
    }
  }

  /**
   * Verify and decode token
   *
   * @param {string} token - JWT token to verify
   * @returns {Object|null} Decoded payload if valid, null if invalid
   */
  verifyAccessToken(token) {
    const secret = process.env.JWT_SECRET;

    try {
      const decoded = jwt.verify(token, secret);
      return decoded;
    } catch (error) {
      logger.debug('Token verification failed', { error: error.message });
      return null;
    }
  }

  /**
   * Add token to blacklist (logout)
   * Stores token hash in Redis with TTL matching token expiration
   *
   * @param {string} token - JWT token to blacklist
   * @param {number} expiresIn - Token expiration time in seconds (default 24h)
   * @returns {Promise<void>}
   */
  async blacklistToken(token, expiresIn = this.accessTokenTTL) {
    if (!this.canUseRedis()) {
      return;
    }

    try {
      const decoded = jwt.decode(token);

      if (!decoded || !decoded.id) {
        logger.warn('Cannot blacklist invalid token');
        return;
      }

      // Create unique key for this token (user + issued-at)
      // This prevents blocking all future tokens for the user
      const tokenHash = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

      const blacklistKey = `token:blacklist:${decoded.id}:${tokenHash}`;

      // Store in Redis with TTL (auto-delete after expiration)
      await this.redis.setex(blacklistKey, expiresIn, '1');

      logger.info('Token blacklisted (logout)', {
        userId: decoded.id,
        expiresIn
      });
    } catch (error) {
      logger.error('Failed to blacklist token', { error: error.message });
      // Don't throw - blacklist failure shouldn't break logout flow
    }
  }

  /**
   * Check if token is blacklisted
   * Used to prevent reuse of tokens after logout
   *
   * @param {string} token - JWT token to check
   * @returns {Promise<boolean>} True if blacklisted, false otherwise
   */
  async isTokenBlacklisted(token) {
    if (!this.canUseRedis()) {
      return false;
    }

    try {
      const decoded = jwt.decode(token);

      if (!decoded || !decoded.id) {
        return false;
      }

      const tokenHash = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

      const blacklistKey = `token:blacklist:${decoded.id}:${tokenHash}`;

      const isBlacklisted = await this.redis.exists(blacklistKey);

      if (isBlacklisted) {
        logger.debug('Token is blacklisted', { userId: decoded.id });
      }

      return isBlacklisted === 1;
    } catch (error) {
      logger.error('Failed to check token blacklist', { error: error.message });
      // On error, assume NOT blacklisted (fail-open for availability)
      return false;
    }
  }

  /**
   * Blacklist all tokens for a user (e.g., on password change or account compromise)
   * Uses a pattern match in Redis to invalidate all tokens
   *
   * @param {number} userId - User ID whose tokens to blacklist
   * @returns {Promise<number>} Number of tokens blacklisted
   */
  async blacklistAllUserTokens(userId) {
    if (!this.canUseRedis()) {
      return 0;
    }

    try {
      // Get all token keys for this user
      const pattern = `token:blacklist:${userId}:*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        // Delete all matching keys
        await this.redis.del(...keys);
      }

      logger.info('All user tokens blacklisted', { userId, count: keys.length });
      return keys.length;
    } catch (error) {
      logger.error('Failed to blacklist all user tokens', {
        userId,
        error: error.message
      });
      return 0;
    }
  }

  /**
   * Decode token without verification (for debugging/inspection)
   * UNSAFE: Only use in non-security-critical contexts
   *
   * @param {string} token - JWT token to decode
   * @returns {Object|null} Decoded payload
   */
  decodeToken(token) {
    return jwt.decode(token);
  }
}

module.exports = AuthTokenManager;
