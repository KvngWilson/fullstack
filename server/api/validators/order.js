/**
 * Order & Cart Validation Schemas
 * Joi validators for order and cart operations (Ordering domain)
 */

const Joi = require("joi");
const { idSchema, optionalIdSchema, statusSchema } = require("./common");

// ===== ORDER SCHEMAS =====

/**
 * Create order schema
 * Validates order creation request
 */
const createOrderSchema = Joi.object({
  shipping_address_id: Joi.number().integer().positive().required().messages({
    "number.positive": "shipping_address_id must be a positive number",
    "any.required": "shipping_address_id is required",
  }),
  billing_address_id: Joi.number().integer().positive().required().messages({
    "number.positive": "billing_address_id must be a positive number",
    "any.required": "billing_address_id is required",
  }),
  coupon_code: Joi.string().trim().optional().max(50),
  notes: Joi.string().trim().optional().max(500),
}).unknown(false);

/**
 * Update order schema
 * Validates order update request
 */
const updateOrderSchema = Joi.object({
  status: statusSchema.optional(),
  notes: Joi.string().trim().optional().max(500),
})
  .unknown(false)
  .min(1);

/**
 * Get orders list schema
 * Validates order list query parameters
 */
const getOrdersListSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).optional(),
  pageSize: Joi.number().integer().min(1).max(100).default(20).optional(),
  status: Joi.string()
    .valid("pending", "confirmed", "shipping", "delivered", "cancelled")
    .optional(),
  sort: Joi.string().valid("created_at", "updated_at", "total").optional(),
  order: Joi.string().valid("ASC", "DESC").optional(),
  start_date: Joi.string().isoDate().optional(),
  end_date: Joi.string().isoDate().optional(),
}).unknown(false);

/**
 * Cancel order schema
 * Validates order cancellation request
 */
const cancelOrderSchema = Joi.object({
  reason: Joi.string().trim().required().max(500).messages({
    "any.required": "Cancellation reason is required",
  }),
}).unknown(false);

/**
 * Add order item schema
 * Validates adding items to an order
 */
const addOrderItemSchema = Joi.object({
  product_variant_id: Joi.number().integer().positive().required().messages({
    "number.positive": "product_variant_id must be a positive number",
    "any.required": "product_variant_id is required",
  }),
  quantity: Joi.number().integer().min(1).max(1000).required().messages({
    "number.min": "quantity must be at least 1",
    "number.max": "quantity cannot exceed 1000",
    "any.required": "quantity is required",
  }),
}).unknown(false);

// ===== CART SCHEMAS =====

/**
 * Create/get cart schema
 * Validates cart creation or retrieval
 */
const createCartSchema = Joi.object({}).unknown(false);

/**
 * Add to cart schema
 * Validates item addition to cart
 */
const addToCartSchema = Joi.object({
  product_variant_id: Joi.number().integer().positive().required().messages({
    "number.positive": "product_variant_id must be a positive number",
    "any.required": "product_variant_id is required",
  }),
  quantity: Joi.number().integer().min(1).max(1000).required().messages({
    "number.min": "quantity must be at least 1",
    "number.max": "Quantity cannot exceed 1000",
    "any.required": "quantity is required",
  }),
}).unknown(false);

/**
 * Update cart item schema
 * Validates cart item quantity update
 */
const updateCartItemSchema = Joi.object({
  quantity: Joi.number().integer().min(0).max(1000).required().messages({
    "number.max": "quantity cannot exceed 1000",
    "any.required": "quantity is required",
  }),
}).unknown(false);

/**
 * Apply coupon schema
 * Validates coupon code application
 */
const applyCouponSchema = Joi.object({
  coupon_code: Joi.string().trim().required().max(50).messages({
    "any.required": "coupon_code is required",
  }),
}).unknown(false);

/**
 * Clear cart schema
 * Validates cart clearing request
 */
const clearCartSchema = Joi.object({
  confirm: Joi.boolean().required().messages({
    "any.required": "confirm is required",
  }),
}).unknown(false);

// ===== ADDRESS SCHEMAS =====

/**
 * Create address schema
 * Validates address creation request
 */
const createAddressSchema = Joi.object({
  street: Joi.string().trim().required().max(255).messages({
    "any.required": "street is required",
  }),
  city: Joi.string().trim().required().max(100).messages({
    "any.required": "city is required",
  }),
  state: Joi.string().trim().required().max(100).messages({
    "any.required": "state is required",
  }),
  postal_code: Joi.string()
    .trim()
    .required()
    .pattern(/^[A-Za-z0-9\s\-]{3,10}$/)
    .messages({
      "string.pattern.base": "Invalid postal code format",
      "any.required": "postal_code is required",
    }),
  country: Joi.string().trim().required().max(100).messages({
    "any.required": "country is required",
  }),
  is_default: Joi.boolean().optional().default(false),
}).unknown(false);

/**
 * Update address schema
 * Validates address update request
 */
