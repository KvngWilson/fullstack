const logger = require("../../../shared/utils/logger");
const { pool } = require("../../../config/db");
const PaymentRepository = require("../repositories/PaymentRepository");

// Import service functions directly
const PaystackService = require("./PaystackService");
const StripeService = require("./StripeService");
const {
  getSupportedProcessors,
  normalizeProcessor,
  buildPaymentMetadata,
  buildPaymentUrls,
} = require("./payment.support");
const {
  processSuccessfulOrderPayment,
  withTransaction,
} = require("./payment.workflow");

/**
 * PaymentService
 * Encapsulates payment processing business logic.
 */
class PaymentService {
  constructor() {
    this.repository = new PaymentRepository();
  }

  /**
   * Create a new payment for an order
   */
  async createPayment(userId, orderId, amount, currency, requestedProcessor) {
    // Validate order ownership
    const order = await this.repository.getOrderForPayment(orderId, userId);
    if (!order) {
      throw {
        status: 404,
        message: "Order not found",
      };
    }

    // Check if order is already paid
    const alreadyPaid = await this.repository.isOrderAlreadyPaid(orderId);
    if (alreadyPaid) {
      throw {
        status: 400,
        message: "Order has already been paid",
      };
    }

    // Normalize processor
    const supportedProcessors = getSupportedProcessors(["paystack", "stripe"]);
    const processor = normalizeProcessor(requestedProcessor, supportedProcessors);

    if (!processor) {
      throw {
        status: 400,
        message: "Unsupported payment processor",
      };
    }

    // Get user email for payment
    const result = await this._getUserEmail(userId);
    if (!result) {
      throw {
        status: 404,
        message: "User not found",
      };
    }

    const userEmail = result.email;

    // Generate payment reference
    const reference = processor === "stripe" ? StripeService.generateReference("STR") : PaystackService.generateReference("PAY");

    // Build payment metadata
    const metadata = buildPaymentMetadata({
      orderId,
      userId,
      processor,
      reference,
    });

    // Build payment URLs
    const { successUrl, cancelUrl } = buildPaymentUrls({
      processor,
      orderId,
    });

    // Initialize payment with provider
    let paymentResult;
    if (processor === "stripe") {
      paymentResult = await StripeService.createPaymentIntent({
        amount,
        currency,
        description: reference,
        metadata,
        customer_email: userEmail,
      });
    } else {
      paymentResult = await PaystackService.initializePayment({
        email: userEmail,
        amount,
        reference,
        currency,
        metadata,
      });
    }

    if (!paymentResult.success) {
      logger.error("Failed to initialize payment", {
        error: paymentResult.message,
        userId,
        orderId,
        processor,
      });

      throw {
        status: 500,
        message: paymentResult.message || "Failed to initialize payment",
      };
    }

    // Create payment record in database
    const paymentRecord = await this.repository.createPayment(
      orderId,
      paymentResult.data.reference || reference,
      amount,
      "pending"
    );

    return {
      payment_id: paymentRecord.id,
      authorization_url: paymentResult.data.authorization_url,
      access_code: paymentResult.data.access_code,
      reference: paymentResult.data.reference,
      amount,
      currency,
      processor,
      session_id: paymentResult.data.session_id,
      payment_intent: paymentResult.data.payment_intent,
    };
  }

  /**
   * Verify payment status and update if successful
   */
  async verifyPaymentStatus(reference, userId) {
    // Get payment record
    const payment = await this.repository.getPaymentByReference(reference);
    if (!payment) {
      throw {
        status: 404,
        message: "Payment not found",
      };
    }

    // Verify authorization
    const userPayment = await this.repository.getPaymentById(payment.id, userId);
    if (!userPayment) {
      throw {
        status: 403,
        message: "Unauthorized access to payment",
      };
    }

    // Verify with payment provider
    const processor = reference?.startsWith("STR") ? "stripe" : "paystack";
    let verificationResult;
    if (processor === "stripe") {
      verificationResult = await StripeService.verifyPaymentIntent(reference);
    } else {
      verificationResult = await PaystackService.verifyPayment(reference);
    }

    if (!verificationResult.success) {
      logger.warn("Payment verification failed", {
        reference,
        processor,
        message: verificationResult.message,
      });

      throw {
        status: 400,
        message: verificationResult.message || "Payment verification failed",
      };
    }

    // Update payment status in database
    const updatedPayment = await this.repository.updatePaymentStatus(
      reference,
      "succeeded"
    );

    if (!updatedPayment) {
      throw {
        status: 500,
        message: "Failed to update payment status",
      };
    }

    // Process order as paid (update order status, apply inventory, send emails)
    await withTransaction(pool, async (client) => {
      await processSuccessfulOrderPayment(client, updatedPayment.order_id);
    });

    return {
      payment_id: updatedPayment.id,
      order_id: updatedPayment.order_id,
      reference: updatedPayment.stripe_payment_id,
      amount: updatedPayment.amount,
      status: updatedPayment.status,
      verified: true,
      verified_at: new Date(),
      transaction_details: verificationResult.data,
      processor,
    };
  }

