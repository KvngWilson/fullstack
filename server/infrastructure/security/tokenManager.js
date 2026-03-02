const crypto = require('crypto');
const { pool } = require('../../config/db');

/**
 * Generate a random token for email verification or password reset
 */
const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Generate refresh token
 */
const generateRefreshToken = () => {
  return crypto.randomBytes(40).toString('hex');
};

/**
 * Store email verification token
 */
const createEmailVerificationToken = async (userId, email) => {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await pool.query(
    `INSERT INTO email_verification_tokens (user_id, token, expires_at) 
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) 
     DO UPDATE SET token = $2, expires_at = $3, created_at = NOW()`,
    [userId, token, expiresAt]
  );

  return token;
};

/**
 * Verify email verification token
 */
const verifyEmailToken = async (token) => {
  const result = await pool.query(
    `SELECT user_id FROM email_verification_tokens 
     WHERE token = $1 AND expires_at > NOW()`,
    [token]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const userId = result.rows[0].user_id;

  // Mark user as verified
  await pool.query(
    'UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1',
    [userId]
  );

  // Delete used token
  await pool.query('DELETE FROM email_verification_tokens WHERE token = $1', [token]);

  return userId;
};

/**
 * Store password reset token
 */
const createPasswordResetToken = async (userId, email) => {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token, expires_at) 
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) 
     DO UPDATE SET token = $2, expires_at = $3, created_at = NOW()`,
    [userId, token, expiresAt]
  );

  return token;
};

/**
 * Verify password reset token
 */
const verifyPasswordResetToken = async (token) => {
  const result = await pool.query(
    `SELECT user_id FROM password_reset_tokens 
     WHERE token = $1 AND expires_at > NOW()`,
    [token]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].user_id;
};

/**
 * Delete password reset token after use
 */
const deletePasswordResetToken = async (token) => {
  await pool.query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);
};

/**
 * Store refresh token
 */
const createRefreshToken = async (userId, token) => {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at) 
     VALUES ($1, $2, $3)`,
    [userId, token, expiresAt]
  );

  return token;
};

/**
 * Verify refresh token
 */
const verifyRefreshToken = async (token) => {
  const result = await pool.query(
    `SELECT user_id FROM refresh_tokens 
     WHERE token = $1 AND expires_at > NOW() AND revoked = false`,
    [token]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].user_id;
};

/**
 * Revoke refresh token
 */
const revokeRefreshToken = async (token) => {
  await pool.query(
    'UPDATE refresh_tokens SET revoked = true WHERE token = $1',
    [token]
  );
};

/**
 * Revoke all refresh tokens for a user
 */
const revokeAllUserTokens = async (userId) => {
  await pool.query(
    'UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND revoked = false',
    [userId]
  );
};

/**
 * Track failed login attempts
 */
const recordFailedLogin = async (email) => {
  await pool.query(
    `INSERT INTO login_attempts (email, attempted_at) 
     VALUES ($1, NOW())`,
    [email]
  );
};

/**
 * Check if account is locked
 */
const isAccountLocked = async (email) => {
  const result = await pool.query(
    `SELECT COUNT(*) as attempts 
     FROM login_attempts 
     WHERE email = $1 AND attempted_at > NOW() - INTERVAL '15 minutes'`,
    [email]
  );

  const attempts = parseInt(result.rows[0].attempts);
  return attempts >= 5;
};

/**
 * Clear failed login attempts after successful login
 */
const clearFailedLogins = async (email) => {
  await pool.query(
    'DELETE FROM login_attempts WHERE email = $1',
    [email]
  );
};

/**
 * Clean up expired tokens (run periodically)
 */
const cleanupExpiredTokens = async () => {
  await pool.query('DELETE FROM email_verification_tokens WHERE expires_at < NOW()');
  await pool.query('DELETE FROM password_reset_tokens WHERE expires_at < NOW()');
  await pool.query('DELETE FROM refresh_tokens WHERE expires_at < NOW()');
  await pool.query('DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL \'24 hours\'');
};

module.exports = {
  generateToken,
  generateRefreshToken,
  createEmailVerificationToken,
  verifyEmailToken,
  createPasswordResetToken,
  verifyPasswordResetToken,
  deletePasswordResetToken,
  createRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  recordFailedLogin,
  isAccountLocked,
  clearFailedLogins,
  cleanupExpiredTokens,
};
