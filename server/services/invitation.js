const crypto = require("crypto");
const { pool } = require("../config/db");
const { logger } = require("../shared/utils/logger");
const { sendEmailJob } = require("../infrastructure/email/email");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

/**
 * Employee Invitation Service
 * Handles secure invitation creation, validation, and acceptance
 */

class InvitationService {
  /**
   * Generate a cryptographically secure invitation token
   * @returns {Object} { token, tokenHash }
   */
  static generateInvitationToken() {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    return { token, tokenHash };
  }

  /**
   * Send invitation to new employee
   * @param {string} email - Employee email
   * @param {number} roleId - Role ID to assign
   * @param {number} invitedById - User ID of admin sending invite
   * @param {number} expiryHours - Token expiry (default 24h)
   * @returns {Object} invitation record with token
   */
  static async createInvitation(email, roleId, invitedById, expiryHours = 24) {
    try {
      // Validate role exists
      const roleCheck = await pool.query(
        "SELECT id FROM roles WHERE id = $1 AND is_active = true",
        [roleId],
      );
      if (roleCheck.rowCount === 0) {
        throw new Error("Invalid role ID");
      }

      // Check if email already exists
      const userCheck = await pool.query(
        "SELECT id FROM users WHERE email = $1",
        [email],
      );
      if (userCheck.rowCount > 0) {
        throw new Error("User with this email already exists");
      }

      // Check for pending invitation
      const pendingCheck = await pool.query(
        "SELECT id FROM employee_invitations WHERE email = $1 AND status = 'pending' AND expires_at > now()",
        [email],
      );
      if (pendingCheck.rowCount > 0) {
        throw new Error("Pending invitation already exists for this email");
      }

      const { token, tokenHash } = InvitationService.generateInvitationToken();
      const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

      const result = await pool.query(
        `INSERT INTO employee_invitations (email, role_id, invitation_token, token_hash, invited_by_id, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, role_id, status, expires_at, created_at`,
        [email, roleId, token, tokenHash, invitedById, expiresAt],
      );

      logger.info("Employee invitation created", {
        invitationId: result.rows[0].id,
        email,
        roleId,
        invitedById,
      });

      // Get role name and inviter details for email
      const roleDetails = await pool.query(
        "SELECT name FROM roles WHERE id = $1",
        [roleId],
      );
      const inviterDetails = await pool.query(
        "SELECT first_name, last_name FROM users WHERE id = $1",
        [invitedById],
      );

      const roleName = roleDetails.rows[0]?.name || "Employee";
      const inviter = inviterDetails.rows[0];
      const inviterName = inviter
        ? `${inviter.first_name} ${inviter.last_name}`.trim() || "Administrator"
        : "Administrator";

      // Send invitation email
      const invitationUrl = `${FRONTEND_URL}/accept-invitation?token=${token}`;

      try {
        await sendEmailJob({
          to: email,
          templateName: "employeeInvitation",
          templateData: {
            to: email,
            inviterName,
            roleName,
            invitationUrl,
            expiryHours,
          },
        });
        logger.info("Invitation email sent successfully", {
          invitationId: result.rows[0].id,
          email,
        });
      } catch (emailError) {
        logger.error("Failed to send invitation email", {
          invitationId: result.rows[0].id,
          email,
          error: emailError.message,
        });
        // Don't throw - invitation is created, email failure is non-critical
      }

      return {
        ...result.rows[0],
        invitation_token: token, // Return plaintext token for email
      };
    } catch (error) {
      logger.error("Failed to create invitation", { error: error.message });
      throw error;
    }
  }

