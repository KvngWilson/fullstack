/**
 * Review Repository
 * 
 * Data access layer for reviews
 */
class ReviewRepository {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Find review by ID
   */
  async findById(reviewId) {
    const query = "SELECT * FROM reviews WHERE id = $1";
    const result = await this.pool.query(query, [reviewId]);
    return result.rows[0] || null;
  }

  /**
   * Find review by user and product
   */
  async findByUserAndProduct(userId, productId) {
    const query = `
      SELECT * FROM reviews 
      WHERE user_id = $1 AND product_id = $2
    `;
    const result = await this.pool.query(query, [userId, productId]);
    return result.rows[0] || null;
  }

  /**
   * Find approved reviews for product
   */
  async findApprovedByProduct(productId, limit, offset, orderBy = "helpful DESC") {
    const query = `
      SELECT * FROM reviews 
      WHERE product_id = $1 AND moderation_status = 'approved'
      ORDER BY ${orderBy}
      LIMIT $2 OFFSET $3
    `;
    const result = await this.pool.query(query, [productId, limit, offset]);
    return result.rows;
  }

  /**
   * Count approved reviews for product
   */
  async countApprovedByProduct(productId) {
    const query = `
      SELECT COUNT(*) as count FROM reviews 
      WHERE product_id = $1 AND moderation_status = 'approved'
    `;
    const result = await this.pool.query(query, [productId]);
    return parseInt(result.rows[0].count);
  }

  /**
   * Find reviews by status
   */
  async findByStatus(status, limit, offset) {
    const query = `
      SELECT * FROM reviews 
      WHERE moderation_status = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await this.pool.query(query, [status, limit, offset]);
    return result.rows;
  }

  /**
   * Count reviews by status
   */
  async countByStatus(status) {
    const query = "SELECT COUNT(*) as count FROM reviews WHERE moderation_status = $1";
    const result = await this.pool.query(query, [status]);
    return parseInt(result.rows[0].count);
  }

  /**
   * Get product rating statistics
   */
  async getProductRatingStats(productId) {
    const query = `
      SELECT 
        AVG(rating) as average,
        COUNT(*) as total,
        json_object_agg(rating, count) as distribution
      FROM (
        SELECT rating, COUNT(*) as count
        FROM reviews
        WHERE product_id = $1 AND moderation_status = 'approved'
        GROUP BY rating
      ) as ratings
    `;
    const result = await this.pool.query(query, [productId]);
    const stats = result.rows[0];
    return {
      average: stats.average ? parseFloat(stats.average) : 0,
      total: stats.total ? parseInt(stats.total) : 0,
      distribution: stats.distribution || {},
    };
  }

  /**
   * Save (create) new review
   */
  async save(review) {
    const query = `
      INSERT INTO reviews (
        product_id, user_id, rating, comment, 
        moderation_status, verified_purchase, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `;
    const result = await this.pool.query(query, [
      review.productId,
      review.userId,
      review.rating,
      review.comment,
      review.status,
      review.verifiedPurchase,
    ]);
    return result.rows[0];
  }

  /**
   * Update review
   */
  async update(review) {
    const query = `
      UPDATE reviews SET
        moderation_status = $1,
        moderation_notes = $2,
        helpful = $3,
        not_helpful = $4,
        updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `;
    const result = await this.pool.query(query, [
      review.status,
      review.moderationNotes,
      review.helpful,
      review.notHelpful,
      review.id,
    ]);
    return result.rows[0];
  }

  /**
   * Delete review
   */
  async delete(reviewId) {
    const query = "DELETE FROM reviews WHERE id = $1";
    await this.pool.query(query, [reviewId]);
  }
}

module.exports = ReviewRepository;
