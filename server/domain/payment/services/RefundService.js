const logger = require("../../../shared/utils/logger");
const PaymentRepository = require("../repositories/PaymentRepository");
const { pool } = require("../../../config/db");
const PERMISSIONS = require("../../../shared/constants/permissions");
const BaseService = require("../../base/BaseService");

/**
 * RefundService
 * Encapsulates refund processing business logic.
 */
class RefundService extends BaseService {
  constructor() {
    super();
    this.repository = new PaymentRepository();
  }

  /**
   * Create a refund for a payment
   */
  async createRefund(paymentId, userId, amount, reason = "Customer requested") {
    // Get payment with authorization
    const payment = await this._getPaymentWithUser(paymentId, userId);
    if (!payment) {
      throw {
        status: 404,
        message: "Payment not found",
      };
    }

    // Check if payment can be refunded
    const canRefund = await this.repository.canRefundPayment(paymentId);
    if (!canRefund) {
      throw {
        status: 400,
        message: "Payment cannot be refunded",
      };
    }

    // Check refund amount
    const totalRefunded = await this.repository.getTotalRefunded(paymentId);
    const remaining = payment.amount - totalRefunded;

    if (amount > remaining) {
      throw {
        status: 400,
        message: `Refund amount exceeds remaining balance. Maximum refund: ${remaining}`,
      };
    }

    // Create refund record
    const refund = await this.repository.createRefund(
      paymentId,
      amount,
      reason,
      {
        requested_at: new Date(),
        requested_by_user: userId,
      }
    );

    logger.info("Refund created", {
      paymentId,
      refundId: refund.id,
      amount,
      userId,
    });

    return {
      refund_id: refund.id,
      payment_id: refund.payment_id,
      amount: refund.amount,
      reason: refund.reason,
      status: refund.status,
      created_at: refund.created_at,
    };
  }

  /**
   * Get refund by ID with authorization
   */
  async getRefundById(refundId, userId) {
    const refund = await this.repository.getRefundById(refundId);

    if (!refund) {
      throw {
        status: 404,
        message: "Refund not found",
      };
    }

    // Get payment to check authorization
    const result = await pool.query(
      `SELECT p.id, p.order_id, o.user_id
       FROM payments p
       JOIN orders o ON p.order_id = o.id
       WHERE p.id = $1`,
      [refund.payment_id]
    );

    if (!result.rows.length) {
      throw {
        status: 404,
        message: "Associated payment not found",
      };
    }

    const paymentData = result.rows[0];
    if (Number(paymentData.user_id) !== Number(userId)) {
      throw {
        status: 403,
        message: "Unauthorized access to refund",
      };
    }

    return refund;
  }

  /**
   * Get refunds for a payment
   */
  async getPaymentRefunds(paymentId, userId) {
    // Get payment with authorization
    const payment = await this._getPaymentWithUser(paymentId, userId);
    if (!payment) {
      throw {
        status: 404,
        message: "Payment not found",
      };
    }

    // Get all refunds for this payment
    const refunds = await this.repository.getPaymentRefunds(paymentId);

    // Calculate totals
    const totalRefunded = await this.repository.getTotalRefunded(paymentId);
    const remaining = payment.amount - totalRefunded;

    return {
      payment_id: paymentId,
      refunds,
      summary: {
        original_amount: payment.amount,
        total_refunded: totalRefunded,
        remaining_balance: remaining,
      },
    };
  }

  /**
   * Update refund status (admin only)
   */
  async processRefund(refundId, userId, isAdmin = false, employeeId = null) {
    if (employeeId) {
      await this.validatePermission(employeeId, PERMISSIONS.PAYMENT.REFUND);
    } else if (!isAdmin) {
      throw {
        status: 403,
        message: "Only admins can process refunds",
      };
    }

    const refund = await this.getRefundById(refundId, userId);

    if (refund.status !== "pending") {
      throw {
        status: 400,
        message: `Refund cannot be processed. Current status: ${refund.status}`,
      };
    }

    // Update refund status
    const updatedRefund = await this.repository.updateRefundStatus(
      refundId,
      "completed"
    );

    logger.info("Refund processed", {
      refundId,
      amount: updatedRefund.amount,
      userId,
    });

    if (employeeId) {
      await this.auditLog(employeeId, "payment:refund", "refund", updatedRefund.id, {
        paymentId: updatedRefund.payment_id,
        status: "completed",
      });
    }

    return {
      refund_id: updatedRefund.id,
      payment_id: updatedRefund.payment_id,
      amount: updatedRefund.amount,
      status: updatedRefund.status,
      processed_at: updatedRefund.updated_at,
    };
  }

  /**
   * Reject/cancel a refund request
   */
  async rejectRefund(refundId, userId, reason = "", isAdmin = false, employeeId = null) {
    if (employeeId) {
      await this.validatePermission(employeeId, PERMISSIONS.PAYMENT.REFUND);
    } else if (!isAdmin) {
      throw {
        status: 403,
        message: "Only admins can reject refunds",
      };
    }

    const refund = await this.getRefundById(refundId, userId);

    if (refund.status !== "pending") {
      throw {
        status: 400,
        message: `Refund cannot be rejected. Current status: ${refund.status}`,
      };
    }

    // Update refund status
    const updatedRefund = await this.repository.updateRefundStatus(
      refundId,
      "rejected"
    );

    logger.info("Refund rejected", {
      refundId,
      reason,
      userId,
    });

    if (employeeId) {
      await this.auditLog(employeeId, "payment:refund", "refund", updatedRefund.id, {
        paymentId: updatedRefund.payment_id,
        status: "rejected",
        reason,
      });
    }

    return {
      refund_id: updatedRefund.id,
      payment_id: updatedRefund.payment_id,
      status: updatedRefund.status,
      rejection_reason: reason,
      rejected_at: updatedRefund.updated_at,
    };
  }

  /**
   * Internal: Get payment with user authorization
   */
  async _getPaymentWithUser(paymentId, userId) {
    const result = await pool.query(
      `SELECT p.id, p.amount, p.status, o.user_id
       FROM payments p
       JOIN orders o ON p.order_id = o.id
       WHERE p.id = $1`,
      [paymentId]
    );

    if (!result.rows.length) {
      return null;
    }

    const paymentData = result.rows[0];
    if (Number(paymentData.user_id) !== Number(userId)) {
      return null;
    }

    return paymentData;
  }
}

module.exports = RefundService;
