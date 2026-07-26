const crypto = require('crypto');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const { pool } = require('../../../config/db');
const { logger } = require('../../../shared/utils/logger');
const { redisClient } = require('../../../config/redis');
const { validateEmail, validatePassword } = require('../../../shared/utils/validate');
const EmailQueueProvider = require('../../../infrastructure/jobs/EmailQueueProvider');
const userRepository = require('../repositories/UserRepository');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const LOGIN_LOCK_THRESHOLD = Number.parseInt(process.env.LOGIN_LOCK_THRESHOLD || '5', 10);
const LOGIN_LOCK_WINDOW_SECONDS = Number.parseInt(process.env.LOGIN_LOCK_WINDOW_SECONDS || '900', 10);

/**
 * Authentication error with status code
 */
class AuthenticationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'AuthenticationError';
    this.status = status;
  }
}

/**
 * Unified Authentication Service
 * Single source of truth for all authentication, authorization, and token management
 */
class AuthenticationService {
  // =====================================================
  // JWT TOKEN MANAGEMENT
  // =====================================================

  /**
   * Generate JWT token for authenticated user
   */
  static generateJWT(payload, expiresIn = JWT_EXPIRES_IN) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
  }

  /**
   * Verify JWT token
   */
  static verifyJWT(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      logger.warn('JWT verification failed', { error: error.message });
      return null;
    }
  }

  /**
   * Decode JWT without verification (for debugging)
   */
  static decodeJWT(token) {
    return jwt.decode(token);
  }

  // =====================================================
  // NON-JWT TOKEN MANAGEMENT
  // =====================================================

  /**
   * Generate random token for email verification or password reset
   */
  static generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate refresh token
   */
  static generateRefreshToken() {
    return crypto.randomBytes(40).toString('hex');
  }

  // =====================================================
  // REGISTRATION & LOGIN
  // =====================================================

  /**
   * Register new user
   */
  static async registerUser({ email, password }) {
    const normalizedEmail = this._normalizeEmail(email);

    if (!normalizedEmail || !password) {
      throw new AuthenticationError('Email and password are required', 400);
    }

    if (!validateEmail(normalizedEmail)) {
      throw new AuthenticationError('Invalid email format', 400);
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      throw new AuthenticationError(passwordCheck.error, 400);
    }

    const existingUser = await userRepository.findByEmail(normalizedEmail);
    if (existingUser && !existingUser.deleted_at) {
      return {
        user: null,
        token: null,
        alreadyRegistered: true,
      };
    }

    const created = await userRepository.createCustomer({
      email: normalizedEmail,
      password,
    });

    const user = this._sanitizeUser(created);

    logger.info('User registered', { userId: user.id, email: normalizedEmail });

    return {
      user,
      token: null,
      alreadyRegistered: false,
    };
  }

  /**
   * Login user
   */
  static async loginUser({ email, password }) {
    const normalizedEmail = this._normalizeEmail(email);

    if (!normalizedEmail || !password) {
      throw new AuthenticationError('Email and password are required', 400);
    }

    // Check account lock
    if (await this._isAccountLocked(normalizedEmail)) {
      logger.warn('Login attempt on locked account', { email: normalizedEmail });
      throw new AuthenticationError(
        'Account temporarily locked due to failed login attempts. Please try again later.',
        429
      );
    }

    const user = await userRepository.findByEmail(normalizedEmail);
    if (!user || user.deleted_at) {
      await this._recordFailedAttempt(normalizedEmail);
      throw new AuthenticationError('Invalid email or password', 401);
    }

    const passwordValid = await argon2.verify(user.password_hash, password);
    if (!passwordValid) {
      await this._recordFailedAttempt(normalizedEmail);
      throw new AuthenticationError('Invalid email or password', 401);
    }

    // Clear failed attempts
    await this._clearFailedAttempts(normalizedEmail);

    const sanitized = this._sanitizeUser(user);
    const token = this.generateJWT({ id: user.id, email: normalizedEmail, role: user.role });

    logger.info('User logged in', { userId: user.id, email: normalizedEmail });

    return {
      user: sanitized,
      token,
    };
  }

  // =====================================================
  // EMAIL VERIFICATION
  // =====================================================

  /**
   * Send email verification token
   */
  static async sendEmailVerification(userId, email) {
    const token = this.generateToken();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await pool.query(
      `INSERT INTO email_verifications (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt]
    );

    const verificationUrl = `${process.env.APP_URL || 'http://localhost:5000'}/auth/verify-email?token=${token}`;

    try {
      await EmailQueueProvider.queueEmail(
        email,
        'emailVerification',
        {
          verificationUrl,
          expiryHours: 24,
        },
      );

      logger.info('Email verification sent', { userId, email });
    } catch (error) {
      logger.error('Failed to send verification email', {
        userId,
        email,
        error: error.message,
      });
      throw new AuthenticationError('Failed to send verification email', 500);
    }

    return { userId, email, expiresAt };
  }

  /**
   * Verify email token
   */
  static async verifyEmailToken(token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const verificationResult = await client.query(
        `SELECT ev.*, u.email, u.email_verified
         FROM email_verifications ev
         JOIN users u ON u.id = ev.user_id
         WHERE ev.token_hash = $1 AND ev.verified_at IS NULL AND ev.expires_at > NOW()
         FOR UPDATE`,
        [tokenHash]
      );

      if (verificationResult.rowCount === 0) {
        throw new AuthenticationError('Invalid or expired verification token', 400);
      }

      const verification = verificationResult.rows[0];

      if (verification.email_verified) {
        throw new AuthenticationError('Email already verified', 400);
      }

      // Mark as verified
      await client.query(
        `UPDATE email_verifications SET verified_at = NOW() WHERE token_hash = $1`,
        [tokenHash]
      );

      await client.query(
        `UPDATE users SET email_verified = true, verified_at = NOW() WHERE id = $1`,
        [verification.user_id]
      );

      await client.query('COMMIT');

      logger.info('Email verified', { userId: verification.user_id });

      return {
        userId: verification.user_id,
        email: verification.email,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      if (error instanceof AuthenticationError) throw error;
      logger.error('Email verification failed', { error: error.message });
      throw new AuthenticationError('Email verification failed', 500);
    } finally {
      client.release();
    }
  }

  // =====================================================
  // PASSWORD RESET
  // =====================================================

  /**
   * Send password reset token
   */
  static async sendPasswordReset(email) {
    const normalizedEmail = this._normalizeEmail(email);

    const user = await userRepository.findByEmail(normalizedEmail);
    if (!user || user.deleted_at) {
      // Don't reveal if email exists
      logger.info('Password reset requested for non-existent email', { email: normalizedEmail });
      return { sent: true };
    }

    const token = this.generateToken();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET token_hash = $2, expires_at = $3`,
      [user.id, tokenHash, expiresAt]
    );

    const resetUrl = `${process.env.APP_URL || 'http://localhost:5000'}/auth/reset-password?token=${token}`;

    try {
      await EmailQueueProvider.queueEmail(
        normalizedEmail,
        'passwordReset',
        {
          resetUrl,
          expiryHours: 1,
        },
      );

      logger.info('Password reset email sent', { userId: user.id });
    } catch (error) {
      logger.error('Failed to send password reset email', {
        userId: user.id,
        error: error.message,
      });
      throw new AuthenticationError('Failed to send password reset email', 500);
    }

    return { sent: true };
  }

  /**
   * Reset password with token
   */
  static async resetPassword(token, newPassword) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    if (!newPassword) {
      throw new AuthenticationError('New password is required', 400);
    }

    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.valid) {
      throw new AuthenticationError(passwordCheck.error, 400);
    }

    const result = await pool.query(
      `SELECT user_id FROM password_resets
       WHERE token_hash = $1 AND expires_at > NOW() AND used_at IS NULL`,
      [tokenHash]
    );

    if (result.rowCount === 0) {
      throw new AuthenticationError('Invalid or expired password reset token', 400);
    }

    const userId = result.rows[0].user_id;

    // Update password
    const passwordHash = await argon2.hash(newPassword);
    await pool.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2`,
      [passwordHash, userId]
    );

    // Mark token as used
    await pool.query(
      `UPDATE password_resets SET used_at = NOW() WHERE token_hash = $1`,
      [tokenHash]
    );

    logger.info('Password reset completed', { userId });

    return { success: true };
  }

  // =====================================================
  // REFRESH TOKENS
  // =====================================================

  /**
   * Create refresh token
   */
  static async createRefreshToken(userId) {
    const token = this.generateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, token, expiresAt]
    );

    return token;
  }

  /**
   * Verify refresh token
   */
  static async verifyRefreshToken(token) {
    const result = await pool.query(
      `SELECT user_id FROM refresh_tokens
       WHERE token = $1 AND expires_at > NOW() AND revoked = false`,
      [token]
    );

    if (result.rowCount === 0) {
      throw new AuthenticationError('Invalid or expired refresh token', 401);
    }

    return result.rows[0].user_id;
  }

  /**
   * Revoke refresh token
   */
  static async revokeRefreshToken(token) {
    await pool.query(
      `UPDATE refresh_tokens SET revoked = true WHERE token = $1`,
      [token]
    );
  }

  /**
   * Revoke all user refresh tokens
   */
  static async revokeAllUserTokens(userId) {
    await pool.query(
      `UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND revoked = false`,
      [userId]
    );
  }

  // =====================================================
  // PRIVATE HELPERS
  // =====================================================

  static _normalizeEmail(email) {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
  }

  static _sanitizeUser(row) {
    return {
      id: row.id,
      email: row.email,
      role: row.role || 'customer',
    };
  }

  static async _isAccountLocked(email) {
    if (!redisClient?.isReady) return false;
    const value = await redisClient.get(`login_lock:${email}`);
    return Boolean(value);
  }

  static async _recordFailedAttempt(email) {
    if (!redisClient?.isReady) return;

    const attempts = await redisClient.incr(`login_attempts:${email}`);
    await redisClient.expire(`login_attempts:${email}`, LOGIN_LOCK_WINDOW_SECONDS);

    if (attempts >= LOGIN_LOCK_THRESHOLD) {
      await redisClient.setEx(`login_lock:${email}`, LOGIN_LOCK_WINDOW_SECONDS, 'locked');
    }
  }

  static async _clearFailedAttempts(email) {
    if (!redisClient?.isReady) return;
    await redisClient.del([`login_attempts:${email}`, `login_lock:${email}`]);
  }
}

module.exports = AuthenticationService;
