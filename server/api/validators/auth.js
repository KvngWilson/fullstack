/**
 * Authentication Validation Schemas - Phase 7
 * Joi validators for authentication operations (Identity domain)
 */

const Joi = require("joi");
const { emailSchema, passwordSchema, strongPasswordSchema } = require("./common");

// ===== REGISTRATION & LOGIN SCHEMAS =====

/**
 * Register schema
 * Validates user registration request
 */
const registerSchema = Joi.object({
  email: emailSchema,
  password: strongPasswordSchema,
  confirm_password: Joi.string().valid(Joi.ref("password")).required().messages({
    "any.only": "Passwords do not match",
    "any.required": "Confirm password is required",
  }),
  first_name: Joi.string().trim().max(100).required().messages({
    "any.required": "First name is required",
  }),
  last_name: Joi.string().trim().max(100).required().messages({
    "any.required": "Last name is required",
  }),
  accept_terms: Joi.boolean().valid(true).required().messages({
    "any.only": "You must accept the terms and conditions",
    "any.required": "Terms acceptance is required",
  }),
  subscribe_newsletter: Joi.boolean().optional().default(false),
}).unknown(false);

/**
 * Login schema
 * Validates user login request
 */
const loginSchema = Joi.object({
  email: emailSchema,
  password: passwordSchema,
  remember_me: Joi.boolean().optional().default(false),
}).unknown(false);

/**
 * Forgot password schema
 * Validates forgot password request
 */
const forgotPasswordSchema = Joi.object({
  email: emailSchema,
}).unknown(false);

/**
 * Reset password schema
 * Validates password reset request
 */
const resetPasswordSchema = Joi.object({
  token: Joi.string().trim().required().messages({
    "any.required": "Reset token is required",
  }),
  password: strongPasswordSchema,
  confirm_password: Joi.string().valid(Joi.ref("password")).required().messages({
    "any.only": "Passwords do not match",
    "any.required": "Confirm password is required",
  }),
}).unknown(false);

/**
 * Refresh token schema
 * Validates refresh token request
 */
const refreshTokenSchema = Joi.object({
  refresh_token: Joi.string().trim().required().messages({
    "any.required": "Refresh token is required",
  }),
}).unknown(false);

/**
 * Verify email schema
 * Validates email verification request
 */
const verifyEmailSchema = Joi.object({
  token: Joi.string().trim().required().messages({
    "any.required": "Verification token is required",
  }),
}).unknown(false);

/**
 * Resend verification email schema
 * Validates resend verification request
 */
const resendVerificationEmailSchema = Joi.object({
  email: emailSchema,
}).unknown(false);

/**
 * Enable two-factor auth schema
 * Validates 2FA setup request
 */
const enableTwoFactorSchema = Joi.object({
  method: Joi.string().valid("email", "sms", "totp").required().messages({
    "any.only": "method must be one of: email, sms, totp",
    "any.required": "method is required",
  }),
  phone: Joi.string().optional(), // Required if method is 'sms'
}).unknown(false);

/**
 * Verify two-factor schema
 * Validates 2FA code verification
 */
const verifyTwoFactorSchema = Joi.object({
  code: Joi.string()
    .trim()
    .length(6)
    .pattern(/^\d+$/)
    .required()
    .messages({
      "string.length": "Code must be 6 digits",
      "string.pattern.base": "Code must contain only numbers",
      "any.required": "Verification code is required",
    }),
}).unknown(false);

/**
 * Disable two-factor schema
 * Validates 2FA disable request
 */
const disableTwoFactorSchema = Joi.object({
  password: passwordSchema,
}).unknown(false);

/**
 * OAuth provider schema
 * Validates OAuth login request
 */
const oauthLoginSchema = Joi.object({
  provider: Joi.string()
    .valid("google", "github", "facebook", "microsoft")
    .required()
    .messages({
      "any.only":
        "provider must be one of: google, github, facebook, microsoft",
      "any.required": "provider is required",
    }),
  code: Joi.string().trim().required().messages({
    "any.required": "Authorization code is required",
  }),
  redirect_uri: Joi.string().uri().optional(),
}).unknown(false);

/**
 * Logout schema
 * Validates logout request
 */
