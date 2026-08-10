/**
 * API Routes for new features
 * 
 * Includes:
 * - Reviews (v1/reviews)
 * - Analytics (v1/analytics)
 * - Vendor Management (v1/vendor)
 */
const express = require("express");
const { authenticate, authorize } = require("../../infrastructure/middleware/auth");

/**
 * Setup routes for new features
 */
function setupFeatureRoutes(app, controllers) {
  const { ReviewController, AnalyticsController, VendorController } = controllers;

  // ============ REVIEWS ROUTES ============
  const reviewRouter = express.Router();

  // Public routes
  reviewRouter.get("/products/:productId/reviews", (req, res, next) =>
    ReviewController.getProductReviews(req, res, next)
  );
  reviewRouter.post("/reviews/helpful/:reviewId", authenticate, (req, res, next) =>
    ReviewController.markHelpful(req, res, next)
  );
  reviewRouter.post("/reviews/not-helpful/:reviewId", authenticate, (req, res, next) =>
    ReviewController.markNotHelpful(req, res, next)
  );

  // Authenticated routes
  reviewRouter.post("/reviews", authenticate, (req, res, next) =>
    ReviewController.submitReview(req, res, next)
  );

  // Admin routes
  reviewRouter.get(
    "/admin/reviews/pending",
    authenticate,
    authorize("admin"),
    (req, res, next) => ReviewController.getPendingReviews(req, res, next)
  );
  reviewRouter.patch(
    "/admin/reviews/:reviewId/approve",
    authenticate,
    authorize("admin"),
    (req, res, next) => ReviewController.approveReview(req, res, next)
  );
  reviewRouter.patch(
    "/admin/reviews/:reviewId/reject",
    authenticate,
    authorize("admin"),
    (req, res, next) => ReviewController.rejectReview(req, res, next)
  );

  app.use("/api/v1", reviewRouter);

  // ============ ANALYTICS ROUTES ============
  const analyticsRouter = express.Router();

  analyticsRouter.get(
    "/analytics/dashboard",
    authenticate,
    authorize("admin", "vendor"),
    (req, res, next) => AnalyticsController.getDashboard(req, res, next)
  );
  analyticsRouter.get(
    "/analytics/sales-trend",
    authenticate,
    authorize("admin", "vendor"),
    (req, res, next) => AnalyticsController.getSalesTrend(req, res, next)
  );
  analyticsRouter.get(
    "/analytics/revenue-by-category",
    authenticate,
    authorize("admin", "vendor"),
    (req, res, next) => AnalyticsController.getRevenueByCategory(req, res, next)
  );
  analyticsRouter.get(
    "/analytics/payment-methods",
    authenticate,
    authorize("admin", "vendor"),
    (req, res, next) => AnalyticsController.getPaymentMethodBreakdown(req, res, next)
  );
  analyticsRouter.get(
    "/analytics/export",
    authenticate,
    authorize("admin", "vendor"),
    (req, res, next) => AnalyticsController.exportReport(req, res, next)
  );

  app.use("/api/v1", analyticsRouter);

  // ============ VENDOR ROUTES ============
  const vendorRouter = express.Router();

  // Public application creation
  vendorRouter.post("/vendor/applications", authenticate, (req, res, next) =>
    VendorController.createApplication(req, res, next)
  );

  // Vendor routes (require vendor role)
  vendorRouter.get(
    "/vendor/onboarding",
    authenticate,
    authorize("vendor"),
    (req, res, next) => VendorController.getOnboardingStatus(req, res, next)
  );
  vendorRouter.post(
    "/vendor/verification",
    authenticate,
    authorize("vendor"),
    (req, res, next) => VendorController.submitVerification(req, res, next)
  );
  vendorRouter.get(
    "/vendor/earnings",
    authenticate,
    authorize("vendor"),
    (req, res, next) => VendorController.getEarnings(req, res, next)
  );
  vendorRouter.post(
    "/vendor/payouts",
    authenticate,
    authorize("vendor"),
    (req, res, next) => VendorController.requestPayout(req, res, next)
  );
  vendorRouter.get(
    "/vendor/payouts/history",
    authenticate,
    authorize("vendor"),
    (req, res, next) => VendorController.getPayoutHistory(req, res, next)
  );

  // Admin routes
  vendorRouter.patch(
    "/admin/vendors/:vendorId/approve",
    authenticate,
    authorize("admin"),
    (req, res, next) => VendorController.approveVendor(req, res, next)
  );
  vendorRouter.patch(
    "/admin/vendors/:vendorId/reject",
    authenticate,
    authorize("admin"),
    (req, res, next) => VendorController.rejectVendor(req, res, next)
  );
  vendorRouter.patch(
    "/admin/vendors/:vendorId/suspend",
    authenticate,
    authorize("admin"),
    (req, res, next) => VendorController.suspendVendor(req, res, next)
  );
  vendorRouter.patch(
    "/admin/vendors/:vendorId/commission",
    authenticate,
    authorize("admin"),
    (req, res, next) => VendorController.setCommissionRate(req, res, next)
  );

  app.use("/api/v1", vendorRouter);

  return { reviewRouter, analyticsRouter, vendorRouter };
}

module.exports = { setupFeatureRoutes };
