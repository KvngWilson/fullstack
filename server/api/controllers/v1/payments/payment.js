const logger = require("../../../../shared/utils/logger");
const domain = require("../../../../domain");
const PaymentService = domain.payment.services.PaymentService;
const RefundService = domain.payment.services.RefundService;
const PaystackService = domain.payment.services.PaystackService;
const StripeService = domain.payment.services.StripeService;
const { successResponse, errorResponse } = require("../../../../shared/utils/response");
const {
  APP_URL,
  parseCreatePaymentPayload,
  getPagination,
} = require("./payment-helpers");

// Format error response with message, status, and optional details
function toErrorOptions(message, status = 500, details) {
  return { message, status, details };
}

exports.createPayment = async (req, res) => {
  try {
    const parsedPayload = parseCreatePaymentPayload(req.body);
    if (parsedPayload.error) {
      return errorResponse(res, toErrorOptions(parsedPayload.error, parsedPayload.status));
    }

    const { orderId, amount, currency, requestedProcessor } = parsedPayload.data;
    const userId = req.user.id;

    const paymentService = new PaymentService();
    const paymentData = await paymentService.createPayment(
      userId,
      orderId,
      amount,
      currency,
      requestedProcessor
    );

    return successResponse(res, {
      status: 201,
      message: "Payment initialized successfully",
      data: paymentData,
    });
  } catch (error) {
    const status = error.status || 500;
    const message = error.message || "Failed to initialize payment";
    logger.error("Create payment error", { error, userId: req.user?.id });
    return errorResponse(res, toErrorOptions(message, status));
  }
};


exports.verifyPaymentStatus = async (req, res) => {
  try {
    const { reference } = req.params;
    const userId = req.user.id;

    const paymentService = new PaymentService();
    const result = await paymentService.verifyPaymentStatus(reference, userId);

    return successResponse(res, {
      message: "Payment verified successfully",
      data: result,
    });
  } catch (error) {
    const status = error.status || 500;
    const message = error.message || "Payment verification failed";
    logger.error("Verify payment error", { error });
    return errorResponse(res, toErrorOptions(message, status));
  }
};


exports.getPaymentById = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.id;

    const paymentService = new PaymentService();
    const payment = await paymentService.getPaymentById(paymentId, userId);

    return successResponse(res, { data: payment });
  } catch (error) {
    const status = error.status || 500;
    const message = error.message || "Failed to retrieve payment";
    logger.error("Get payment error", { error });
    return errorResponse(res, toErrorOptions(message, status));
  }
};


exports.listUserPayments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page, pageSize } = getPagination(req.query);

    const paymentService = new PaymentService();
    const result = await paymentService.getUserPayments(userId, page, pageSize);

    return successResponse(res, {
      data: { payments: result.payments },
      meta: result.meta,
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

    const paymentService = new PaymentService();
    const result = await paymentService.handlePaymentCallback(reference, processor);

    return res.redirect(
      `${APP_URL}/order-confirmation?order_id=${result.orderId}&status=success&processor=${processor}`
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
    const rawPayload = req.rawBody || payload;

    if (!signature) {
      logger.warn("Paystack webhook missing signature header");
      return errorResponse(res, toErrorOptions("Invalid signature", 401));
    }

    if (!PaystackService.validateWebhookSignature(signature, rawPayload)) {
      logger.warn("Paystack webhook signature verification failed");
      return errorResponse(res, toErrorOptions("Invalid signature", 401));
    }

    const { event, data = {} } = payload;

    const paymentService = new PaymentService();
    await paymentService.handleWebhook(event, data, "paystack");

    return res.status(200).json({ success: true, status: "success" });
  } catch (error) {
    logger.error("Webhook error", { error });
    return res.status(500).json({ status: "error" });
  }
};


exports.handleStripeWebhook = async (req, res) => {
  try {
    const signature = req.headers["stripe-signature"];

    if (!signature) {
      logger.warn("Stripe webhook missing signature header");
      return res.status(400).send("Webhook Error: Missing stripe-signature header");
    }

    const event = StripeService.validateStripeWebhook(req.body, signature);

    const paymentService = new PaymentService();
    await paymentService.handleWebhook(event.type, event.data, "stripe");

    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error("Stripe webhook error", { error });
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }
};