const logoutSchema = Joi.object({
  all_devices: Joi.boolean().optional().default(false),
}).unknown(false);

/**
 * Session refresh schema
 * Validates session refresh
 */
const sessionRefreshSchema = Joi.object({
  session_id: Joi.string().trim().optional(),
}).unknown(false);

// ===== VALIDATION FUNCTIONS =====

/**
 * Validate register request
 * @param {Object} payload - Request body
 * @returns {Object} Validation result
 */
function validateRegister(payload) {
  return registerSchema.validate(payload, { abortEarly: true, stripUnknown: true });
}

/**
 * Validate login request
 * @param {Object} payload - Request body
 * @returns {Object} Validation result
 */
function validateLogin(payload) {
  return loginSchema.validate(payload, { abortEarly: true, stripUnknown: true });
}

/**
 * Validate forgot password request
 * @param {Object} payload - Request body
 * @returns {Object} Validation result
 */
function validateForgotPassword(payload) {
  return forgotPasswordSchema.validate(payload, { abortEarly: true, stripUnknown: true });
}

/**
 * Validate reset password request
 * @param {Object} payload - Request body
 * @returns {Object} Validation result
 */
function validateResetPassword(payload) {
  return resetPasswordSchema.validate(payload, { abortEarly: true, stripUnknown: true });
}

/**
 * Validate refresh token request
 * @param {Object} payload - Request body
 * @returns {Object} Validation result
 */
function validateRefreshToken(payload) {
  return refreshTokenSchema.validate(payload, { abortEarly: true, stripUnknown: true });
}

/**
 * Validate verify email request
 * @param {Object} payload - Request body
 * @returns {Object} Validation result
 */
function validateVerifyEmail(payload) {
  return verifyEmailSchema.validate(payload, { abortEarly: true, stripUnknown: true });
}

/**
 * Validate resend verification email request
 * @param {Object} payload - Request body
 * @returns {Object} Validation result
 */
function validateResendVerificationEmail(payload) {
  return resendVerificationEmailSchema.validate(payload, { abortEarly: true, stripUnknown: true });
}

/**
 * Validate enable 2FA request
 * @param {Object} payload - Request body
 * @returns {Object} Validation result
 */
function validateEnableTwoFactor(payload) {
  return enableTwoFactorSchema.validate(payload, { abortEarly: true, stripUnknown: true });
}

/**
 * Validate verify 2FA request
 * @param {Object} payload - Request body
 * @returns {Object} Validation result
 */
function validateVerifyTwoFactor(payload) {
  return verifyTwoFactorSchema.validate(payload, { abortEarly: true, stripUnknown: true });
}

/**
 * Validate disable 2FA request
 * @param {Object} payload - Request body
 * @returns {Object} Validation result
 */
function validateDisableTwoFactor(payload) {
  return disableTwoFactorSchema.validate(payload, { abortEarly: true, stripUnknown: true });
}

/**
 * Validate OAuth login request
 * @param {Object} payload - Request body
 * @returns {Object} Validation result
 */
function validateOAuthLogin(payload) {
  return oauthLoginSchema.validate(payload, { abortEarly: true, stripUnknown: true });
}

/**
 * Validate logout request
 * @param {Object} payload - Request body
 * @returns {Object} Validation result
 */
function validateLogout(payload) {
  return logoutSchema.validate(payload, { abortEarly: true, stripUnknown: true });
}

/**
 * Validate session refresh request
 * @param {Object} payload - Request body
 * @returns {Object} Validation result
 */
function validateSessionRefresh(payload) {
  return sessionRefreshSchema.validate(payload, { abortEarly: true, stripUnknown: true });
}

// ===== MODULE EXPORTS =====

module.exports = {
  // Schemas
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  verifyEmailSchema,
  resendVerificationEmailSchema,
  enableTwoFactorSchema,
  verifyTwoFactorSchema,
  disableTwoFactorSchema,
  oauthLoginSchema,
  logoutSchema,
  sessionRefreshSchema,

  // Validation functions
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateRefreshToken,
  validateVerifyEmail,
  validateResendVerificationEmail,
  validateEnableTwoFactor,
  validateVerifyTwoFactor,
  validateDisableTwoFactor,
  validateOAuthLogin,
  validateLogout,
  validateSessionRefresh,
};
