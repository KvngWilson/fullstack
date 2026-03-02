/**
 * Payment Validation Schemas - Phase 7
 * Joi validators for payment and refund operations
 */

const Joi = require("joi");
const {
  currencySchema,
  optionalCurrencySchema,
  statusSchema,
  postalCodeSchema,
} = require("./common");

// ===== PAYMENT SCHEMAS =====

/**
 * Create payment schema
 * Validates payment initialization request
 */
const createPaymentSchema = Joi.object({
  order_id: Joi.number().integer().positive().required().messages({
    "number.positive": "order_id must be a positive number",
    "any.required": "order_id is required",
  }),
  amount: Joi.number().positive().precision(2).required().messages({
    "number.positive": "amount must be greater than 0",
    "any.required": "amount is required",
  }),
  currency: Joi.string()
    .valid("USD", "EUR", "GBP", "CAD", "AUD", "JPY")
    .default("USD")
    .optional(),
  processor: Joi.string()
    .valid("stripe", "paystack", "paypal")
    .optional()
    .messages({
      "any.only": "processor must be one of: stripe, paystack, paypal",
    }),
}).unknown(false);

/**
 * Verify payment schema
 * Validates payment verification request
 */
const verifyPaymentSchema = Joi.object({
  reference: Joi.string().trim().required().messages({
    "any.required": "Payment reference is required",
  }),
  session_id: Joi.string().trim().optional(),
}).unknown(false);

/**
 * Get payment list schema
 * Validates payment list query parameters
 */
const getPaymentListSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).optional(),
  pageSize: Joi.number().integer().min(1).max(100).default(20).optional(),
  status: statusSchema.optional(),
  order_id: Joi.number().integer().positive().optional(),
  start_date: Joi.string().isoDate().optional(),
  end_date: Joi.string().isoDate().optional(),
}).unknown(false);

/**
 * Update payment status schema
 * Validates payment status update request
 */
const updatePaymentStatusSchema = Joi.object({
  status: Joi.string()
    .valid("pending", "processing", "succeeded", "failed", "cancelled")
    .required()
    .messages({
      "any.only":
        "status must be one of: pending, processing, succeeded, failed, cancelled",
      "any.required": "status is required",
    }),
  reason: Joi.string().trim().optional().max(500),
}).unknown(false);

// ===== REFUND SCHEMAS =====

/**
 * Create refund schema
 * Validates refund creation request
 */
const createRefundSchema = Joi.object({
  payment_id: Joi.number().integer().positive().required().messages({
    "number.positive": "payment_id must be a positive number",
    "any.required": "payment_id is required",
  }),
  amount: Joi.number()
    .positive()
    .precision(2)
    .optional()
    .messages({
      "number.positive": "refund amount must be greater than 0",
    }),
  reason: Joi.string()
    .valid(
      "customer_request",
      "fraud",
      "return",
      "partial_return",
      "duplicate",
      "product_unacceptable"
    )
    .required()
    .messages({
      "any.only":
        "reason must be one of: customer_request, fraud, return, partial_return, duplicate, product_unacceptable",
      "any.required": "reason is required",
    }),
  note: Joi.string().trim().optional().max(500),
}).unknown(false);

/**
 * Get refund list schema
 * Validates refund list query parameters
 */
const getRefundListSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).optional(),
  pageSize: Joi.number().integer().min(1).max(100).default(20).optional(),
  status: statusSchema.optional(),
  payment_id: Joi.number().integer().positive().optional(),
  reason: Joi.string().optional(),
  start_date: Joi.string().isoDate().optional(),
  end_date: Joi.string().isoDate().optional(),
}).unknown(false);

/**
 * Update refund status schema
 * Validates refund status update request
 */
const updateRefundStatusSchema = Joi.object({
  status: Joi.string()
    .valid("pending", "processing", "succeeded", "failed", "cancelled")
    .required()
    .messages({
      "any.only":
        "status must be one of: pending, processing, succeeded, failed, cancelled",
      "any.required": "status is required",
    }),
  reason: Joi.string().trim().optional().max(500),
}).unknown(false);

