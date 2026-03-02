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

module.exports = {
  getSupportedProcessors,
  normalizeProcessor,
  buildPaymentMetadata,
  buildPaymentUrls,
};
