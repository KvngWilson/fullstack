const APP_URL = process.env.APP_URL || "http://localhost:5000";

function getSupportedProcessors(providers) {
  return Array.isArray(providers) && providers.length > 0
    ? providers
    : ["paystack", "stripe"];
}

function normalizeProcessor(requestedProcessor, supportedProcessors) {
  const processor = (requestedProcessor || "paystack").toLowerCase();
  if (!supportedProcessors.includes(processor)) {
    return null;
  }
  return processor;
}

function parseCreatePaymentPayload(body = {}) {
  const { order_id, amount, currency = "USD", processor } = body;

  const normalizedOrderId = Number.parseInt(order_id, 10);
  const normalizedAmount = Number(amount);

  if (
    !Number.isInteger(normalizedOrderId) ||
    normalizedOrderId < 1 ||
    !Number.isFinite(normalizedAmount) ||
    normalizedAmount <= 0
  ) {
    return {
      error: "order_id and amount are required",
      status: 400,
    };
  }

  return {
    data: {
      orderId: normalizedOrderId,
      amount: normalizedAmount,
      currency,
      requestedProcessor: processor,
    },
  };
}

function buildPaymentMetadata({ orderId, userId, processor, reference }) {
  const baseMetadata = {
    order_id: String(orderId),
    user_id: String(userId),
  };

  if (processor === "stripe") {
    return {
      ...baseMetadata,
      order_reference: reference,
    };
  }

  return {
    ...baseMetadata,
    custom_fields: [
      {
        display_name: "Order ID",
        variable_name: "order_id",
        value: orderId,
      },
    ],
  };
}

function buildPaymentUrls({ processor, orderId }) {
  const successUrl =
    processor === "stripe"
      ? `${APP_URL}/api/v1/payments/callback?processor=stripe&session_id={CHECKOUT_SESSION_ID}`
      : `${APP_URL}/order-confirmation?order_id=${orderId}&status=success&processor=${processor}&session_id={CHECKOUT_SESSION_ID}`;

  const cancelUrl = `${APP_URL}/checkout?status=cancelled&processor=${processor}&order_id=${orderId}`;

  return { successUrl, cancelUrl };
}

function getPagination(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page || "1", 10) || 1);
  const pageSizeParam = query.pageSize || query.limit || "20";
  const pageSize = Math.max(
    1,
    Math.min(100, Number.parseInt(pageSizeParam, 10) || 20),
  );
  const offset = (page - 1) * pageSize;

  return { page, pageSize, offset };
}

module.exports = {
  APP_URL,
  getSupportedProcessors,
  normalizeProcessor,
  parseCreatePaymentPayload,
  buildPaymentMetadata,
  buildPaymentUrls,
  getPagination,
};
