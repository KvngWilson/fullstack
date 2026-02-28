const Joi = require("joi");

// Email validation
function validateEmail(email) {
  if (!email || typeof email !== "string") return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Password validation contract:
// { valid: boolean, error?: string }
function validatePassword(password) {
  if (typeof password !== "string" || password.length === 0) {
    return { valid: false, error: "Password is required" };
  }

  if (password.length < 6) {
    return {
      valid: false,
      error: "Password must be at least 6 characters",
    };
  }

  if (password.length > 100) {
    return {
      valid: false,
      error: "Password must be maximum 100 characters",
    };
  }

  return { valid: true };
}

// Joi Schemas
const registrationSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  first_name: Joi.string().min(1).max(50).optional(),
  last_name: Joi.string().min(1).max(50).optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const addressSchema = Joi.object({
  street: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().allow("", null).optional(),
  postal_code: Joi.string().required(),
  country: Joi.string().required(),
  is_default: Joi.boolean().default(false),
});

// Validation wrapper
function validateRegistration(data) {
  return registrationSchema.validate(data);
}

function validateLogin(data) {
  return loginSchema.validate(data);
}

function validateAddress(data) {
  return addressSchema.validate(data);
}

// Joi schemas for products and variants
const productSchema = Joi.object({
  name: Joi.string().min(1).max(200).required(),
  brand: Joi.string().min(1).max(200).required(),
  description: Joi.string().allow("", null).optional(),
  base_price: Joi.number().positive().required(),
  category_id: Joi.number().integer().positive().optional(),
  is_active: Joi.boolean().optional(),
  material: Joi.string().optional(),
  care_instructions: Joi.string().optional(),
}).unknown(true);

const variantSchema = Joi.object({
  product_id: Joi.number().integer().positive().required(),
  sku: Joi.string().min(1).max(100).required(),
  size: Joi.string().optional(),
  color: Joi.string().optional(),
  price_adjustment: Joi.number().default(0),
});

function validateProduct(data) {
  return productSchema.validate(data);
}

function validateVariant(data) {
  return variantSchema.validate(data);
}

// SINGLE module.exports with ALL exports
module.exports = {
  // Functions
  validateEmail,
  validatePassword,
  validateRegistration,
  validateLogin,
  validateAddress,
  validateProduct,
  validateVariant,

  // Schemas
  registrationSchema,
  loginSchema,
  addressSchema,
  productSchema,
  variantSchema,
};
