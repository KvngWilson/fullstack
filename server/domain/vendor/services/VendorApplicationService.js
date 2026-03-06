const argon2 = require("argon2");
const { pool } = require("../../../config/db");
const { logger } = require("../../../shared/utils/logger");
const {
  validateEmail,
  validatePassword,
} = require("../../../shared/utils/validate");
const { sendEmailJob } = require("../../../infrastructure/email/email");

/**
 * Vendor Application Service
 * Handles vendor registration, application management, and approval workflow
 */

class VendorApplicationService {
  /**
   * Submit a vendor application
   * @param {Object} applicationData
   * @returns {Promise<Object>} application result
   */
  static async submitApplication(applicationData) {
    const {
      email,
      password,
      storeName,
      businessType,
      businessName,
      businessRegistration,
      taxId,
      contactPerson,
      phone,
      address,
      documents = {},
    } = applicationData;

    // Validate required fields
    if (!email || !password || !storeName || !contactPerson || !phone) {
      throw new Error("Missing required fields");
    }

    // Validate email
    const normalizedEmail = email.trim().toLowerCase();
    if (!validateEmail(normalizedEmail)) {
      throw new Error("Invalid email format");
    }

    // Validate password
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      throw new Error(passwordCheck.error);
    }

    // Check if email already exists
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail],
    );

    if (existingUser.rowCount > 0) {
      throw new Error("Email already registered");
    }

    // Check if there's a pending application
    const existingApp = await pool.query(
      "SELECT id, status FROM vendor_applications WHERE email = $1 AND status IN ('pending', 'under_review')",
      [normalizedEmail],
    );

    if (existingApp.rowCount > 0) {
      throw new Error("You already have a pending application");
    }

    // Generate slug from store name
    const slug = storeName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Check slug uniqueness
    const existingSlug = await pool.query(
      "SELECT id FROM vendor_applications WHERE slug = $1 UNION SELECT id FROM vendors WHERE slug = $1",
      [slug],
    );

    if (existingSlug.rowCount > 0) {
      throw new Error(
        "Store name already taken. Please choose a different name.",
      );
    }

    // Hash password
    const passwordHash = await argon2.hash(password);

    // Insert application
    const result = await pool.query(
      `INSERT INTO vendor_applications (
        email, password_hash, store_name, slug, business_type, business_name,
        business_registration, tax_id, contact_person, phone, address, documents, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id, email, store_name, slug, status, created_at`,
      [
        normalizedEmail,
        passwordHash,
        storeName,
        slug,
        businessType || "individual",
        businessName,
        businessRegistration,
        taxId,
        contactPerson,
        phone,
        JSON.stringify(address || {}),
        JSON.stringify(documents),
        "pending",
      ],
    );

    const application = result.rows[0];

    logger.info("Vendor application submitted", {
      applicationId: application.id,
      email: normalizedEmail,
      storeName,
    });

    // Send confirmation email
    try {
      await sendEmailJob({
        to: normalizedEmail,
        templateName: "vendorApplicationReceived",
        templateData: {
          storeName,
          contactPerson,
          applicationId: application.id,
        },
      });
    } catch (emailError) {
      logger.error("Failed to send application confirmation email", {
        applicationId: application.id,
        error: emailError.message,
      });
    }

    // Notify admins
    this._notifyAdminsNewApplication(application);

    return application;
  }

  /**
   * Get all applications with filtering
   * @param {Object} filters - { status, page, pageSize }
   * @returns {Promise<Object>} paginated applications
   */
  static async getApplications(filters = {}) {
    const { status, page = 1, pageSize = 20, search } = filters;

    const limit = Math.min(parseInt(pageSize) || 20, 100);
    const offset = (Math.max(1, parseInt(page) || 1) - 1) * limit;

    let query = `
      SELECT 
        id, email, store_name, slug, business_type, business_name,
        contact_person, phone, status, rejection_reason,
        reviewed_by, reviewed_at, created_at, updated_at
      FROM vendor_applications
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }

    if (search) {
      paramCount++;
      query += ` AND (store_name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR contact_person ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery =
      "SELECT COUNT(*)::int as count FROM vendor_applications WHERE 1=1";
    const countParams = [];
    let countParamCount = 0;

    if (status) {
      countParamCount++;
      countQuery += ` AND status = $${countParamCount}`;
      countParams.push(status);
    }

    if (search) {
      countParamCount++;
      countQuery += ` AND (store_name ILIKE $${countParamCount} OR email ILIKE $${countParamCount} OR contact_person ILIKE $${countParamCount})`;
      countParams.push(`%${search}%`);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = countResult.rows[0].count;

    return {
      applications: result.rows,
      pagination: {
        page: parseInt(page),
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get application by ID
   * @param {number} applicationId
   * @returns {Promise<Object>} application details
   */
  static async getApplicationById(applicationId) {
    const result = await pool.query(
      `SELECT 
        va.*,
        u.email as reviewer_email, u.first_name as reviewer_first_name, u.last_name as reviewer_last_name
      FROM vendor_applications va
      LEFT JOIN users u ON u.id = va.reviewed_by
      WHERE va.id = $1`,
      [applicationId],
    );

    if (result.rowCount === 0) {
      throw new Error("Application not found");
    }

    return result.rows[0];
  }

  /**
   * Approve vendor application
   * @param {number} applicationId
   * @param {number} reviewerId - Admin user ID
   * @param {string} notes - Optional approval notes
   * @returns {Promise<Object>} created vendor and user
   */
  static async approveApplication(applicationId, reviewerId, notes = "") {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Get application
      const appResult = await client.query(
        "SELECT * FROM vendor_applications WHERE id = $1 FOR UPDATE",
        [applicationId],
      );

      if (appResult.rowCount === 0) {
        throw new Error("Application not found");
      }

      const application = appResult.rows[0];

      if (application.status === "approved") {
        throw new Error("Application already approved");
      }

      if (application.status === "rejected") {
        throw new Error("Cannot approve rejected application");
      }

      // Create user account
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, role, email_verified, is_active)
        VALUES ($1, $2, 'vendor', true, true)
        RETURNING id, email, role`,
        [application.email, application.password_hash],
      );

      const user = userResult.rows[0];

      // Create vendor record
      const vendorResult = await client.query(
        `INSERT INTO vendors (user_id, store_name, slug, description, status)
        VALUES ($1, $2, $3, $4, 'active')
        RETURNING id, user_id, store_name, slug, status, created_at`,
        [
          user.id,
          application.store_name,
          application.slug,
          application.business_name || "",
        ],
      );

      const vendor = vendorResult.rows[0];

      // Create vendor onboarding record
      await client.query(
        `INSERT INTO vendor_onboarding (vendor_id, current_step)
        VALUES ($1, 'profile')`,
        [vendor.id],
      );

      // Update application status
      await client.query(
        `UPDATE vendor_applications
        SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), 
            admin_notes = $2, approved_user_id = $3, updated_at = NOW()
        WHERE id = $4`,
        [reviewerId, notes, user.id, applicationId],
      );

      await client.query("COMMIT");

      logger.info("Vendor application approved", {
        applicationId,
        vendorId: vendor.id,
        userId: user.id,
        reviewerId,
      });

      // Send approval email
      try {
        await sendEmailJob({
          to: application.email,
          templateName: "vendorApplicationApproved",
          templateData: {
            storeName: application.store_name,
            contactPerson: application.contact_person,
            loginUrl: `${process.env.APP_URL || "http://localhost:5000"}/login`,
            dashboardUrl: `${process.env.APP_URL || "http://localhost:5000"}/vendor/dashboard`,
          },
        });
      } catch (emailError) {
        logger.error("Failed to send approval email", {
          applicationId,
          error: emailError.message,
        });
      }

      return {
        user,
        vendor,
        application,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error("Failed to approve vendor application", {
        applicationId,
        error: error.message,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reject vendor application
   * @param {number} applicationId
   * @param {number} reviewerId - Admin user ID
   * @param {string} reason - Rejection reason
   * @returns {Promise<Object>} updated application
   */
  static async rejectApplication(applicationId, reviewerId, reason) {
    if (!reason || reason.trim().length === 0) {
      throw new Error("Rejection reason is required");
    }

    const result = await pool.query(
      `UPDATE vendor_applications
      SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), 
          rejection_reason = $2, admin_notes = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING id, email, store_name, status, rejection_reason`,
      [reviewerId, reason, applicationId],
    );

    if (result.rowCount === 0) {
      throw new Error("Application not found");
    }

    const application = result.rows[0];

    logger.info("Vendor application rejected", {
      applicationId,
      reviewerId,
      reason,
    });

    // Send rejection email
    try {
      await sendEmailJob({
        to: application.email,
        templateName: "vendorApplicationRejected",
        templateData: {
          storeName: application.store_name,
          reason,
          reapplyUrl: `${process.env.APP_URL || "http://localhost:5000"}/vendor/apply`,
        },
      });
    } catch (emailError) {
      logger.error("Failed to send rejection email", {
        applicationId,
        error: emailError.message,
      });
    }

    return application;
  }

  /**
   * Request more information from applicant
   * @param {number} applicationId
   * @param {number} reviewerId
   * @param {string} message
   */
  static async requestMoreInfo(applicationId, reviewerId, message) {
    const result = await pool.query(
      `UPDATE vendor_applications
      SET status = 'incomplete', admin_notes = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, email, store_name, contact_person`,
      [message, applicationId],
    );

    if (result.rowCount === 0) {
      throw new Error("Application not found");
    }

    const application = result.rows[0];

    // Send email requesting more info
    try {
      await sendEmailJob({
        to: application.email,
        templateName: "vendorApplicationIncomplete",
        templateData: {
          storeName: application.store_name,
          contactPerson: application.contact_person,
          message,
          updateUrl: `${process.env.APP_URL || "http://localhost:5000"}/vendor/application/${applicationId}`,
        },
      });
    } catch (emailError) {
      logger.error("Failed to send incomplete application email", {
        applicationId,
        error: emailError.message,
      });
    }

    return application;
  }

  /**
   * Notify admins of new vendor application
   * @private
   */
  static async _notifyAdminsNewApplication(application) {
    try {
      // Get admin emails
      const adminResult = await pool.query(
        "SELECT email FROM users WHERE role IN ('admin', 'super_admin') AND is_active = true",
      );

      const adminEmails = adminResult.rows.map((row) => row.email);

      if (adminEmails.length === 0) {
        logger.warn("No admin users found to notify of new vendor application");
        return;
      }

      // Send notification emails
      for (const adminEmail of adminEmails) {
        await sendEmailJob({
          to: adminEmail,
          templateName: "newVendorApplication",
          templateData: {
            storeName: application.store_name,
            applicantEmail: application.email,
            applicationId: application.id,
            reviewUrl: `${process.env.APP_URL || "http://localhost:5000"}/admin/vendor-applications/${application.id}`,
          },
        });
      }
    } catch (error) {
      logger.error("Failed to notify admins of new application", {
        applicationId: application.id,
        error: error.message,
      });
    }
  }
}

module.exports = VendorApplicationService;
