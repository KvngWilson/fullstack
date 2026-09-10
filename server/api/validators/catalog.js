const Joi = require("joi");

/**
 * Product validation schemas
 */
const createProductSchema = Joi.object({
  name: Joi.string().min(1).max(200).required(),
  slug: Joi.string().min(1).max(200).optional(),
  description: Joi.string().allow("", null).optional(),
  base_price: Joi.number().positive().required(),
  category_id: Joi.number().integer().positive().allow(null).optional(),
  vendor_id: Joi.number().integer().positive().allow(null).optional(),
  image_url: Joi.string().uri().allow("", null).optional(),
  is_active: Joi.boolean().optional().default(true),
  brand: Joi.string().max(200).optional(),
  material: Joi.string().optional(),
  care_instructions: Joi.string().optional(),
  sku: Joi.string().max(120).optional(),
  stock: Joi.number().integer().min(0).optional().default(0),
}).unknown(false);

const updateProductSchema = Joi.object({
  name: Joi.string().min(1).max(200).optional(),
  slug: Joi.string().min(1).max(200).optional(),
  description: Joi.string().allow("", null).optional(),
  base_price: Joi.number().positive().optional(),
  category_id: Joi.number().integer().positive().allow(null).optional(),
  vendor_id: Joi.number().integer().positive().allow(null).optional(),
  image_url: Joi.string().uri().allow("", null).optional(),
  is_active: Joi.boolean().optional(),
  brand: Joi.string().max(200).optional(),
  material: Joi.string().optional(),
  care_instructions: Joi.string().optional(),
  sku: Joi.string().max(120).optional(),
  stock: Joi.number().integer().min(0).optional(),
})
  .unknown(false)
  .min(1);

/**
 * Category validation schemas
 */
const createCategorySchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().allow("", null).optional(),
}).unknown(false);

const updateCategorySchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  description: Joi.string().allow("", null).optional(),
})
  .unknown(false)
  .min(1);

/**
 * Inventory validation schemas
 */
const updateInventorySchema = Joi.object({
  stock: Joi.number().integer().min(0).required(),
}).unknown(false);

/**
 * Validation functions
 */
function validateCreateProduct(data) {
  return createProductSchema.validate(data);
}

function validateUpdateProduct(data) {
  return updateProductSchema.validate(data);
}

function validateCreateCategory(data) {
  return createCategorySchema.validate(data);
}

function validateUpdateCategory(data) {
  return updateCategorySchema.validate(data);
}

function validateUpdateInventory(data) {
  return updateInventorySchema.validate(data);
}

module.exports = {
  // Schemas
  createProductSchema,
  updateProductSchema,
  createCategorySchema,
  updateCategorySchema,
  updateInventorySchema,

  // Validation functions
  validateCreateProduct,
  validateUpdateProduct,
  validateCreateCategory,
  validateUpdateCategory,
  validateUpdateInventory,
};
