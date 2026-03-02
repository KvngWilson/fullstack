/**
 * User Validation Schemas - Phase 7
 * Joi validators for user profile and management operations (Identity domain)
 */

const Joi = require("joi");
const { emailSchema, passwordSchema, strongPasswordSchema, phoneSchema } = require("./common");

// ===== USER PROFILE SCHEMAS =====

/**
 * Update user profile schema
 * Validates user profile update request
 */
const updateUserProfileSchema = Joi.object({
  first_name: Joi.string().trim().max(100).optional(),
  last_name: Joi.string().trim().max(100).optional(),
  phone: phoneSchema,
  bio: Joi.string().trim().max(500).optional().allow("", null),
  avatar_url: Joi.string().uri().optional().allow("", null),
  date_of_birth: Joi.string().isoDate().optional().allow(null),
  preferred_language: Joi.string()
    .valid("en", "es", "fr", "de", "it", "pt", "ja", "zh")
    .optional(),
}).unknown(false).min(1);

/**
 * Change password schema
 * Validates password change request
 */
const changePasswordSchema = Joi.object({
  current_password: passwordSchema,
  new_password: strongPasswordSchema,
  confirm_password: Joi.string().valid(Joi.ref("new_password")).required().messages({
    "any.only": "Passwords do not match",
    "any.required": "Confirm password is required",
  }),
}).unknown(false);

/**
 * Update email schema
 * Validates email change request
 */
const updateEmailSchema = Joi.object({
  new_email: emailSchema,
  password: passwordSchema,
}).unknown(false);

/**
 * Email verification schema
 * Validates email verification request
 */
const emailVerificationSchema = Joi.object({
  token: Joi.string().trim().required().messages({
    "any.required": "Verification token is required",
  }),
}).unknown(false);

/**
 * Request password reset schema
 * Validates password reset request
 */
const requestPasswordResetSchema = Joi.object({
  email: emailSchema,
}).unknown(false);

/**
 * Reset password schema
 * Validates password reset confirmation
 */
const resetPasswordSchema = Joi.object({
  token: Joi.string().trim().required().messages({
    "any.required": "Reset token is required",
  }),
  new_password: strongPasswordSchema,
  confirm_password: Joi.string().valid(Joi.ref("new_password")).required().messages({
    "any.only": "Passwords do not match",
    "any.required": "Confirm password is required",
  }),
}).unknown(false);

/**
 * Get users list schema
 * Validates user list query parameters
 */
const getUsersListSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).optional(),
  pageSize: Joi.number().integer().min(1).max(100).default(20).optional(),
  role: Joi.string()
    .valid("customer", "admin", "staff", "vendor")
    .optional(),
  status: Joi.string()
    .valid("active", "inactive", "suspended", "deleted")
    .optional(),
  search: Joi.string().trim().optional().max(100), // Search by name/email
  sort: Joi.string()
    .valid("created_at", "updated_at", "first_name", "email")
    .optional(),
  order: Joi.string().valid("ASC", "DESC").optional(),
}).unknown(false);

/**
 * Update user (admin only) schema
 * Validates admin user update
 */
const updateUserSchema = Joi.object({
  first_name: Joi.string().trim().max(100).optional(),
  last_name: Joi.string().trim().max(100).optional(),
  email: emailSchema.optional(),
  role: Joi.string()
    .valid("customer", "admin", "staff", "vendor")
    .optional(),
  status: Joi.string()
    .valid("active", "inactive", "suspended")
    .optional(),
  is_verified: Joi.boolean().optional(),
}).unknown(false).min(1);

/**
 * Suspend user schema
 * Validates user suspension
 */
const suspendUserSchema = Joi.object({
  reason: Joi.string().trim().required().max(500).messages({
    "any.required": "Suspension reason is required",
  }),
  duration_days: Joi.number()
    .integer()
    .min(1)
    .optional()
    .messages({
      "number.min": "Duration must be at least 1 day",
    }),
}).unknown(false);

/**
 * Delete user account schema
 * Validates user account deletion
 */
