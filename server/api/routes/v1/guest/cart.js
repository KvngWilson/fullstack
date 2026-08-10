/**
 * Guest Cart Routes
 * Shopping cart operations for non-authenticated (guest) users
 * Add items, update quantities, remove items
 */

const express = require("express");
const router = express.Router();

const guestCart = require("../../../controllers/v1/guest-cart");
const { guestOnly } = require("../../../decorators/guest");

/**
 * GET /api/v1/guest/cart
 * Get guest cart with all items
 * Requires: guest token
 */
router.get("/", guestOnly(), guestCart.getGuestCart);

/**
 * POST /api/v1/guest/cart/add
 * Add product to guest cart
 * Payload: { productVariantId, quantity, price, name, sku, weight? }
 * Requires: guest token
 */
router.post("/add", guestOnly(), guestCart.addToGuestCart);

/**
 * PATCH /api/v1/guest/cart/:productVariantId
 * Update item quantity in cart
 * Payload: { quantity }
 * Requires: guest token
 */
router.patch("/:productVariantId", guestOnly(), guestCart.updateGuestCartItem);

/**
 * DELETE /api/v1/guest/cart/:productVariantId
 * Remove item from cart
 * Requires: guest token
 */
router.delete("/:productVariantId", guestOnly(), guestCart.deleteGuestCartItem);

/**
 * DELETE /api/v1/guest/cart
 * Clear entire cart
 * Requires: guest token
 */
router.delete("/", guestOnly(), guestCart.clearGuestCart);

/**
 * POST /api/v1/guest/cart/validate
 * Validate cart (check availability, prices, etc)
 * Requires: guest token
 */
router.post("/validate", guestOnly(), guestCart.validateGuestCart);

module.exports = router;
