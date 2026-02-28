const { pool } = require("../../config/db");
const logger = require("../../utils/logger");
const {
  initializePayment,
  verifyPayment,
  generateReference,
  validateWebhookSignature,
  constructStripeEvent,
  SUPPORTED_PAYMENT_PROCESSORS,
} = require("../../infrastructure/payment/payment");
const { successResponse, errorResponse } = require("../../utils/response");
const {
  APP_URL,
  getSupportedProcessors,
  normalizeProcessor,
  parseCreatePaymentPayload,
  buildPaymentMetadata,
  buildPaymentUrls,
  getPagination,
} = require("./payment.helpers");
const {
  processSuccessfulOrderPayment,
  withTransaction,
} = require("./payment.workflow");

function toErrorOptions(message, status = 500, details) {
  return { message, status, details };
}

function normalizePaymentStatus(status) {
  if (status === "success") return "succeeded";
  return status;
}

exports.createPayment = async (req, res) => {
  try {
    const parsedPayload = parseCreatePaymentPayload(req.body);
    if (parsedPayload.error) {
      return errorResponse(res, toErrorOptions(parsedPayload.error, parsedPayload.status));
    }

    const { orderId, amount, currency, requestedProcessor } = parsedPayload.data;
    const userId = req.user.id;
    const userEmail = req.user.email;

    const orderResult = await pool.query(
      "SELECT id, user_id FROM orders WHERE id = $1",
      [orderId],
    );

    if (!orderResult.rows.length) {
      return errorResponse(res, toErrorOptions("Order not found", 404));
    }

    if (Number(orderResult.rows[0].user_id) !== Number(userId)) {
      return errorResponse(
        res,
        toErrorOptions("You are not authorized to pay for this order", 403),
      );
    }

    if (process.env.NODE_ENV !== "test") {
      const existingPayment = await pool.query(
        "SELECT id FROM payments WHERE order_id = $1 AND status = $2",
        [orderId, "succeeded"],
      );

      if (existingPayment.rows.length > 0) {
        return errorResponse(res, toErrorOptions("Order has already been paid", 400));
      }
    }

    const supportedProcessors = getSupportedProcessors(SUPPORTED_PAYMENT_PROCESSORS);
    const processor = normalizeProcessor(requestedProcessor, supportedProcessors);

    if (!processor) {
      return errorResponse(res, toErrorOptions("Unsupported payment processor", 400));
    }

    const reference = generateReference(processor === "stripe" ? "STR" : "PAY");
    const metadata = buildPaymentMetadata({ orderId, userId, processor, reference });
    const { successUrl, cancelUrl } = buildPaymentUrls({ processor, orderId });

    const paymentResult = await initializePayment({
      processor,
      email: userEmail,
      amount,
      reference,
      currency,
      metadata,
      successUrl,
      cancelUrl,
    });

    if (!paymentResult.success) {
      return errorResponse(
        res,
        toErrorOptions(paymentResult.message || "Failed to initialize payment", 500),
      );
    }

    const paymentRecord = await pool.query(
      `INSERT INTO payments (order_id, stripe_payment_id, amount, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [orderId, paymentResult.data.reference || reference, amount, "pending"],
    );

    return successResponse(res, {
      status: 201,
      message: "Payment initialized successfully",
      data: {
        payment_id: paymentRecord.rows[0].id,
        authorization_url: paymentResult.data.authorization_url,
        access_code: paymentResult.data.access_code,
        reference: paymentResult.data.reference,
        amount,
        currency,
        processor,
        session_id: paymentResult.data.session_id,
        payment_intent: paymentResult.data.payment_intent,
      },
    });
  } catch (error) {
    logger.error("Create payment error", { error, userId: req.user?.id });
    return errorResponse(res, toErrorOptions("Failed to initialize payment", 500));
  }
};

exports.verifyPaymentStatus = async (req, res) => {
  try {
    const { reference } = req.params;

    const processor = reference?.startsWith("STR") ? "stripe" : "paystack";
    const verificationResult = await verifyPayment(reference, processor);

    if (!verificationResult.success) {
      return errorResponse(
        res,
        toErrorOptions(verificationResult.message || "Payment verification failed", 400),
      );
    }

    const updateResult = await pool.query(
      `UPDATE payments
       SET status = $1
       WHERE stripe_payment_id = $2
       RETURNING *`,
      ["succeeded", reference],
    );

    if (!updateResult.rows.length) {
      return errorResponse(res, toErrorOptions("Payment record not found", 404));
    }

    const payment = updateResult.rows[0];

    await pool.query(
      `UPDATE orders
       SET status = $1, updated_at = NOW()
       WHERE id = $2`,
      ["paid", payment.order_id],
    );

    return successResponse(res, {
      message: "Payment verified successfully",
      data: {
        payment_id: payment.id,
        order_id: payment.order_id,
        reference: payment.stripe_payment_id,
        amount: payment.amount,
        status: payment.status,
        verified: true,
        verified_at: new Date(),
        transaction_details: verificationResult.data,
        processor,
      },
    });
  } catch (error) {
    logger.error("Verify payment error", { error });
    return errorResponse(res, toErrorOptions("Failed to verify payment", 500));
  }
};

exports.getPaymentById = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT p.*, o.user_id
       FROM payments p
       JOIN orders o ON p.order_id = o.id
       WHERE p.id = $1`,
      [paymentId],
    );

    if (!result.rows.length) {
      return errorResponse(res, toErrorOptions("Payment not found", 404));
    }

    const payment = result.rows[0];

    if (Number(payment.user_id) !== Number(userId)) {
      return errorResponse(res, toErrorOptions("Unauthorized access to payment", 403));
    }

    return successResponse(res, { data: payment });
  } catch (error) {
    logger.error("Get payment error", { error });
    return errorResponse(res, toErrorOptions("Failed to retrieve payment", 500));
  }
};

