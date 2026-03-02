const crypto = require("crypto");
const argon2 = require("argon2");
const { pool } = require("../../../config/db");
const { logger } = require("../../../shared/utils/logger");
const { validateEmail } = require("../../../shared/utils/validate");
const { sendEmailJob } = require("../../../infrastructure/email/email");

/**
 * Enhanced Authentication Service
 * Handles email verification, password reset, and refresh token management
 */

class EnhancedAuthService {
  // =====================================================
  // Email Verification
  // =====================================================

  /**
   * Generate and send email verification token
   * @param {number} userId
   * @param {string} email
   * @returns {Promise<Object>} verification record
   */
  static async sendEmailVerification(userId, email) {
    // Generate verification token
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store token
    await pool.query(
      `INSERT INTO email_verifications (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt]
    );

    // Send email
    const verificationUrl = `${process.env.APP_URL || "http://localhost:3000"}/auth/verify-email?token=${token}`;

    try {
      await sendEmailJob({
        to: email,
        templateName: "emailVerification",
        templateData: {
          verificationUrl,
          expiryHours: 24,
        },
      });

      logger.info("Email verification sent", { userId, email });
    } catch (error) {
      logger.error("Failed to send verification email", {
        userId,
        email,
        error: error.message,
      });
      throw new Error("Failed to send verification email");
    }

    return { userId, email, expiresAt };
  }

  /**
   * Verify email token
   * @param {string} token
   * @returns {Promise<Object>} verification result
   */
  static async verifyEmail(token) {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Find verification record
      const verificationResult = await client.query(
        `SELECT ev.*, u.email, u.email_verified
        FROM email_verifications ev
        JOIN users u ON u.id = ev.user_id
        WHERE ev.token_hash = $1 AND ev.verified_at IS NULL AND ev.expires_at > NOW()
        FOR UPDATE`,
        [tokenHash]
      );

      if (verificationResult.rowCount === 0) {
        throw new Error("Invalid or expired verification token");
      }

      const verification = verificationResult.rows[0];

      if (verification.email_verified) {
        throw new Error("Email already verified");
      }

      // Mark as verified
      await client.query(
        `UPDATE email_verifications SET verified_at = NOW() WHERE token_hash = $1`,
        [tokenHash]
      );

      // Update user
      await client.query(
        `UPDATE users SET email_verified = true WHERE id = $1`,
        [verification.user_id]
      );

      await client.query("COMMIT");

      logger.info("Email verified successfully", {
        userId: verification.user_id,
        email: verification.email,
      });

      return {
        userId: verification.user_id,
        email: verification.email,
        verified: true,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error("Email verification failed", { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  // =====================================================
  // Password Reset
  // =====================================================

  /**
   * Request password reset
   * @param {string} email
   * @param {string} ipAddress
   * @returns {Promise<Object>}
   */
  static async requestPasswordReset(email, ipAddress) {
    const normalizedEmail = email.trim().toLowerCase();

    if (!validateEmail(normalizedEmail)) {
      throw new Error("Invalid email format");
    }

    // Find user
    const userResult = await pool.query(
      "SELECT id, email, first_name FROM users WHERE email = $1 AND is_active = true AND deleted_at IS NULL",
      [normalizedEmail]
    );

    if (userResult.rowCount === 0) {
      // Don't reveal if email exists - return success anyway
      logger.info("Password reset requested for non-existent email", { email: normalizedEmail });
      return {success: true};
    }

    const user = userResult.rows[0];

    // Generate reset token
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store token
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, ip_address)
      VALUES ($1, $2, $3, $4)`,
      [user.id, tokenHash, expiresAt, ipAddress]
    );

    // Send email
    const resetUrl = `${process.env.APP_URL || "http://localhost:3000"}/auth/reset-password?token=${token}`;

    try {
      await sendEmailJob({
        to: user.email,
        templateName: "passwordReset",
        templateData: {
          firstName: user.first_name || "User",
          resetUrl,
          expiryMinutes: 60,
          ipAddress,
        },
      });

      logger.info("Password reset email sent", { userId: user.id, email: user.email });
    } catch (error) {
      logger.error("Failed to send password reset email", {
        userId: user.id,
        error: error.message,
      });
    }

    return { success: true };
  }

