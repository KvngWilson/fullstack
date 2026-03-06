/**
 * Wishlist Validation Schemas
 * Joi validators for wishlist operations
 */

const Joi = require("joi");

/**
 * Add to wishlist schema
 * Validates product addition to wishlist
 */
const addToWishlistSchema = Joi.object({
  product_id: Joi.number().integer().positive().required().messages({
    "number.positive": "product_id must be a positive number",
    "any.required": "product_id is required",
  }),
}).unknown(false);

/**
 * Validate add to wishlist request
 * @param {Object} data - Request body
 * @returns {Object} Validation result
 */
function validateAddToWishlist(data) {
  return addToWishlistSchema.validate(data);
}

module.exports = {
  addToWishlistSchema,
  validateAddToWishlist,
};
