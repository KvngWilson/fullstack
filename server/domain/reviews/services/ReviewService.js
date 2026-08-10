/**
 * Review Service
 * 
 * Handles review creation, moderation, and rating aggregation
 */
const Review = require("../entities/Review");
const {
  ReviewSubmitted,
  ReviewApproved,
  ReviewRejected,
  ReviewRatingsUpdated,
} = require("../events");
const logger = require("../../config/logger");

class ReviewService {
  constructor(reviewRepository, productRepository, eventBus) {
    this.reviewRepository = reviewRepository;
    this.productRepository = productRepository;
    this.eventBus = eventBus;
  }

  /**
   * Submit a new review
   */
  async submitReview({
    productId,
    userId,
    rating,
    comment,
    verifiedPurchase = false,
  }) {
    try {
      // Validate product exists
      const product = await this.productRepository.findById(productId);
      if (!product) {
        throw new Error("Product not found");
      }

      // Check if user already reviewed this product
      const existingReview = await this.reviewRepository.findByUserAndProduct(
        userId,
        productId
      );
      if (existingReview) {
        throw new Error("You have already reviewed this product");
      }

      // Create review entity
      const review = new Review({
        productId,
        userId,
        rating,
        comment,
        status: "pending",
        verifiedPurchase,
      });

      // Validate content
      const validation = await Review.validateContent(comment);
      if (!validation.isValid) {
        // Auto-reject reviews with validation issues
        review.status = "rejected";
        review.moderationNotes = validation.issues.join("; ");
      }

      // Save review
      const savedReview = await this.reviewRepository.save(review);

      // Publish event
      const event = new ReviewSubmitted({
        reviewId: savedReview.id,
        productId,
        userId,
        rating,
        comment,
        verifiedPurchase,
      });
      await this.eventBus.publish(event);

      // Update product ratings
      await this._updateProductRatings(productId);

      logger.info("Review submitted", { reviewId: savedReview.id, productId });
      return savedReview;
    } catch (error) {
      logger.error("Failed to submit review", { productId, userId, error });
      throw error;
    }
  }

  /**
   * Approve a review
   */
  async approveReview(reviewId, moderatorId, notes = null) {
    try {
      const review = await this.reviewRepository.findById(reviewId);
      if (!review) {
        throw new Error("Review not found");
      }

      review.approve(moderatorId, notes);
      await this.reviewRepository.update(review);

      const event = new ReviewApproved({
        reviewId,
        productId: review.productId,
        moderatorId,
      });
      await this.eventBus.publish(event);

      // Update product ratings
      await this._updateProductRatings(review.productId);

      logger.info("Review approved", { reviewId, moderatorId });
      return review;
    } catch (error) {
      logger.error("Failed to approve review", { reviewId, error });
      throw error;
    }
  }

  /**
   * Reject a review
   */
  async rejectReview(reviewId, moderatorId, reason) {
    try {
      const review = await this.reviewRepository.findById(reviewId);
      if (!review) {
        throw new Error("Review not found");
      }

      review.reject(moderatorId, reason);
      await this.reviewRepository.update(review);

      const event = new ReviewRejected({
        reviewId,
        productId: review.productId,
        reason,
        moderatorId,
      });
      await this.eventBus.publish(event);

      // Update product ratings
      await this._updateProductRatings(review.productId);

      logger.info("Review rejected", { reviewId, moderatorId });
      return review;
    } catch (error) {
      logger.error("Failed to reject review", { reviewId, error });
      throw error;
    }
  }

  /**
   * Get reviews for a product with pagination
   */
  async getProductReviews(productId, { page = 1, limit = 10, sortBy = "helpful" } = {}) {
    try {
      const offset = (page - 1) * limit;

      // Sort options: helpful, recent, rating-high, rating-low
      const sortMap = {
        helpful: "helpful DESC, created_at DESC",
        recent: "created_at DESC",
        "rating-high": "rating DESC, helpful DESC",
        "rating-low": "rating ASC, helpful DESC",
      };

      const reviews = await this.reviewRepository.findApprovedByProduct(
        productId,
        limit,
        offset,
        sortMap[sortBy] || sortMap.helpful
      );

      const total = await this.reviewRepository.countApprovedByProduct(productId);

      return {
        data: reviews,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Failed to get product reviews", { productId, error });
      throw error;
    }
  }

  /**
   * Get pending reviews for moderation
   */
  async getPendingReviews({ page = 1, limit = 20 } = {}) {
    try {
      const offset = (page - 1) * limit;
      const reviews = await this.reviewRepository.findByStatus(
        "pending",
        limit,
        offset
      );
      const total = await this.reviewRepository.countByStatus("pending");

      return {
        data: reviews,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Failed to get pending reviews", { error });
      throw error;
    }
  }

  /**
   * Mark review as helpful
   */
  async markHelpful(reviewId) {
    try {
      const review = await this.reviewRepository.findById(reviewId);
      if (!review) {
        throw new Error("Review not found");
      }

      review.markHelpful();
      await this.reviewRepository.update(review);

      return review;
    } catch (error) {
      logger.error("Failed to mark review as helpful", { reviewId, error });
      throw error;
    }
  }

  /**
   * Update product average rating and distribution
   */
  async _updateProductRatings(productId) {
    try {
      const ratings = await this.reviewRepository.getProductRatingStats(productId);
      const product = await this.productRepository.findById(productId);

      if (!product) return;

      // Update product with new ratings
      product.averageRating = ratings.average || 0;
      product.totalReviews = ratings.total || 0;

      await this.productRepository.update(product);

      // Publish ratings updated event
      const event = new ReviewRatingsUpdated({
        productId,
        averageRating: ratings.average || 0,
        totalReviews: ratings.total || 0,
        ratingDistribution: ratings.distribution || {},
      });
      await this.eventBus.publish(event);

      logger.info("Product ratings updated", {
        productId,
        averageRating: ratings.average,
      });
    } catch (error) {
      logger.error("Failed to update product ratings", { productId, error });
    }
  }
}

module.exports = ReviewService;
