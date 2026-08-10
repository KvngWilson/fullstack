/**
 * Review Entity
 * 
 * Represents a product review with rating, comment, and moderation workflow
 */
class Review {
  constructor({
    id = null,
    productId,
    userId,
    rating,
    comment,
    status = "pending", // pending, approved, rejected, hidden
    moderationNotes = null,
    verifiedPurchase = false,
    helpful = 0,
    notHelpful = 0,
    createdAt = null,
    updatedAt = null,
  } = {}) {
    if (!productId || !userId || !rating) {
      throw new Error("productId, userId, and rating are required");
    }

    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      throw new Error("Rating must be an integer between 1 and 5");
    }

    this.id = id;
    this.productId = productId;
    this.userId = userId;
    this.rating = rating;
    this.comment = comment || "";
    this.status = status;
    this.moderationNotes = moderationNotes;
    this.verifiedPurchase = verifiedPurchase;
    this.helpful = helpful;
    this.notHelpful = notHelpful;
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();
  }

  /**
   * Approve the review
   */
  approve(moderatorId, notes = null) {
    if (this.status === "approved") {
      throw new Error("Review is already approved");
    }
    this.status = "approved";
    this.moderationNotes = notes;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Reject the review
   */
  reject(moderatorId, reason) {
    if (!reason) {
      throw new Error("Rejection reason is required");
    }
    this.status = "rejected";
    this.moderationNotes = reason;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Hide the review (for policy violations)
   */
  hide(moderatorId, reason) {
    if (!reason) {
      throw new Error("Hide reason is required");
    }
    this.status = "hidden";
    this.moderationNotes = reason;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Mark as helpful
   */
  markHelpful() {
    this.helpful += 1;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Mark as not helpful
   */
  markNotHelpful() {
    this.notHelpful += 1;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Get helpfulness ratio (0-1)
   */
  getHelpfulnessRatio() {
    const total = this.helpful + this.notHelpful;
    if (total === 0) return 0;
    return this.helpful / total;
  }

  /**
   * Get total helpfulness votes
   */
  getTotalHelpfulnessVotes() {
    return this.helpful + this.notHelpful;
  }

  /**
   * Check if review is publicly visible
   */
  isVisible() {
    return this.status === "approved";
  }

  /**
   * Check if review requires moderation
   */
  requiresModeration() {
    return this.status === "pending";
  }

  /**
   * Validate review content for policy violations
   */
  static async validateContent(comment) {
    const issues = [];

    // Check length
    if (!comment || comment.trim().length < 5) {
      issues.push("Review must be at least 5 characters long");
    }
    if (comment.length > 5000) {
      issues.push("Review cannot exceed 5000 characters");
    }

    // Check for spam patterns
    if (Review._isSuspiciousContent(comment)) {
      issues.push("Review appears to contain suspicious content");
    }

    // Check for abuse patterns
    if (Review._containsAbusePatterns(comment)) {
      issues.push("Review contains inappropriate content");
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  /**
   * Detect suspicious content (spam, links, etc)
   */
  static _isSuspiciousContent(text) {
    const urlPattern = /https?:\/\/\S+/gi;
    const emailPattern = /[\w\.-]+@[\w\.-]+\.\w+/gi;
    const phonePattern = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

    return (
      urlPattern.test(text) ||
      emailPattern.test(text) ||
      phonePattern.test(text)
    );
  }

  /**
   * Detect abusive content
   */
  static _containsAbusePatterns(text) {
    // This would integrate with a content moderation service
    // For now, simple pattern matching
    const abuseWords = [
      "hate",
      "stupid",
      "idiot",
      "dumb",
      "scam",
      "fake",
      "fraud",
    ];
    const lowerText = text.toLowerCase();
    return abuseWords.some((word) => lowerText.includes(word));
  }
}

module.exports = Review;