const deleteAccountSchema = Joi.object({
  password: passwordSchema,
  reason: Joi.string().trim().optional().max(500),
  confirm_delete: Joi.string().valid("DELETE").required().messages({
    "any.only": 'Must type "DELETE" to confirm',
    "any.required": 'Confirmation required (type "DELETE")',
  }),
}).unknown(false);

/**
 * Preferences/settings schema
 * Validates user preferences update
 */
const updatePreferencesSchema = Joi.object({
  newsletter_subscribed: Joi.boolean().optional(),
  notification_email: Joi.boolean().optional(),
  notification_sms: Joi.boolean().optional(),
  two_factor_enabled: Joi.boolean().optional(),
  theme: Joi.string().valid("light", "dark", "auto").optional(),
  timezone: Joi.string().optional(),
}).unknown(false).min(1);

/**
 * Upload avatar schema
 * Validates avatar upload
 */
const uploadAvatarSchema = Joi.object({
  file: Joi.any().required().messages({
    "any.required": "Image file is required",
  }),
}).unknown(true); // Allow file field from multipart

// ===== ADDRESS SCHEMAS =====

/**
 * Add address schema
 * Validates address creation
 */
const addAddressSchema = Joi.object({
  street: Joi.string().trim().required().max(255).messages({
    "any.required": "Street address is required",
  }),
  city: Joi.string().trim().required().max(100).messages({
    "any.required": "City is required",
  }),
  state: Joi.string().trim().required().max(100).messages({
    "any.required": "State/Province is required",
  }),
  postal_code: Joi.string().trim().required().max(20).messages({
    "any.required": "Postal code is required",
  }),
  country: Joi.string().trim().required().max(100).messages({
    "any.required": "Country is required",
  }),
  address_type: Joi.string()
    .valid("shipping", "billing")
    .required()
    .messages({
      "any.only": 'Address type must be either "shipping" or "billing"',
      "any.required": "Address type is required",
    }),
  is_default: Joi.boolean().optional().default(false),
}).unknown(false);

/**
 * Update address schema
 * Validates address update
 */
const updateAddressSchema = Joi.object({
  street: Joi.string().trim().max(255).optional(),
  city: Joi.string().trim().max(100).optional(),
  state: Joi.string().trim().max(100).optional(),
  postal_code: Joi.string().trim().max(20).optional(),
  country: Joi.string().trim().max(100).optional(),
  address_type: Joi.string()
    .valid("shipping", "billing")
    .optional(),
  is_default: Joi.boolean().optional(),
}).unknown(false).min(1);

// ===== SAVED CARD SCHEMAS =====

/**
 * Add saved card schema
 * Validates saved card creation
 */
const addSavedCardSchema = Joi.object({
  card_token: Joi.string().trim().required().messages({
    "any.required": "Card token is required",
  }),
  card_last_four: Joi.string().regex(/^\d{4}$/).required().messages({
    "any.required": "Last four digits are required",
    "string.pattern.base": "Last four digits must be exactly 4 digits",
  }),
  card_brand: Joi.string()
    .valid("visa", "mastercard", "amex", "discover")
    .required()
    .messages({
      "any.only": "Card brand must be visa, mastercard, amex, or discover",
      "any.required": "Card brand is required",
    }),
  card_holder_name: Joi.string().trim().required().max(255).messages({
    "any.required": "Cardholder name is required",
  }),
  exp_month: Joi.number().integer().min(1).max(12).required().messages({
    "any.required": "Expiration month is required",
    "number.min": "Expiration month must be between 1 and 12",
    "number.max": "Expiration month must be between 1 and 12",
  }),
  exp_year: Joi.number().integer().min(new Date().getFullYear()).required().messages({
    "any.required": "Expiration year is required",
    "number.min": "Expiration year cannot be in the past",
  }),
  is_primary: Joi.boolean().optional().default(false),
}).unknown(false);

/**
 * Set primary card schema
 * Validates primary card change
 */
const setPrimaryCardSchema = Joi.object({
  is_primary: Joi.boolean().valid(true).required().messages({
    "any.only": "Must set is_primary to true",
    "any.required": "is_primary is required",
  }),
}).unknown(false);

