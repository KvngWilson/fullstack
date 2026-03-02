/**
 * Common Validation Patterns - Phase 7
 * Shared Joi schemas and validation utilities used across all validators
 */

const Joi = require("joi");

// ===== COMMON VALIDATION PATTERNS =====

/**
 * Email validation regex pattern
 * Matches standard email format
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Password validation regex pattern
 * Minimum 6 characters, at least one uppercase, one lowercase, one number
 */
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,100}$/;

// ===== COMMON JOI SCHEMAS =====

/**
 * Pagination schema - used in list endpoints
 */
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).optional(),
  pageSize: Joi.number().integer().min(1).max(100).default(20).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(), // Alternative to pageSize
  sort: Joi.string().optional(),
  order: Joi.string().valid("ASC", "DESC").optional(),
}).unknown(false);

/**
 * Email schema - reusable email validation
 */
const emailSchema = Joi.string()
  .trim()
  .lowercase()
  .email()
  .required()
  .messages({
    "string.email": "Must be a valid email address",
    "any.required": "Email is required",
  });

/**
 * Password schema - reusable password validation
 */
const passwordSchema = Joi.string()
  .min(6)
  .max(100)
  .required()
  .messages({
    "string.min": "Password must be at least 6 characters",
    "string.max": "Password must not exceed 100 characters",
    "any.required": "Password is required",
  });

/**
 * Strong password schema - requires uppercase, lowercase, numbers
 */
const strongPasswordSchema = Joi.string()
  .min(8)
  .max(100)
  .pattern(PASSWORD_PATTERN)
  .required()
  .messages({
    "string.pattern.base":
      "Password must contain uppercase, lowercase, and numbers",
    "string.min": "Password must be at least 8 characters",
    "any.required": "Password is required",
  });

/**
 * ID schema - positive integer
 */
const idSchema = Joi.number().integer().positive().required();

/**
 * Optional ID schema
 */
const optionalIdSchema = Joi.number().integer().positive().optional();

/**
 * ISO date string schema
 */
const isoDateSchema = Joi.string().isoDate().optional();

/**
 * Currency amount schema - positive number up to 2 decimals
 */
const currencySchema = Joi.number().positive().precision(2).required();

/**
 * Optional currency amount schema
 */
const optionalCurrencySchema = Joi.number().positive().precision(2).optional();

/**
 * Status enum schema - common statuses
 */
const statusSchema = Joi.string().valid(
  "active",
  "inactive",
  "pending",
  "completed",
  "cancelled",
  "failed"
);

/**
 * Phone number schema - basic validation
 */
const phoneSchema = Joi.string()
  .pattern(/^\+?[\d\s\-()]+$/)
  .max(20)
  .optional()
  .messages({
    "string.pattern.base": "Invalid phone number format",
  });

/**
 * Postal code schema - accepts various formats
 */
const postalCodeSchema = Joi.string()
  .pattern(/^[A-Za-z0-9\s\-]{3,10}$/)
  .required()
  .messages({
    "string.pattern.base": "Invalid postal code format",
  });

/**
 * URL schema
 */
const urlSchema = Joi.string().uri().optional();

/**
 * Boolean schema with string support
 */
const booleanSchema = Joi.alternatives().try(
  Joi.boolean(),
  Joi.string().valid("true", "false", "1", "0")
);

// ===== VALIDATION HELPER FUNCTIONS =====

/**
 * Validate pagination parameters
 * @param {Object} query - Query parameters
 * @returns {Object} Validation result with page, pageSize, offset
 */
function validatePagination(query = {}) {
  const { error, value } = paginationSchema.validate(query);
  if (error) {
    return { error };
  }

  const pageSize = value.pageSize || value.limit || 20;
  const page = value.page || 1;
  const offset = (page - 1) * pageSize;

  return {
    value: {
      page,
      pageSize,
      offset,
      sort: value.sort,
      order: value.order,
    },
  };
}

/**
 * Create error response for validation
 * @param {Error} error - Joi validation error
 * @returns {Object} Error response object
 */
function createValidationError(error) {
  const message =
    error.details && error.details.length > 0
      ? error.details[0].message
      : "Validation failed";

  return {
    error: message,
    details: error.details,
  };
}

/**
 * Validate email and password together
 * @param {Object} credentials - { email, password }
 * @returns {Object} Validation result
 */
function validateCredentials(credentials) {
  const schema = Joi.object({
    email: emailSchema,
    password: passwordSchema,
  }).unknown(false);

  return schema.validate(credentials);
}

// ===== MODULE EXPORTS =====

module.exports = {
  // Patterns
  EMAIL_PATTERN,
  PASSWORD_PATTERN,

  // Schemas
  paginationSchema,
  emailSchema,
  passwordSchema,
  strongPasswordSchema,
  idSchema,
  optionalIdSchema,
  isoDateSchema,
  currencySchema,
  optionalCurrencySchema,
  statusSchema,
  phoneSchema,
  postalCodeSchema,
  urlSchema,
  booleanSchema,

  // Helper functions
  validatePagination,
  createValidationError,
  validateCredentials,
};