const updateAddressSchema = Joi.object({
  street: Joi.string().trim().optional().max(255),
  city: Joi.string().trim().optional().max(100),
  state: Joi.string().trim().optional().max(100),
  postal_code: Joi.string()
    .trim()
    .optional()
    .pattern(/^[A-Za-z0-9\s\-]{3,10}$/),
  country: Joi.string().trim().optional().max(100),
  is_default: Joi.boolean().optional(),
})
  .unknown(false)
  .min(1);

/**
 * Get addresses list schema
 * Validates address list query parameters
 */
const getAddressesListSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).optional(),
  pageSize: Joi.number().integer().min(1).max(100).default(20).optional(),
  is_default: Joi.boolean().optional(),
}).unknown(false);

// ===== SHIPMENT SCHEMAS =====

/**
 * Create shipment schema
 * Validates shipment creation request
 */
const createShipmentSchema = Joi.object({
  shipping_method: Joi.string()
    .valid("standard", "express", "overnight", "pickup")
    .required()
    .messages({
      "any.only":
        "shipping_method must be one of: standard, express, overnight, pickup",
      "any.required": "shipping_method is required",
    }),
  tracking_number: Joi.string().trim().optional().max(100),
  estimated_delivery: Joi.string().isoDate().optional(),
}).unknown(false);

/**
 * Update shipment status schema
 * Validates shipment status update
 */
const updateShipmentStatusSchema = Joi.object({
  status: Joi.string()
    .valid(
      "pending",
      "processing",
      "shipped",
      "in_transit",
      "delivered",
      "failed",
    )
    .required()
    .messages({
      "any.only":
        "status must be one of: pending, processing, shipped, in_transit, delivered, failed",
      "any.required": "status is required",
    }),
  tracking_number: Joi.string().trim().optional().max(100),
  notes: Joi.string().trim().optional().max(500),
}).unknown(false);

// ===== VALIDATION FUNCTIONS =====

/**
 * Validate create order request
 * @param {Object} data - Request body
 * @returns {Object} Validation result
 */
function validateCreateOrder(data) {
  return createOrderSchema.validate(data);
}

/**
 * Validate update order request
 * @param {Object} data - Request body
 * @returns {Object} Validation result
 */
function validateUpdateOrder(data) {
  return updateOrderSchema.validate(data);
}

/**
 * Validate orders list query
 * @param {Object} query - Query parameters
 * @returns {Object} Validation result
 */
function validateOrdersListQuery(query) {
  return getOrdersListSchema.validate(query);
}

/**
 * Validate cancel order request
 * @param {Object} data - Request body
 * @returns {Object} Validation result
 */
function validateCancelOrder(data) {
  return cancelOrderSchema.validate(data);
}

/**
 * Validate add to cart request
 * @param {Object} data - Request body
 * @returns {Object} Validation result
 */
function validateAddToCart(data) {
  return addToCartSchema.validate(data);
}

/**
 * Validate update cart item request
 * @param {Object} data - Request body
 * @returns {Object} Validation result
 */
function validateUpdateCartItem(data) {
  return updateCartItemSchema.validate(data);
}

/**
 * Validate apply coupon request
 * @param {Object} data - Request body
 * @returns {Object} Validation result
 */
function validateApplyCoupon(data) {
  return applyCouponSchema.validate(data);
}

/**
 * Validate create address request
 * @param {Object} data - Request body
 * @returns {Object} Validation result
 */
function validateCreateAddress(data) {
  return createAddressSchema.validate(data);
}

/**
 * Validate update address request
 * @param {Object} data - Request body
 * @returns {Object} Validation result
 */
function validateUpdateAddress(data) {
  return updateAddressSchema.validate(data);
}

/**
 * Validate addresses list query
 * @param {Object} query - Query parameters
 * @returns {Object} Validation result
 */
function validateAddressesListQuery(query) {
  return getAddressesListSchema.validate(query);
}

/**
 * Validate create shipment request
 * @param {Object} data - Request body
 * @returns {Object} Validation result
 */
function validateCreateShipment(data) {
  return createShipmentSchema.validate(data);
}

/**
 * Validate update shipment status request
 * @param {Object} data - Request body
 * @returns {Object} Validation result
 */
function validateUpdateShipmentStatus(data) {
  return updateShipmentStatusSchema.validate(data);
}

// ===== MODULE EXPORTS =====

module.exports = {
  // Order schemas
  createOrderSchema,
  updateOrderSchema,
  getOrdersListSchema,
  cancelOrderSchema,
  addOrderItemSchema,

  // Cart schemas
  createCartSchema,
  addToCartSchema,
  updateCartItemSchema,
  applyCouponSchema,
  clearCartSchema,

  // Address schemas
  createAddressSchema,
  updateAddressSchema,
  getAddressesListSchema,

  // Shipment schemas
  createShipmentSchema,
  updateShipmentStatusSchema,

  // Order validation functions
  validateCreateOrder,
  validateUpdateOrder,
  validateOrdersListQuery,
  validateCancelOrder,

  // Cart validation functions
  validateAddToCart,
  validateUpdateCartItem,
  validateApplyCoupon,

  // Address validation functions
  validateCreateAddress,
  validateUpdateAddress,
  validateAddressesListQuery,

  // Shipment validation functions
  validateCreateShipment,
  validateUpdateShipmentStatus,
};
