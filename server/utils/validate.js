const Joi = require("joi");
const { z } = require("zod");

// Email validation
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Password validation (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
function validatePassword(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);

  return (
    password.length >= minLength && hasUpperCase && hasLowerCase && hasNumber
  );
}

// Joi Schemas
const registrationSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  first_name: Joi.string().min(1).max(50).required(),
  last_name: Joi.string().min(1).max(50).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const addressSchema = Joi.object({
  street: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().length(2).required(),
  zip_code: Joi.string()
    .pattern(/^\d{5}(-\d{4})?$/)
    .required(),
  country: Joi.string().default("US"),
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

// Zod schemas for products (more type-safe)
const productSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  base_price: z.number().positive(),
  category_id: z.number().int().positive().optional(),
  is_active: z.boolean().default(true),
});

const variantSchema = z.object({
  product_id: z.number().int().positive(),
  sku: z.string().min(1).max(100),
  size: z.string().optional(),
  color: z.string().optional(),
  price_adjustment: z.number().default(0),
});

function validateProduct(data) {
  try {
    return { success: true, data: productSchema.parse(data) };
  } catch (error) {
    return { success: false, error: error.errors };
  }
}

function validateVariant(data) {
  try {
    return { success: true, data: variantSchema.parse(data) };
  } catch (error) {
    return { success: false, error: error.errors };
  }
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
