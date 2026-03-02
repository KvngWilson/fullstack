/**
 * Payment Domain Test Fixtures
 * Provides pre-configured test data and factories for payment/refund testing
 */

const testHelpers = require("../helpers/testHelpers");

// ===== FIXTURE DEFAULTS =====

const PAYMENT_DEFAULTS = {
  stripe_payment_id: "pi_test_default",
  amount: 115.0,
  status: "pending",
};

const REFUND_DEFAULTS = {
  stripe_refund_id: "re_test_default",
  amount: 115.0,
  status: "pending",
  reason: "customer_request",
};

// ===== FIXTURE FACTORIES =====

/**
 * Create pending payment
 */
async function createPendingPayment(orderId, overrides = {}) {
  return testHelpers.createTestPayment(orderId, {
    ...PAYMENT_DEFAULTS,
    status: "pending",
    ...overrides,
  });
}

/**
 * Create successful payment
 */
async function createSuccessfulPayment(orderId, overrides = {}) {
  return testHelpers.createTestPayment(orderId, {
    ...PAYMENT_DEFAULTS,
    status: "succeeded",
    ...overrides,
  });
}

/**
 * Create failed payment
 */
async function createFailedPayment(orderId, overrides = {}) {
  return testHelpers.createTestPayment(orderId, {
    ...PAYMENT_DEFAULTS,
    status: "failed",
    ...overrides,
  });
}

/**
 * Create payment for complex order
 */
async function createPaymentForOrder(orderId, amount, status = "succeeded") {
  return testHelpers.createTestPayment(orderId, {
    amount: amount,
    status: status,
    stripe_payment_id: `pi_test_${Date.now()}`,
  });
}

/**
 * Create pending refund
 */
async function createPendingRefund(paymentId, overrides = {}) {
  return testHelpers.createTestRefund(paymentId, {
    ...REFUND_DEFAULTS,
    status: "pending",
    ...overrides,
  });
}

/**
 * Create successful refund
 */
async function createSuccessfulRefund(paymentId, overrides = {}) {
  return testHelpers.createTestRefund(paymentId, {
    ...REFUND_DEFAULTS,
    status: "succeeded",
    ...overrides,
  });
}

/**
 * Create failed refund
 */
async function createFailedRefund(paymentId, overrides = {}) {
  return testHelpers.createTestRefund(paymentId, {
    ...REFUND_DEFAULTS,
    status: "failed",
    ...overrides,
  });
}

/**
 * Create partial refund
 */
async function createPartialRefund(paymentId, partialAmount, overrides = {}) {
  return testHelpers.createTestRefund(paymentId, {
    ...REFUND_DEFAULTS,
    amount: partialAmount,
    reason: "partial_return",
    ...overrides,
  });
}

/**
 * Create full return workflow
 */
async function createFullReturnWorkflow(userId) {
  const orderingFixtures = require("./ordering.fixtures");

  // Create order
  const order = await orderingFixtures.createSimpleOrder(userId, {
    total: 115.0,
    status: "completed",
  });

  // Create successful payment for order
  const payment = await createSuccessfulPayment(order.id, {
    amount: order.total,
  });

  // Create refund
  const refund = await createSuccessfulRefund(payment.id, {
    amount: order.total,
    reason: "customer_return",
  });

  return {
    order,
    payment,
    refund,
  };
}

/**
 * Create partial return workflow
 */
async function createPartialReturnWorkflow(userId, refundAmount) {
  const orderingFixtures = require("./ordering.fixtures");

  // Create order
  const order = await orderingFixtures.createSimpleOrder(userId, {
    total: 115.0,
    status: "completed",
  });

  // Create successful payment
  const payment = await createSuccessfulPayment(order.id, {
    amount: order.total,
  });

  // Create partial refund
  const refund = await createPartialRefund(payment.id, refundAmount, {
    reason: "partial_return",
    status: "succeeded",
  });

  return {
    order,
    payment,
    refund,
  };
}

/**
 * Create payment error scenario
 */
async function createPaymentErrorScenario(orderId, errorType = "insufficient_funds") {
  return testHelpers.createTestPayment(orderId, {
    stripe_payment_id: `pi_test_error_${errorType}`,
    amount: 115.0,
    status: "failed",
    error_code: errorType,
  });
}

/**
 * Create webhook test scenario
 */
async function createWebhookTestPayment(orderId) {
  return testHelpers.createTestPayment(orderId, {
    stripe_payment_id: `pi_test_webhook_${Date.now()}`,
    amount: 115.0,
    status: "pending",
    webhookPending: true,
  });
}

// ===== FIXTURE PRESETS =====

/**
 * Preset: Pending payment awaiting confirmation
 */
const pendingPaymentPreset = {
  factory: createPendingPayment,
  defaults: { status: "pending" },
};

/**
 * Preset: Successful completed payment
 */
const successfulPaymentPreset = {
  factory: createSuccessfulPayment,
  defaults: { status: "succeeded" },
};

/**
 * Preset: Failed payment for error handling tests
 */
const failedPaymentPreset = {
  factory: createFailedPayment,
  defaults: { status: "failed" },
};

/**
 * Preset: Full return/refund workflow
 */
const fullReturnWorkflowPreset = {
  factory: createFullReturnWorkflow,
  defaults: { refundStatus: "succeeded" },
};

/**
 * Preset: Partial return workflow
 */
const partialReturnWorkflowPreset = {
  factory: createPartialReturnWorkflow,
  defaults: { refundAmount: 57.5 },
};

// ===== MOCK DATA FOR TESTING =====

/**
 * Valid payment initialization payload
 */
const validPaymentPayload = {
  amount: 11500, // Amount in cents for Stripe
  currency: "usd",
  description: "Order #12345",
};