// ===== VALIDATION FUNCTIONS =====

/**
 * Validate update user profile request
 * @param {Object} data - Request body
 * @returns {Object} Validation result
 */
function validateUpdateUserProfile(data) {
  return updateUserProfileSchema.validate(data);
}

/**
 * Validate change password request
 * @param {Object} data - Request body
 * @returns {Object} Validation result
 */
function validateChangePassword(data) {
  return changePasswordSchema.validate(data);
}

/**
 * Validate update email request
 * @param {Object} data - Request body
 * @returns {Object} Validation result
 */
function validateUpdateEmail(data) {
  return updateEmailSchema.validate(data);
}

/**
 * Validate email verification request
 * @param {Object} data - Request body
 * @returns {Object} Validation result
 */
function validateEmailVerification(data) {
  return emailVerificationSchema.validate(data);
}

/**
 * Validate password reset request
 * @param {Object} data - Request body
 * @returns {Object} Validation result
 */
function validateRequestPasswordReset(data) {
  return requestPasswordResetSchema.validate(data);
}

/**
 * Validate reset password request
 * @param {Object} data - Request body
 * @returns {Object} Validation result
 */
function validateResetPassword(data) {
  return resetPasswordSchema.validate(data);
}

/**
 * Validate users list query
 * @param {Object} query - Query parameters
 * @returns {Object} Validation result
 */
function validateUsersListQuery(query) {
  return getUsersListSchema.validate(query);
}

/**
 * Validate update user request (admin)
 * @param {Object} data - Request body
 * @returns {Object} Validation result
 */
function validateUpdateUser(data) {
  return updateUserSchema.validate(data);
}

/**
 * Validate suspend user request
 * @param {Object} data - Request body
 * @returns {Object} Validation result
 */
function validateSuspendUser(data) {
  return suspendUserSchema.validate(data);
}

/**
 * Validate delete account request
 * @param {Object} data - Request body
 * @returns {Object} Validation result
 */
function validateDeleteAccount(data) {
  return deleteAccountSchema.validate(data);
}

/**
 * Validate preferences update request
 * @param {Object} data - Request body
 * @returns {Object} Validation result
 */
function validateUpdatePreferences(data) {
  return updatePreferencesSchema.validate(data);
}

/**
 * Validate avatar upload request
 * @param {Object} data - Request body with file
 * @returns {Object} Validation result
 */
function validateUploadAvatar(data) {
  return uploadAvatarSchema.validate(data);
}

/**
 * Validate add address request
 * @param {Object} data - Request body
 * @returns {Object} Validation result
 */
function validateAddAddress(data) {
  return addAddressSchema.validate(data);
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
 * Validate add saved card request
 * @param {Object} data - Request body
 * @returns {Object} Validation result
 */
function validateAddSavedCard(data) {
  return addSavedCardSchema.validate(data);
}

/**
 * Validate set primary card request
 * @param {Object} data - Request body
 * @returns {Object} Validation result
 */
function validateSetPrimaryCard(data) {
  return setPrimaryCardSchema.validate(data);
}

// ===== MODULE EXPORTS =====

module.exports = {
  // User profile schemas
  updateUserProfileSchema,
  changePasswordSchema,
  updateEmailSchema,
  emailVerificationSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  getUsersListSchema,
  updateUserSchema,
  suspendUserSchema,
  deleteAccountSchema,
  updatePreferencesSchema,
  uploadAvatarSchema,
  
  // Address schemas
  addAddressSchema,
  updateAddressSchema,
  
  // Saved card schemas
  addSavedCardSchema,
  setPrimaryCardSchema,

  // Validation functions
  validateUpdateUserProfile,
  validateChangePassword,
  validateUpdateEmail,
  validateEmailVerification,
  validateRequestPasswordReset,
  validateResetPassword,
  validateUsersListQuery,
  validateUpdateUser,
  validateSuspendUser,
  validateDeleteAccount,
  validateUpdatePreferences,
  validateUploadAvatar,
  validateAddAddress,
  validateUpdateAddress,
  validateAddSavedCard,
  validateSetPrimaryCard,
};