  /**
   * Reset password with token
   * @param {string} token
   * @param {string} newPassword
   * @param {string} ipAddress
   * @returns {Promise<Object>}
   */
  static async resetPassword(token, newPassword, ipAddress) {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Find reset token
      const tokenResult = await client.query(
        `SELECT prt.*, u.email, u.password_hash as old_password_hash
        FROM password_reset_tokens prt
        JOIN users u ON u.id = prt.user_id
        WHERE prt.token_hash = $1 AND prt.used_at IS NULL AND prt.expires_at > NOW()
        FOR UPDATE`,
        [tokenHash]
      );

      if (tokenResult.rowCount === 0) {
        throw new Error("Invalid or expired reset token");
      }

      const resetRecord = tokenResult.rows[0];

      // Check password history (prevent reuse of last 5 passwords)
      const historyResult = await client.query(
        `SELECT password_hash FROM password_history WHERE user_id = $1 ORDER BY changed_at DESC LIMIT 5`,
        [resetRecord.user_id]
      );

      const oldHashes = [
        resetRecord.old_password_hash,
        ...historyResult.rows.map((r) => r.password_hash),
      ];

      for (const oldHash of oldHashes) {
        if (await argon2.verify(oldHash, newPassword)) {
          throw new Error("Cannot reuse recent passwords");
        }
      }

      // Hash new password
      const newPasswordHash = await argon2.hash(newPassword);

      // Update user password
      await client.query(
        `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
        [newPasswordHash, resetRecord.user_id]
      );

      // Mark token as used
      await client.query(
        `UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = $1`,
        [tokenHash]
      );

      // Add to password history
      await client.query(
        `INSERT INTO password_history (user_id, password_hash, changed_at)
        VALUES ($1, $2, NOW())`,
        [resetRecord.user_id, resetRecord.old_password_hash]
      );

      // Revoke all refresh tokens (force re-login)
      await client.query(
        `UPDATE refresh_tokens SET revoked_at = NOW(), revoke_reason = 'password_reset' WHERE user_id = $1 AND revoked_at IS NULL`,
        [resetRecord.user_id]
      );

      await client.query("COMMIT");

      logger.info("Password reset successful", {
        userId: resetRecord.user_id,
        email: resetRecord.email,
        ipAddress,
      });

      // Send confirmation email
      try {
        await sendEmailJob({
          to: resetRecord.email,
          templateName: "passwordResetConfirmation",
          templateData: {
            ipAddress,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        logger.error("Failed to send password reset confirmation", {
          userId: resetRecord.user_id,
          error: error.message,
        });
      }

      return {
        userId: resetRecord.user_id,
        email: resetRecord.email,
        success: true,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error("Password reset failed", { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  // =========================
  // Refresh Token Management 
  // =========================

  /**
   * Generate a secure refresh token
   * @param {number} userId
   * @param {string} ipAddress
   * @param {string} userAgent
   * @param {Object} deviceInfo
   * @returns {Promise<string>} refresh token
   */
  static async generateRefreshToken(userId, ipAddress, userAgent, deviceInfo = {}) {
    // Generate token
    const token = crypto.randomBytes(64).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Store token
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, ip_address, user_agent, device_info, expires_at, last_used_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [userId, tokenHash, ipAddress, userAgent, JSON.stringify(deviceInfo), expiresAt]
    );

    logger.info("Refresh token generated", { userId });

    return token;
  }

  /**
   * Validate and rotate refresh token
   * @param {string} token
   * @param {string} ipAddress
   * @param {string} userAgent
   * @returns {Promise<Object>} { userId, email, role, newRefreshToken }
   */
  static async validateAndRotateRefreshToken(token, ipAddress, userAgent) {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Find and validate token
      const tokenResult = await client.query(
        `SELECT rt.*, u.id as user_id, u.email, u.role, u.is_active
        FROM refresh_tokens rt
        JOIN users u ON u.id = rt.user_id
        WHERE rt.token_hash = $1 
          AND rt.revoked_at IS NULL 
          AND rt.expires_at > NOW()
          AND u.deleted_at IS NULL
        FOR UPDATE`,
        [tokenHash]
      );

      if (tokenResult.rowCount === 0) {
        throw new Error("Invalid or expired refresh token");
      }

      const tokenRecord = tokenResult.rows[0];

      if (!tokenRecord.is_active) {
        throw new Error("Account is inactive");
      }

      // Revoke old token
      await client.query(
        `UPDATE refresh_tokens SET revoked_at = NOW(), revoke_reason = 'rotated' WHERE token_hash = $1`,
        [tokenHash]
      );

      // Generate new refresh token
      const newToken = crypto.randomBytes(64).toString("hex");
      const newTokenHash = crypto.createHash("sha256").update(newToken).digest("hex");
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, ip_address, user_agent, device_info, expires_at, last_used_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          tokenRecord.user_id,
          newTokenHash,
          ipAddress,
          userAgent,
          tokenRecord.device_info,
          expiresAt,
        ]
      );

      await client.query("COMMIT");

      logger.info("Refresh token rotated", {
        userId: tokenRecord.user_id,
        oldTokenRevoked: true,
      });

      return {
        userId: tokenRecord.user_id,
        email: tokenRecord.email,
        role: tokenRecord.role,
        newRefreshToken: newToken,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error("Refresh token validation failed", { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Revoke refresh token (logout)
   * @param {string} token
   * @param {string} reason
   */
  static async revokeRefreshToken(token, reason = "logout") {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    await pool.query(
      `UPDATE refresh_tokens SET revoked_at = NOW(), revoke_reason = $1 WHERE token_hash = $2`,
      [reason, tokenHash]
    );

    logger.info("Refresh token revoked", { reason });
  }

  /**
   * Revoke all refresh tokens for a user
   * @param {number} userId
   * @param {string} reason
   */
  static async revokeAllRefreshTokens(userId, reason = "logout_all") {
    const result = await pool.query(
      `UPDATE refresh_tokens SET revoked_at = NOW(), revoke_reason = $1 
      WHERE user_id = $2 AND revoked_at IS NULL`,
      [reason, userId]
    );

    logger.info("All refresh tokens revoked", {
      userId,
      revokedCount: result.rowCount,
      reason,
    });

    return result.rowCount;
  }

  /**
   * Get active sessions for user
   * @param {number} userId
   * @returns {Promise<Array>} active refresh tokens
   */
  static async getActiveSessions(userId) {
    const result = await pool.query(
      `SELECT 
        id, device_info, ip_address, user_agent, 
        last_used_at, expires_at, created_at
      FROM refresh_tokens
      WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
      ORDER BY last_used_at DESC`,
      [userId]
    );

    return result.rows;
  }
}

module.exports = EnhancedAuthService;
