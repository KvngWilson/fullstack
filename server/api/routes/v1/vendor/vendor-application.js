const express = require("express");
const router = express.Router();
const { authRoute, role, admin } = require("../../../decorators");
const { vendorApplication: vendorApplicationController } = require("../../../controllers/v1/vendor");
const { validateVendorApplication } = require("../../../validators/vendors");

// =====================================================
// Public Routes - Vendor Application
// =====================================================

/**
 * POST /apply
 * Submit a vendor application
 */
router.post(
  "/apply",
  ...authRoute(validateVendorApplication),
  vendorApplicationController.applyAsVendor
);

// =====================================================
// Authenticated Vendor Routes
// =====================================================

/**
 * GET /me
 * Get current vendor's profile
 */
router.get(
  "/me",
  ...role("vendor"),
  vendorApplicationController.getMyVendorProfile
);

/**
 * PATCH /me
 * Update current vendor's profile
 */
router.patch(
  "/me",
  ...role("vendor"),
  vendorApplicationController.updateMyVendorProfile
);

// =====================================================
// Admin Routes - Application Management
// =====================================================

/**
 * GET /applications
 * List all vendor applications (Admin only)
 */
router.get(
  "/applications",
  ...admin(),
  vendorApplicationController.getApplications
);

/**
 * GET /applications/:id
 * Get application details (Admin only)
 */
router.get(
  "/applications/:id",
  ...admin(),
  vendorApplicationController.getApplicationById
);

/**
 * POST /applications/:id/approve
 * Approve vendor application (Admin only)
 */
router.post(
  "/applications/:id/approve",
  ...admin(),
  vendorApplicationController.approveApplication
);

/**
 * POST /applications/:id/reject
 * Reject vendor application (Admin only)
 */
router.post(
  "/applications/:id/reject",
  ...admin(),
  vendorApplicationController.rejectApplication
);

/**
 * POST /applications/:id/request-info
 * Request more information from applicant (Admin only)
 */
router.post(
  "/applications/:id/request-info",
  ...admin(),
  vendorApplicationController.requestMoreInfo
);

module.exports = router;
