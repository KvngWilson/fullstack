/**
 * Review Controller
 * 
 * Handles review CRUD, moderation, and listing
 */
const Joi = require("joi");

class ReviewController {
  constructor(reviewService, reviewRepository) {
    this.reviewService = reviewService;
    this.reviewRepository = reviewRepository;
  }

  /**
   * Submit a review
   * POST /api/v1/reviews
   */
  async submitReview(req, res, next) {
    try {
      const schema = Joi.object({
        productId: Joi.number().integer().positive().required(),
        rating: Joi.number().integer().min(1).max(5).required(),
        comment: Joi.string().min(10).max(2000).required(),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message,
        });
      }

      const review = await this.reviewService.submitReview({
        productId: value.productId,
        userId: req.user.id,
        rating: value.rating,
        comment: value.comment,
      });

      res.status(201).json({
        success: true,
        data: review,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get reviews for a product
   * GET /api/v1/products/:productId/reviews
   */
  async getProductReviews(req, res, next) {
    try {
      const { productId } = req.params;
      const { page = 1, limit = 20, sortBy = "helpful" } = req.query;
      const offset = (page - 1) * limit;

      const reviews = await this.reviewRepository.findApprovedByProduct(
        productId,
        limit,
        offset,
        sortBy === "helpful" ? "helpful DESC" : "created_at DESC"
      );

      const total = await this.reviewRepository.countApprovedByProduct(productId);
      const stats = await this.reviewRepository.getProductRatingStats(productId);

      res.json({
        success: true,
        data: {
          reviews,
          stats,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get pending reviews for moderation
   * GET /api/v1/admin/reviews/pending
   */
  async getPendingReviews(req, res, next) {
    try {
      // Check admin role
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: "Admin access required",
        });
      }

      const { page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;

      const reviews = await this.reviewRepository.findByStatus("pending", limit, offset);
      const total = await this.reviewRepository.countByStatus("pending");

      res.json({
        success: true,
        data: {
          reviews,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Approve a review
   * PATCH /api/v1/admin/reviews/:reviewId/approve
   */
  async approveReview(req, res, next) {
    try {
      // Check admin role
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: "Admin access required",
        });
      }

      const { reviewId } = req.params;
      const review = await this.reviewService.approveReview(reviewId, req.user.id);

      res.json({
        success: true,
        data: review,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Reject a review
   * PATCH /api/v1/admin/reviews/:reviewId/reject
   */
  async rejectReview(req, res, next) {
    try {
      // Check admin role
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: "Admin access required",
        });
      }

      const schema = Joi.object({
        reason: Joi.string().max(500).required(),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message,
        });
      }

      const { reviewId } = req.params;
      const review = await this.reviewService.rejectReview(reviewId, req.user.id, value.reason);

      res.json({
        success: true,
        data: review,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Mark review as helpful
   * POST /api/v1/reviews/:reviewId/helpful
   */
  async markHelpful(req, res, next) {
    try {
      const { reviewId } = req.params;
      const review = await this.reviewService.markHelpful(reviewId);

      res.json({
        success: true,
        data: review,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Mark review as not helpful
   * POST /api/v1/reviews/:reviewId/not-helpful
   */
  async markNotHelpful(req, res, next) {
    try {
      const { reviewId } = req.params;
      const review = await this.reviewService.markNotHelpful(reviewId);

      res.json({
        success: true,
        data: review,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = ReviewController;
