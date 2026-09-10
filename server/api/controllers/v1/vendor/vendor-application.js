const domain = require("../../../../domain");
const VendorApplicationService = domain.vendor.services.VendorApplicationService;
const { successResponse, errorResponse } = require("../../../../shared/utils/response");
const { logger } = require("../../../../shared/utils/logger");
const { pool } = require("../../../../config/db");

const VENDOR_ONBOARDING_STEPS = [
  "profile",
  "branding",
  "payment",
  "shipping",
  "policies",
  "training",
];

function getNextVendorStep(step) {
  const currentIndex = VENDOR_ONBOARDING_STEPS.indexOf(step);
  if (currentIndex === -1 || currentIndex === VENDOR_ONBOARDING_STEPS.length - 1) {
    return "complete";
  }
  return VENDOR_ONBOARDING_STEPS[currentIndex + 1];
}

function getCurrentVendorStep(completionState, fallbackStep) {
  const nextIncomplete = VENDOR_ONBOARDING_STEPS.find((step) => {
    if (step === "profile") return !completionState.profile_completed;
    if (step === "branding") return !completionState.branding_completed;
    if (step === "payment") return !completionState.payment_completed;
    if (step === "shipping") return !completionState.shipping_completed;
    if (step === "policies") return !completionState.policies_completed;
    if (step === "training") return !completionState.training_completed;
    return false;
  });

  return nextIncomplete || getNextVendorStep(fallbackStep);
}

/**
 * Vendor Application Controller
 * Handles HTTP requests for vendor registration and admin review
 */

/**
 * POST /api/v1/vendors/apply
 * Submit a new vendor application
 */
exports.applyAsVendor = async (req, res) => {
  try {
    const {
      email,
      password,
      confirmPassword,
      storeName,
      businessType,
      businessName,
      businessRegistration,
      taxId,
      contactPerson,
      phone,
      address,
      documents,
    } = req.body;

    // Validate password confirmation
    if (password !== confirmPassword) {
      return errorResponse(res, {
        message: "Passwords do not match",
        status: 400,
      });
    }

    const application = await VendorApplicationService.submitApplication({
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
      documents,
    });

    return successResponse(res, {
      data: {
        applicationId: application.id,
        email: application.email,
        storeName: application.store_name,
        status: application.status,
      },
      message: "Your vendor application has been submitted successfully. We'll review it and get back to you within 1-3 business days.",
      status: 201,
    });
  } catch (error) {
    logger.error("Vendor application submission failed", {
      error: error.message,
      email: req.body?.email,
    });

    return errorResponse(res, {
      message: error.message || "Failed to submit application",
      status: 400,
    });
  }
};

/**
 * GET /api/v1/vendors/applications
 * Get all vendor applications (Admin only)
 */
exports.getApplications = async (req, res) => {
  try {
    const { status, page, pageSize, search } = req.query;

    const result = await VendorApplicationService.getApplications({
      status,
      page,
      pageSize,
      search,
    });

    return successResponse(res, {
      data: result.applications,
      meta: result.pagination,
      message: "Applications retrieved successfully",
    });
  } catch (error) {
    logger.error("Failed to fetch vendor applications", {
      error: error.message,
    });

    return errorResponse(res, {
      message: "Failed to fetch applications",
      status: 500,
    });
  }
};

/**
 * GET /api/v1/vendors/applications/:id
 * Get application details (Admin only)
 */
exports.getApplicationById = async (req, res) => {
  try {
    const { id } = req.params;

    const application = await VendorApplicationService.getApplicationById(id);

    return successResponse(res, {
      data: application,
      message: "Application details retrieved successfully",
    });
  } catch (error) {
    logger.error("Failed to fetch application details", {
      applicationId: req.params.id,
      error: error.message,
    });

    return errorResponse(res, {
      message: error.message || "Failed to fetch application",
      status:  error.message === "Application not found" ? 404 : 500,
    });
  }
};

/**
 * POST /api/v1/vendors/applications/:id/approve
 * Approve vendor application (Admin only)
 */
exports.approveApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const reviewerId = req.user.id;

    const result = await VendorApplicationService.approveApplication(
      id,
      reviewerId,
      notes
    );

    return successResponse(res, {
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          role: result.user.role,
        },
        vendor: result.vendor,
        application: {
          id: result.application.id,
          status: result.application.status,
        },
      },
      message: "Vendor application approved successfully",
      status: 200,
    });
  } catch (error) {
    logger.error("Failed to approve vendor application", {
      applicationId: req.params.id,
      reviewerId: req.user?.id,
      error: error.message,
    });

    return errorResponse(res, {
      message: error.message || "Failed to approve application",
      status: 400,
    });
  }
};