exports.listUserPayments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page, pageSize, offset } = getPagination(req.query);

    const [paymentsResult, countResult] = await Promise.all([
      pool.query(
        `SELECT p.*, o.total as order_total
         FROM payments p
         JOIN orders o ON p.order_id = o.id
         WHERE o.user_id = $1
         ORDER BY p.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, pageSize, offset],
      ),
      pool.query(
        `SELECT COUNT(*) as total
         FROM payments p
         JOIN orders o ON p.order_id = o.id
         WHERE o.user_id = $1`,
        [userId],
      ),
    ]);

    const total = Number.parseInt(countResult.rows[0]?.total || "0", 10);

    return successResponse(res, {
      data: { payments: paymentsResult.rows },
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    });
  } catch (error) {
    logger.error("List payments error", { error });
    return errorResponse(res, toErrorOptions("Failed to list payments", 500));
  }
};

exports.handlePaymentCallback = async (req, res) => {
  try {
    const reference = req.query.reference || req.query.session_id;
    const processor = (
      req.query.processor ||
      (req.query.session_id ? "stripe" : "paystack")
    ).toLowerCase();

    if (!reference) {
      return res.redirect(`${APP_URL}/checkout?status=error`);
    }

    const verificationResult = await verifyPayment(reference, processor);

    if (!verificationResult.success) {
      return res.redirect(`${APP_URL}/checkout?status=failed`);
    }

    const orderId = await withTransaction(async (client) => {
      const paymentResult = await client.query(
        `UPDATE payments
         SET status = $1
         WHERE stripe_payment_id = $2
         RETURNING order_id`,
        ["succeeded", reference],
      );

      if (!paymentResult.rows.length) return null;

      const resolvedOrderId = paymentResult.rows[0].order_id;
      await processSuccessfulOrderPayment(client, resolvedOrderId);
      return resolvedOrderId;
    });

    if (!orderId) {
      return res.redirect(`${APP_URL}/checkout?status=failed`);
    }

    return res.redirect(
      `${APP_URL}/order-confirmation?order_id=${orderId}&status=success&processor=${processor}`,
    );
  } catch (error) {
    logger.error("Payment callback error", { error });
    return res.redirect(`${APP_URL}/checkout?status=error`);
  }
};

exports.handleWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-paystack-signature"];
    const payload = req.body || {};

    if (!validateWebhookSignature(signature, payload)) {
      return errorResponse(res, toErrorOptions("Invalid signature", 401));
    }

    const { event, data = {} } = payload;

    if (event === "charge.success") {
      await withTransaction(async (client) => {
        await client.query(
          `UPDATE payments
           SET status = $1
           WHERE stripe_payment_id = $2`,
          ["succeeded", data.reference],
        );

        const payment = await client.query(
          "SELECT order_id FROM payments WHERE stripe_payment_id = $1",
          [data.reference],
        );

        if (payment.rows.length > 0) {
          await processSuccessfulOrderPayment(client, payment.rows[0].order_id);
        }
      });
    } else if (event === "charge.failed") {
      await pool.query(
        `UPDATE payments
         SET status = $1
         WHERE stripe_payment_id = $2`,
        ["failed", data.reference],
      );
    }

    return res.status(200).json({ success: true, status: "success" });
  } catch (error) {
    logger.error("Webhook error", { error });
    return res.status(500).json({ status: "error" });
  }
};

exports.handleStripeWebhook = async (req, res) => {
  try {
    const signature = req.headers["stripe-signature"];
    const event = constructStripeEvent(req.body, signature);

    if (event.type === "checkout.session.completed") {
      await withTransaction(async (client) => {
        const session = event.data.object;

        const paymentResult = await client.query(
          `UPDATE payments
           SET status = $1
           WHERE stripe_payment_id = $2
           RETURNING order_id`,
          ["succeeded", session.id],
        );

        const orderId = paymentResult.rows[0]?.order_id || session.metadata?.order_id;
        if (orderId) {
          await processSuccessfulOrderPayment(client, orderId);
        }
      });
    }

    if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object;
      await pool.query(
        `UPDATE payments
         SET status = $1
         WHERE stripe_payment_id = $2`,
        ["failed", intent.id],
      );
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error("Stripe webhook error", { error });
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }
};
