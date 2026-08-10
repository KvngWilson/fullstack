/**
 * Vendor Controller
 * 
 * Handles vendor onboarding, management, and payout
 */
const Joi = require("joi");

class VendorController {
  constructor(vendorOnboardingService, commissionService) {
    this.vendorOnboardingService = vendorOnboardingService;
    this.commissionService = commissionService;
  }

  /**
   * Create vendor application
   * POST /api/v1/vendor/applications
   */
  async createApplication(req, res, next) {
    try {
      const schema = Joi.object({
        storeName: Joi.string().min(3).max(100).required(),
        storeDescription: Joi.string().max(500),
        category: Joi.string().required(),
        contactEmail: Joi.string().email().required(),
        contactPhone: Joi.string().required(),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message,
        });
      }

      const vendor = await this.vendorOnboardingService.createVendorApplication({
        userId: req.user.id,
        ...value,
      });

      res.status(201).json({
        success: true,
        data: vendor,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get onboarding status
   * GET /api/v1/vendor/onboarding
   */
  async getOnboardingStatus(req, res, next) {
    try {
      const vendorId = req.user.vendorId;
      if (!vendorId) {
        return res.status(404).json({
          success: false,
          error: "Vendor not found",
        });
      }

      const status = await this.vendorOnboardingService.getOnboardingStatus(vendorId);

      res.json({
        success: true,
        data: status,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Submit verification documents
   * POST /api/v1/vendor/verification
   */
  async submitVerification(req, res, next) {
    try {
      const vendorId = req.user.vendorId;
      if (!vendorId) {
        return res.status(404).json({
          success: false,
          error: "Vendor not found",
        });
      }

      const schema = Joi.object({
        documents: Joi.array()
          .items(
            Joi.object({
              type: Joi.string().valid("id", "business_license", "tax_certificate"),
              url: Joi.string().uri(),
            })
          )
          .required(),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message,
        });
      }

      const vendor = await this.vendorOnboardingService.submitVerificationDocuments(vendorId, value.documents);

      res.json({
        success: true,
        data: vendor,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get vendor earnings summary
   * GET /api/v1/vendor/earnings
   */
  async getEarnings(req, res, next) {
    try {
      const vendorId = req.user.vendorId;
      if (!vendorId) {
        return res.status(404).json({
          success: false,
          error: "Vendor not found",
        });
      }

      const timeRange = req.query.timeRange || "month";
      const earnings = await this.commissionService.getVendorEarnings(vendorId, timeRange);

      res.json({
        success: true,
        data: earnings,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Request payout
   * POST /api/v1/vendor/payouts
   */
  async requestPayout(req, res, next) {
    try {
      const vendorId = req.user.vendorId;
      if (!vendorId) {
        return res.status(404).json({
          success: false,
          error: "Vendor not found",
        });
      }

      const schema = Joi.object({
        amount: Joi.number().positive().precision(2).required(),
        bankAccountId: Joi.string().required(),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message,
        });
      }

      const payout = await this.commissionService.requestPayout(
        vendorId,
        value.amount,
        value.bankAccountId
      );

      res.status(201).json({
        success: true,
        data: payout,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get payout history
   * GET /api/v1/vendor/payouts/history
   */
  async getPayoutHistory(req, res, next) {
    try {
      const vendorId = req.user.vendorId;
      if (!vendorId) {
        return res.status(404).json({
          success: false,
          error: "Vendor not found",
        });
      }

      const { page = 1, limit = 20, status } = req.query;
      const offset = (page - 1) * limit;

      const payouts = await this.commissionService.getPayoutHistory(vendorId, {
        limit,
        offset,
        status,
      });

      res.json({
        success: true,
        data: payouts,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Approve vendor
   * PATCH /api/v1/admin/vendors/:vendorId/approve
   */
  async approveVendor(req, res, next) {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: "Admin access required",
        });
      }

      const { vendorId } = req.params;
      const schema = Joi.object({
        notes: Joi.string().max(500),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message,
        });
      }

      const vendor = await this.vendorOnboardingService.approveVendor(vendorId, req.user.id, value.notes);

      res.json({
        success: true,
        data: vendor,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Reject vendor
   * PATCH /api/v1/admin/vendors/:vendorId/reject
   */
  async rejectVendor(req, res, next) {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: "Admin access required",
        });
      }

      const { vendorId } = req.params;
      const schema = Joi.object({
        reason: Joi.string().required(),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message,
        });
      }

      const vendor = await this.vendorOnboardingService.rejectVendor(vendorId, value.reason);

      res.json({
        success: true,
        data: vendor,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Suspend vendor
   * PATCH /api/v1/admin/vendors/:vendorId/suspend
   */
  async suspendVendor(req, res, next) {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: "Admin access required",
        });
      }

      const { vendorId } = req.params;
      const schema = Joi.object({
        reason: Joi.string().required(),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message,
        });
      }

      const vendor = await this.vendorOnboardingService.suspendVendor(vendorId, value.reason);

      res.json({
        success: true,
        data: vendor,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Set vendor commission rate
   * PATCH /api/v1/admin/vendors/:vendorId/commission
   */
  async setCommissionRate(req, res, next) {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: "Admin access required",
        });
      }

      const { vendorId } = req.params;
      const schema = Joi.object({
        rate: Joi.number().min(0).max(100).precision(2).required(),
        reason: Joi.string(),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message,
        });
      }

      const result = await this.commissionService.setVendorCommissionRate(
        vendorId,
        value.rate,
        value.reason
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = VendorController;