  /**
   * Get payment by ID with authorization
   */
  async getPaymentById(paymentId, userId) {
    const payment = await this.repository.getPaymentById(paymentId, userId);

    if (!payment) {
      throw {
        status: 404,
        message: "Payment not found",
      };
    }

    return payment;
  }

  /**
   * Get user's payment history
   */
  async getUserPayments(userId, page = 1, pageSize = 20) {
    const { payments, total, pageSize: normalizedPageSize } =
      await this.repository.getUserPayments(userId, page, pageSize);

    return {
      payments,
      meta: {
        page,
        pageSize: normalizedPageSize,
        total,
        totalPages: Math.ceil(total / normalizedPageSize) || 1,
      },
    };
  }

  /**
   * Handle payment callback from provider
   */
  async handlePaymentCallback(reference, processor) {
    if (!reference) {
      throw {
        status: 400,
        message: "Payment reference is required",
      };
    }

    // Verify payment with provider
    let verificationResult;
    if (processor === "stripe") {
      verificationResult = await StripeService.verifyPaymentIntent(reference);
    } else {
      verificationResult = await PaystackService.verifyPayment(reference);
    }

    if (!verificationResult.success) {
      logger.warn("Payment callback verification failed", {
        reference,
        processor,
        message: verificationResult.message,
      });

      throw {
        status: 400,
        message: "Payment verification failed",
      };
    }

    // Process in transaction
    let orderId;
    await withTransaction(pool, async (client) => {
      const paymentResult = await client.query(
        `UPDATE payments
         SET status = $1, updated_at = NOW()
         WHERE stripe_payment_id = $2
         RETURNING order_id`,
        ["succeeded", reference]
      );

      if (!paymentResult.rows.length) {
        throw {
          status: 404,
          message: "Payment not found",
        };
      }

      orderId = paymentResult.rows[0].order_id;
      await processSuccessfulOrderPayment(client, orderId);
    });

    return {
      orderId,
      status: "success",
      processor,
    };
  }

  /**
   * Handle webhook from payment provider
   */
  async handleWebhook(event, data, processor) {
    logger.info("Processing payment webhook", {
      event,
      processor,
      reference: data.reference || data.id,
    });

    if (processor === "paystack") {
      await this._handlePaystackWebhook(event, data);
    } else if (processor === "stripe") {
      await this._handleStripeWebhook(event, data);
    }
  }

  /**
   * Internal: Handle Paystack webhook
   */
  async _handlePaystackWebhook(event, data) {
    if (event === "charge.success") {
      const reference = data.reference;

      await withTransaction(pool, async (client) => {
        await client.query(
          `UPDATE payments
           SET status = $1, updated_at = NOW()
           WHERE stripe_payment_id = $2`,
          ["succeeded", reference]
        );

        const payment = await client.query(
          "SELECT order_id FROM payments WHERE stripe_payment_id = $1",
          [reference]
        );

        if (payment.rows.length > 0) {
          await processSuccessfulOrderPayment(client, payment.rows[0].order_id);
        }
      });
    } else if (event === "charge.failed") {
      const reference = data.reference;

      await this.repository.updatePaymentStatus(reference, "failed");
    }
  }

  /**
   * Internal: Handle Stripe webhook
   */
  async _handleStripeWebhook(event, data) {
    if (event === "checkout.session.completed") {
      const session = data.object;

      await withTransaction(pool, async (client) => {
        const paymentResult = await client.query(
          `UPDATE payments
           SET status = $1, updated_at = NOW()
           WHERE stripe_payment_id = $2
           RETURNING order_id`,
          ["succeeded", session.id]
        );

        const orderId =
          paymentResult.rows[0]?.order_id || session.metadata?.order_id;
        if (orderId) {
          await processSuccessfulOrderPayment(client, orderId);
        }
      });
    } else if (event === "payment_intent.payment_failed") {
      const intent = data.object;

      await this.repository.updatePaymentStatus(intent.id, "failed");
    }
  }

  /**
   * Internal: Get user email
   */
  async _getUserEmail(userId) {
    const result = await require("../../../config/db").pool.query(
      "SELECT id, email FROM users WHERE id = $1",
      [userId]
    );

    return result.rows[0] || null;
  }
}

// Export Stripe service functions for test compatibility
module.exports = PaymentService;
module.exports.createPaymentIntent = StripeService.createPaymentIntent;
module.exports.verifyPaymentIntent = StripeService.verifyPaymentIntent;
module.exports.refundPayment = StripeService.refundPayment;
module.exports.validateStripeWebhook = StripeService.validateStripeWebhook;
module.exports.listPaymentIntents = StripeService.listPaymentIntents;

// Export Paystack service functions for test support
module.exports.initializePayment = PaystackService.initializePayment;
module.exports.verifyPayment = PaystackService.verifyPayment;
module.exports.getTransaction = PaystackService.getTransaction;
module.exports.generateReference = PaystackService.generateReference;
module.exports.validateWebhookSignature = PaystackService.validateWebhookSignature;