/**
 * Invalid payment payloads for validation tests
 */
const invalidPaymentPayloads = {
  missingAmount: {
    currency: "usd",
    description: "Order #12345",
  },
  negativeAmount: {
    amount: -5000,
    currency: "usd",
    description: "Order #12345",
  },
  zeroAmount: {
    amount: 0,
    currency: "usd",
    description: "Order #12345",
  },
  invalidCurrency: {
    amount: 11500,
    currency: "invalid",
    description: "Order #12345",
  },
  missingDescription: {
    amount: 11500,
    currency: "usd",
  },
};

/**
 * Valid refund payload
 */
const validRefundPayload = {
  amount: 10000, // Amount in cents
  reason: "customer_request",
};

/**
 * Invalid refund payloads
 */
const invalidRefundPayloads = {
  negativeAmount: {
    amount: -5000,
    reason: "customer_request",
  },
  zeroAmount: {
    amount: 0,
    reason: "customer_request",
  },
  invalidReason: {
    amount: 10000,
    reason: "invalid_reason",
  },
};

/**
 * Payment status workflow scenarios
 */
const paymentWorkflowScenarios = {
  newPayment: {
    initialStatus: "pending",
    expectedNextStatus: "processing",
    action: "initiatePayment",
  },
  processingPayment: {
    initialStatus: "processing",
    expectedNextStatus: "succeeded",
    action: "confirmedPayment",
  },
  failedPaymentRetry: {
    initialStatus: "failed",
    expectedNextStatus: "processing",
    action: "retryPayment",
  },
};

/**
 * Refund status workflow scenarios
 */
const refundWorkflowScenarios = {
  newRefund: {
    initialStatus: "pending",
    expectedNextStatus: "processing",
    action: "initiateRefund",
  },
  processingRefund: {
    initialStatus: "processing",
    expectedNextStatus: "succeeded",
    action: "completeRefund",
  },
  failedRefundRetry: {
    initialStatus: "failed",
    expectedNextStatus: "processing",
    action: "retryRefund",
  },
};

/**
 * Common payment error scenarios
 */
const paymentErrorScenarios = {
  cardDeclined: {
    errorCode: "card_declined",
    errorMessage: "Your card was declined",
    expectedStatus: "failed",
  },
  insufficientFunds: {
    errorCode: "insufficient_funds",
    errorMessage: "Insufficient funds",
    expectedStatus: "failed",
  },
  expiredCard: {
    errorCode: "expired_card",
    errorMessage: "Your card has expired",
    expectedStatus: "failed",
  },
  invalidCVV: {
    errorCode: "invalid_cvv",
    errorMessage: "Invalid CVV",
    expectedStatus: "failed",
  },
  networkError: {
    errorCode: "network_error",
    errorMessage: "Network error occurred",
    expectedStatus: "failed",
  },
};

/**
 * Stripe test card numbers for testing
 */
const stripeTestCards = {
  success: "4242424242424242",
  fail: "4000000000000002",
  requiresAuth: "4000002500003155",
  invalidNumber: "4000000000000069",
};

/**
 * Supported payment methods
 */
const supportedPaymentMethods = [
  "credit_card",
  "debit_card",
  "paypal",
  "apple_pay",
  "google_pay",
];

/**
 * Supported refund reasons
 */
const refundReasons = [
  "customer_request",
  "fraud",
  "return",
  "partial_return",
  "duplicate",
  "product_unacceptable",
];

/**
 * Currency codes
 */
const supportedCurrencies = ["usd", "eur", "gbp", "cad", "aud", "jpy"];

/**
 * Tax scenarios for payment
 */
const taxScenarios = {
  noTax: {
    taxRate: 0,
    subtotal: 100.0,
    expectedTax: 0,
    expectedTotal: 100.0,
  },
  standardTax: {
    taxRate: 0.1,
    subtotal: 100.0,
    expectedTax: 10.0,
    expectedTotal: 110.0,
  },
  highTax: {
    taxRate: 0.25,
    subtotal: 100.0,
    expectedTax: 25.0,
    expectedTotal: 125.0,
  },
};

/**
 * Discount scenarios
 */
const discountScenarios = {
  noDiscount: {
    discount: 0,
    subtotal: 100.0,
    tax: 10.0,
    expectedTotal: 110.0,
  },
  percentageDiscount: {
    discount: 10, // 10%
    subtotal: 100.0,
    tax: 9.0, // Calculated on discounted amount
    expectedTotal: 99.0,
  },
  flatDiscount: {
    discount: 10.0, // $10 off
    subtotal: 100.0,
    tax: 9.0,
    expectedTotal: 99.0,
  },
};

module.exports = {
  // Payment factories
  createPendingPayment,
  createSuccessfulPayment,
  createFailedPayment,
  createPaymentForOrder,

  // Refund factories
  createPendingRefund,
  createSuccessfulRefund,
  createFailedRefund,
  createPartialRefund,

  // Workflow factories
  createFullReturnWorkflow,
  createPartialReturnWorkflow,
  createPaymentErrorScenario,
  createWebhookTestPayment,

  // Presets
  pendingPaymentPreset,
  successfulPaymentPreset,
  failedPaymentPreset,
  fullReturnWorkflowPreset,
  partialReturnWorkflowPreset,

  // Mock data
  validPaymentPayload,
  invalidPaymentPayloads,
  validRefundPayload,
  invalidRefundPayloads,

  // Scenarios
  paymentWorkflowScenarios,
  refundWorkflowScenarios,
  paymentErrorScenarios,
  taxScenarios,
  discountScenarios,

  // Test data
  stripeTestCards,
  supportedPaymentMethods,
  refundReasons,
  supportedCurrencies,

  // Constants
  PAYMENT_DEFAULTS,
  REFUND_DEFAULTS,
};
