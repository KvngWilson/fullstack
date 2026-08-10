const { pool } = require("../../../config/db");

/**
 * PaymentRepository
 * Encapsulates all database operations for payment aggregates.
 */
class PaymentRepository {
  /**
   * Check if order exists and belongs to user
   */
  async getOrderForPayment(orderId, userId) {
    const result = await pool.query(
      `SELECT id, user_id, status, total FROM orders WHERE id = $1`,
      [orderId]
    );

    if (!result.rows.length) {
      return null;
    }

    const order = result.rows[0];
    if (Number(order.user_id) !== Number(userId)) {
      throw new Error("Unauthorized: Order does not belong to user");
    }

    return order;
  }

  /**
   * Check if order has already been paid
   */
  async isOrderAlreadyPaid(orderId) {
    const result = await pool.query(
      `SELECT id FROM payments WHERE order_id = $1 AND status = $2`,
      [orderId, "succeeded"]
    );

    return result.rows.length > 0;
  }

  /**
   * Create a new payment record
   */
  async createPayment(orderId, stripePaymentId, amount, status = "pending") {
    const result = await pool.query(
      `INSERT INTO payments (order_id, stripe_payment_id, amount, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [orderId, stripePaymentId, amount, status]
    );

    return result.rows[0];
  }

  /**
   * Get payment by ID with order details
   */
  async getPaymentById(paymentId, userId) {
    const result = await pool.query(
      `SELECT p.*, o.user_id
       FROM payments p
       JOIN orders o ON p.order_id = o.id
       WHERE p.id = $1`,
      [paymentId]
    );

    if (!result.rows.length) {
      return null;
    }

    const payment = result.rows[0];
    if (Number(payment.user_id) !== Number(userId)) {
      throw new Error("Unauthorized: Payment does not belong to user");
    }

    return payment;
  }

  /**
   * Get payment by reference
   */
  async getPaymentByReference(reference) {
    const result = await pool.query(
      `SELECT * FROM payments WHERE stripe_payment_id = $1`,
      [reference]
    );

    return result.rows[0] || null;
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(reference, status) {
    const result = await pool.query(
      `UPDATE payments
       SET status = $1, updated_at = NOW()
       WHERE stripe_payment_id = $2
       RETURNING *`,
      [status, reference]
    );

    return result.rows[0] || null;
  }

  /**
   * Get user's payment history
   */
  async getUserPayments(userId, page, pageSize) {
    const normalizedPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const normalizedPageSize = Math.max(1, Number.parseInt(pageSize, 10) || 20);
    const offset = (normalizedPage - 1) * normalizedPageSize;

    const [paymentsResult, countResult] = await Promise.all([
      pool.query(
        `SELECT p.*, o.total as order_total
         FROM payments p
         JOIN orders o ON p.order_id = o.id
         WHERE o.user_id = $1
         ORDER BY p.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, normalizedPageSize, offset]
      ),
      pool.query(
        `SELECT COUNT(*) as total
         FROM payments p
         JOIN orders o ON p.order_id = o.id
         WHERE o.user_id = $1`,
        [userId]
      ),
    ]);

    const total = Number.parseInt(countResult.rows[0]?.total || "0", 10);

    return {
      payments: paymentsResult.rows,
      total,
      page: normalizedPage,
      pageSize: normalizedPageSize,
    };
  }

  /**
   * Create a refund record
   */
  async createRefund(paymentId, amount, reason, metadata = {}) {
    const result = await pool.query(
      `INSERT INTO refunds (payment_id, amount, reason, metadata, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [paymentId, amount, reason, JSON.stringify(metadata), "pending"]
    );

    return result.rows[0];
  }

  /**
   * Get refund by ID
   */
  async getRefundById(refundId) {
    const result = await pool.query(
      `SELECT * FROM refunds WHERE id = $1`,
      [refundId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get refunds for a payment
   */
  async getPaymentRefunds(paymentId) {
    const result = await pool.query(
      `SELECT * FROM refunds WHERE payment_id = $1 ORDER BY created_at DESC`,
      [paymentId]
    );

    return result.rows;
  }

  /**
   * Update refund status
   */
  async updateRefundStatus(refundId, status) {
    const result = await pool.query(
      `UPDATE refunds
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, refundId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get total refunded amount for a payment
   */
  async getTotalRefunded(paymentId) {
    const result = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total_refunded
       FROM refunds
       WHERE payment_id = $1 AND status IN ('completed', 'succeeded')`,
      [paymentId]
    );

    return Number.parseFloat(result.rows[0]?.total_refunded || "0");
  }

  /**
   * Check if payment can be refunded
   */
  async canRefundPayment(paymentId) {
    const payment = await pool.query(
      `SELECT status, amount FROM payments WHERE id = $1`,
      [paymentId]
    );

    if (!payment.rows.length) {
      return false;
    }

    const paymentData = payment.rows[0];
    if (paymentData.status !== "succeeded") {
      return false;
    }

    const totalRefunded = await this.getTotalRefunded(paymentId);
    const paymentAmount = Number.parseFloat(paymentData.amount || "0");
    return totalRefunded < paymentAmount;
  }
}

module.exports = PaymentRepository;