// ===== WEBHOOK SCHEMAS =====

/**
 * Stripe webhook schema
 * Validates Stripe webhook payload
 */
const stripeWebhookSchema = Joi.object({
  id: Joi.string().required(),
  object: Joi.string().equal("event").required(),
  api_version: Joi.string().optional(),
  created: Joi.number().required(),
  data: Joi.object({
    object: Joi.any().required(),
    previous_attributes: Joi.object().optional(),
  }).required(),
  livemode: Joi.boolean().required(),
  pending_webhooks: Joi.number().required(),
  request: Joi.object().allow(null),
  type: Joi.string().required(),
}).unknown(true); // Allow unknown fields for Stripe data

/**
 * Paystack webhook schema
 * Validates Paystack webhook payload
 */
const paystackWebhookSchema = Joi.object({
  event: Joi.string().required(),
  data: Joi.object({
    id: Joi.number().required(),
    reference: Joi.string().required(),
    amount: Joi.number().required(),
    status: Joi.string().required(),
    customer: Joi.object().allow(null),
    metadata: Joi.object().allow(null),
  }).required(),
}).unknown(true);

// ===== VALIDATION FUNCTIONS =====

/**
 * Validate create payment request
 * @param {Object} data - Request body
 * @returns {Object} Validation result
 */
function validateCreatePayment(data) {
  return createPaymentSchema.validate(data);
}

/**
 * Validate verify payment request
 * @param {Object} data - Request body/params
 * @returns {Object} Validation result
 */
function validateVerifyPayment(data) {
  return verifyPaymentSchema.validate(data);
}

/**
 * Validate payment list query
 * @param {Object} query - Query parameters
 * @returns {Object} Validation result
 */
function validatePaymentListQuery(query) {
  return getPaymentListSchema.validate(query);
}

/**
 * Validate update payment status
 * @param {Object} data - Request body
 * @returns {Object} Validation result
 */
function validateUpdatePaymentStatus(data) {
  return updatePaymentStatusSchema.validate(data);
}

/**
 * Validate create refund request
 * @param {Object} data - Request body
 * @returns {Object} Validation result
 */
function validateCreateRefund(data) {
  return createRefundSchema.validate(data);
}

/**
 * Validate refund list query
 * @param {Object} query - Query parameters
 * @returns {Object} Validation result
 */
function validateRefundListQuery(query) {
  return getRefundListSchema.validate(query);
}

/**
 * Validate update refund status
 * @param {Object} data - Request body
 * @returns {Object} Validation result
 */
function validateUpdateRefundStatus(data) {
  return updateRefundStatusSchema.validate(data);
}

/**
 * Validate Stripe webhook
 * @param {Object} data - Webhook payload
 * @returns {Object} Validation result
 */
function validateStripeWebhook(data) {
  return stripeWebhookSchema.validate(data);
}

/**
 * Validate Paystack webhook
 * @param {Object} data - Webhook payload
 * @returns {Object} Validation result
 */
function validatePaystackWebhook(data) {
  return paystackWebhookSchema.validate(data);
}

// ===== MODULE EXPORTS =====

module.exports = {
  // Schemas
  createPaymentSchema,
  verifyPaymentSchema,
  getPaymentListSchema,
  updatePaymentStatusSchema,
  createRefundSchema,
  getRefundListSchema,
  updateRefundStatusSchema,
  stripeWebhookSchema,
  paystackWebhookSchema,

  // Validation functions
  validateCreatePayment,
  validateVerifyPayment,
  validatePaymentListQuery,
  validateUpdatePaymentStatus,
  validateCreateRefund,
  validateRefundListQuery,
  validateUpdateRefundStatus,
  validateStripeWebhook,
  validatePaystackWebhook,
};
