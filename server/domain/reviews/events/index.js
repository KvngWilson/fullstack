/**
 * Review Events
 */

class ReviewSubmitted {
  constructor({
    reviewId,
    productId,
    userId,
    rating,
    comment,
    verifiedPurchase = false,
    occurredAt = new Date(),
  } = {}) {
    this.type = "reviews.review.submitted";
    this.reviewId = reviewId;
    this.productId = productId;
    this.userId = userId;
    this.rating = rating;
    this.comment = comment;
    this.verifiedPurchase = verifiedPurchase;
    this.occurredAt = occurredAt;
  }
}

class ReviewApproved {
  constructor({
    reviewId,
    productId,
    moderatorId,
    occurredAt = new Date(),
  } = {}) {
    this.type = "reviews.review.approved";
    this.reviewId = reviewId;
    this.productId = productId;
    this.moderatorId = moderatorId;
    this.occurredAt = occurredAt;
  }
}

class ReviewRejected {
  constructor({
    reviewId,
    productId,
    reason,
    moderatorId,
    occurredAt = new Date(),
  } = {}) {
    this.type = "reviews.review.rejected";
    this.reviewId = reviewId;
    this.productId = productId;
    this.reason = reason;
    this.moderatorId = moderatorId;
    this.occurredAt = occurredAt;
  }
}

class ReviewHidden {
  constructor({
    reviewId,
    productId,
    reason,
    moderatorId,
    occurredAt = new Date(),
  } = {}) {
    this.type = "reviews.review.hidden";
    this.reviewId = reviewId;
    this.productId = productId;
    this.reason = reason;
    this.moderatorId = moderatorId;
    this.occurredAt = occurredAt;
  }
}

class ReviewRatingsUpdated {
  constructor({
    productId,
    averageRating,
    totalReviews,
    ratingDistribution,
    occurredAt = new Date(),
  } = {}) {
    this.type = "reviews.product.ratings.updated";
    this.productId = productId;
    this.averageRating = averageRating;
    this.totalReviews = totalReviews;
    this.ratingDistribution = ratingDistribution; // { 5: 100, 4: 50, 3: 30, 2: 10, 1: 5 }
    this.occurredAt = occurredAt;
  }
}

module.exports = {
  ReviewSubmitted,
  ReviewApproved,
  ReviewRejected,
  ReviewHidden,
  ReviewRatingsUpdated,
};