/**
 * POST /api/v1/vendors/applications/:id/reject
 * Reject vendor application (Admin only)
 */
exports.rejectApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const reviewerId = req.user.id;

    if (!reason || reason.trim().length === 0) {
      return errorResponse(res, {
        message: "Rejection reason is required",
        status: 400,
      });
    }

    const application = await VendorApplicationService.rejectApplication(
      id,
      reviewerId,
      reason
    );

    return successResponse(res, {
      data: {
        id: application.id,
        status: application.status,
        rejectionReason: application.rejection_reason,
      },
      message: "Vendor application rejected",
    });
  } catch (error) {
    logger.error("Failed to reject vendor application", {
      applicationId: req.params.id,
      reviewerId: req.user?.id,
      error: error.message,
    });

    return errorResponse(res, {
      message: error.message || "Failed to reject application",
      status: 400,
    });
  }
};

/**
 * POST /api/v1/vendors/applications/:id/request-info
 * Request more information from applicant (Admin only)
 */
exports.requestMoreInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const reviewerId = req.user.id;

    if (!message || message.trim().length === 0) {
      return errorResponse(res, {
        message: "Message is required",
        status: 400,
      });
    }

    const application = await VendorApplicationService.requestMoreInfo(
      id,
      reviewerId,
      message
    );

    return successResponse(res, {
      data: {
        id: application.id,
        status: application.status,
      },
      message: "Information request sent to applicant",
    });
  } catch (error) {
    logger.error("Failed to request more info", {
      applicationId: req.params.id,
      error: error.message,
    });

    return errorResponse(res, {
      message: error.message || "Failed to send request",
      status: 400,
    });
  }
};

/**
 * GET /api/v1/vendors/me
 * Get current vendor's details (Vendor only)
 */