  /**
   * Validate invitation token
   * @param {string} token - Plaintext invitation token
   * @returns {Object} invitation details if valid
   */
  static async validateInvitation(token) {
    try {
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      const result = await pool.query(
        `SELECT i.id, i.email, i.role_id, i.status, i.expires_at, r.code AS role_code, r.name AS role_name
         FROM employee_invitations 
         i
         JOIN roles r ON r.id = i.role_id
         WHERE i.token_hash = $1 AND i.status = 'pending'`,
        [tokenHash],
      );

      if (result.rowCount === 0) {
        throw new Error("Invalid or expired invitation token");
      }

      const invitation = result.rows[0];

      // Check expiry
      if (new Date(invitation.expires_at) < new Date()) {
        // Mark as expired
        await pool.query(
          "UPDATE employee_invitations SET status = 'expired' WHERE id = $1",
          [invitation.id],
        );
        throw new Error("Invitation token has expired");
      }

      return invitation;
    } catch (error) {
      logger.error("Invitation validation failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Accept invitation and create employee account
   * @param {string} token - Invitation token
   * @param {Object} credentials - { firstName, lastName, password }
   * @returns {Object} created employee details
   */
  static async acceptInvitation(token, credentials) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Validate invitation
      const invitation = await InvitationService.validateInvitation(token);

      // Hash password
      const argon2 = require("argon2");
      const passwordHash = await argon2.hash(credentials.password);

      // Create user
      const userResult = await client.query(
        `INSERT INTO users (email, first_name, last_name, password_hash, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, now(), now())
         RETURNING id, email, first_name, last_name`,
        [
          invitation.email,
          credentials.firstName,
          credentials.lastName,
          passwordHash,
          invitation.role_code || "employee",
        ],
      );

      const userId = userResult.rows[0].id;

      // Create employee record
      const employeeResult = await client.query(
        `INSERT INTO employees (user_id, role_id, employment_status, password_last_updated_at, created_at, updated_at)
         VALUES ($1, $2, 'active', now(), now(), now())
         RETURNING id`,
        [userId, invitation.role_id],
      );

      // Mark invitation as accepted
      await client.query(
        `UPDATE employee_invitations SET status = 'accepted', accepted_at = now(), accepted_by_user_id = $1
         WHERE id = $2`,
        [userId, invitation.id],
      );

      // Add to password history
      await client.query(
        "INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)",
        [userId, passwordHash],
      );

      // Log security event
      await client.query(
        `INSERT INTO security_audit_log (event_type, actor_id, target_id, description)
         VALUES ('employee_onboarded', $1, $2, 'Employee account created through invitation')`,
        [userId, userId],
      );

      await client.query("COMMIT");

      logger.info("Employee invitation accepted", {
        userId,
        email: invitation.email,
        roleId: invitation.role_id,
      });

      return {
        userId,
        email: userResult.rows[0].email,
        name: `${userResult.rows[0].first_name} ${userResult.rows[0].last_name}`,
        roleId: invitation.role_id,
        roleCode: invitation.role_code || "employee",
        roleName: invitation.role_name || "Employee",
      };
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error("Failed to accept invitation", { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Resend invitation (invalidates old token)
   * @param {number} invitationId - Invitation ID
   * @param {number} userId - Admin user ID
   */
  static async resendInvitation(invitationId, userId) {
    try {
      const invitation = await pool.query(
        "SELECT id, email, role_id, status FROM employee_invitations WHERE id = $1",
        [invitationId],
      );

      if (invitation.rowCount === 0) {
        throw new Error("Invitation not found");
      }

      const inv = invitation.rows[0];

      if (inv.status === "accepted") {
        throw new Error("Cannot resend an already accepted invitation");
      }

      // Cancel the existing invitation so createInvitation's duplicate check passes
      await pool.query(
        "UPDATE employee_invitations SET status = 'cancelled' WHERE id = $1",
        [invitationId],
      );

      return await InvitationService.createInvitation(
        inv.email,
        inv.role_id,
        userId,
        24,
      );
    } catch (error) {
      logger.error("Failed to resend invitation", { error: error.message });
      throw error;
    }
  }

  /**
   * Cancel invitation
   * @param {number} invitationId - Invitation ID
   */
  static async cancelInvitation(invitationId) {
    try {
      await pool.query(
        "UPDATE employee_invitations SET status = 'cancelled' WHERE id = $1",
        [invitationId],
      );

      logger.info("Invitation cancelled", { invitationId });
    } catch (error) {
      logger.error("Failed to cancel invitation", { error: error.message });
      throw error;
    }
  }

  /**
   * List pending invitations
   */
  static async getPendingInvitations(limit = 50, offset = 0) {
    try {
      const result = await pool.query(
        `SELECT
           i.id,
           i.email,
           i.role_id,
           i.status,
           i.expires_at,
           i.created_at,
           i.invited_by_id,
           r.code AS role_code,
           r.name AS role_name
         FROM employee_invitations i
         JOIN roles r ON r.id = i.role_id
         WHERE i.status = 'pending' AND i.expires_at > now()
         ORDER BY i.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      );

      return result.rows;
    } catch (error) {
      logger.error("Failed to fetch pending invitations", {
        error: error.message,
      });
      throw error;
    }
  }

  static async getInvitationPreview(token) {
    const invitation = await InvitationService.validateInvitation(token);

    return {
      id: invitation.id,
      email: invitation.email,
      roleId: invitation.role_id,
      roleCode: invitation.role_code,
      roleName: invitation.role_name,
      expiresAt: invitation.expires_at,
      status: invitation.status,
    };
  }
}

module.exports = InvitationService;