exports.getMyVendorProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT 
        v.*,
        u.email,
        vo.steps_completed,
        vo.step_payloads,
        vo.onboarding_completed, vo.current_step,
        vo.profile_completed, vo.branding_completed, vo.payment_completed,
        vo.shipping_completed, vo.policies_completed, vo.first_product_added,
        vo.training_completed
      FROM vendors v
      JOIN users u ON u.id = v.user_id
      LEFT JOIN vendor_onboarding vo ON vo.vendor_id = v.id
      WHERE v.user_id = $1 AND v.deleted_at IS NULL`,
      [userId]
    );

    if (result.rowCount === 0) {
      return errorResponse(res, {
        message: "Vendor profile not found",
        status: 404,
      });
    }

    return successResponse(res, {
      data: result.rows[0],
      message: "Vendor profile retrieved successfully",
    });
  } catch (error) {
    logger.error("Failed to fetch vendor profile", {
      userId: req.user?.id,
      error: error.message,
    });

    return errorResponse(res, {
      message: "Failed to fetch vendor profile",
      status: 500,
    });
  }
};

/**
 * PATCH /api/v1/vendors/me/onboarding
 * Persist vendor onboarding progress
 */
exports.updateMyVendorOnboarding = async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const { step, data = {} } = req.body || {};

    if (!VENDOR_ONBOARDING_STEPS.includes(step)) {
      return errorResponse(res, {
        message: "Invalid onboarding step",
        status: 400,
      });
    }

    await client.query("BEGIN");

    const vendorResult = await client.query(
      `SELECT v.id, v.store_name, v.description, v.bank_account_last4, vo.id AS onboarding_id,
              vo.steps_completed, vo.step_payloads, vo.profile_completed, vo.branding_completed,
              vo.payment_completed, vo.shipping_completed, vo.policies_completed,
              vo.training_completed, vo.onboarding_completed
       FROM vendors v
       JOIN vendor_onboarding vo ON vo.vendor_id = v.id
       WHERE v.user_id = $1 AND v.deleted_at IS NULL
       FOR UPDATE`,
      [userId],
    );

    if (vendorResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, {
        message: "Vendor profile not found",
        status: 404,
      });
    }

    const vendor = vendorResult.rows[0];
    const stepPayloads = {
      ...(vendor.step_payloads || {}),
      [step]: data,
    };

    const stepsCompleted = Array.isArray(vendor.steps_completed)
      ? new Set(vendor.steps_completed)
      : new Set();
    stepsCompleted.add(step);

    if (step === "profile") {
      await client.query(
        `UPDATE vendors
         SET store_name = COALESCE($1, store_name),
             description = COALESCE($2, description),
             updated_at = NOW()
         WHERE id = $3`,
        [
          typeof data.storeName === "string" && data.storeName.trim()
            ? data.storeName.trim()
            : null,
          typeof data.description === "string" ? data.description.trim() : null,
          vendor.id,
        ],
      );
    }

    if (step === "payment" && typeof data.accountNumber === "string") {
      const trimmed = data.accountNumber.replace(/\s+/g, "");
      if (trimmed.length < 4) {
        await client.query("ROLLBACK");
        return errorResponse(res, {
          message: "Account number must include at least 4 digits",
          status: 400,
        });
      }

      await client.query(
        `UPDATE vendors
         SET bank_account_last4 = $1, updated_at = NOW()
         WHERE id = $2`,
        [trimmed.slice(-4), vendor.id],
      );
    }

    const completionState = {
      profile_completed: vendor.profile_completed || step === "profile",
      branding_completed: vendor.branding_completed || step === "branding",
      payment_completed: vendor.payment_completed || step === "payment",
      shipping_completed: vendor.shipping_completed || step === "shipping",
      policies_completed: vendor.policies_completed || step === "policies",
      training_completed: vendor.training_completed || step === "training",
    };

    const onboardingCompleted =
      completionState.profile_completed &&
      completionState.branding_completed &&
      completionState.payment_completed &&
      completionState.shipping_completed &&
      completionState.policies_completed &&
      completionState.training_completed;

    const currentStep = onboardingCompleted
      ? "complete"
      : getCurrentVendorStep(completionState, step);

    const onboardingResult = await client.query(
      `UPDATE vendor_onboarding
       SET steps_completed = $1,
           step_payloads = $2,
           current_step = $3,
           profile_completed = $4,
           branding_completed = $5,
           payment_completed = $6,
           shipping_completed = $7,
           policies_completed = $8,
           training_completed = $9,
           onboarding_completed = $10,
           completed_at = CASE WHEN $10 THEN NOW() ELSE completed_at END,
           updated_at = NOW()
       WHERE vendor_id = $11
       RETURNING *`,
      [
        JSON.stringify(Array.from(stepsCompleted)),
        JSON.stringify(stepPayloads),
        currentStep,
        completionState.profile_completed,
        completionState.branding_completed,
        completionState.payment_completed,
        completionState.shipping_completed,
        completionState.policies_completed,
        completionState.training_completed,
        onboardingCompleted,
        vendor.id,
      ],
    );

    if (onboardingCompleted) {
      await client.query(
        `UPDATE vendors
         SET onboarding_status = 'active',
             activated_at = COALESCE(activated_at, NOW()),
             updated_at = NOW()
         WHERE id = $1`,
        [vendor.id],
      );
    }

    await client.query("COMMIT");

    return successResponse(res, {
      data: onboardingResult.rows[0],
      message: onboardingCompleted
        ? "Vendor onboarding completed successfully"
        : "Vendor onboarding step saved",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("Failed to update vendor onboarding", {
      userId: req.user?.id,
      error: error.message,
    });

    return errorResponse(res, {
      message: error.message || "Failed to update onboarding",
      status: 500,
    });
  } finally {
    client.release();
  }
};

/**
 * PATCH /api/v1/vendors/me
 * Update vendor profile (Vendor only)
 */
exports.updateMyVendorProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { storeName, description, status } = req.body;

    // Get current vendor
    const vendorResult = await pool.query(
      "SELECT id FROM vendors WHERE user_id = $1 AND deleted_at IS NULL",
      [userId]
    );

    if (vendorResult.rowCount === 0) {
      return errorResponse(res, {
        message: "Vendor profile not found",
        status: 404,
      });
    }

    const vendorId = vendorResult.rows[0].id;

    // Build update query
    const updates = [];
    const values = [];
    let paramCount = 0;

    if (storeName !== undefined) {
      paramCount++;
      updates.push(`store_name = $${paramCount}`);
      values.push(storeName);
    }

    if (description !== undefined) {
      paramCount++;
      updates.push(`description = $${paramCount}`);
      values.push(description);
    }

    if (status !== undefined && ["active", "inactive"].includes(status)) {
      paramCount++;
      updates.push(`status = $${paramCount}`);
      values.push(status);
    }

    if (updates.length === 0) {
      return errorResponse(res, {
        message: "No valid fields to update",
        status: 400,
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(vendorId);

    const result = await pool.query(
      `UPDATE vendors SET ${updates.join(", ")} WHERE id = $${paramCount + 1} RETURNING *`,
      values
    );

    return successResponse(res, {
      data: result.rows[0],
      message: "Vendor profile updated successfully",
    });
  } catch (error) {
    logger.error("Failed to update vendor profile", {
      userId: req.user?.id,
      error: error.message,
    });

    return errorResponse(res, {
      message: error.message || "Failed to update profile",
      status: 500,
    });
  }
};

module.exports = exports;
