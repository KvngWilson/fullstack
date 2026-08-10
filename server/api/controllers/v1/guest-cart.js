/**
 * Guest Cart Controller
 * Handles guest shopping cart operations
 * Add to cart, view cart, update quantity, remove items
 */

const logger = require("../../../shared/utils/logger");
const { pool } = require("../../../config/db");
const GuestCartService = require("../../../domain/ordering/services/GuestCartService");

const guestCartService = new GuestCartService();

/**
 * GET /api/v1/guest/cart
 * Get guest cart items with full product details
 * Requires: guest token
 *
 * Returns: { items, total, itemCount, lastUpdated }
 */
exports.getGuestCart = async (req, res) => {
  try {
    const guestToken = req.guest?.token;

    if (!guestToken) {
      return res.status(400).json({
        error: "Missing guest token",
      });
    }

    const cartSnapshot =
      await guestCartService.getGuestCartSnapshot(guestToken);

    logger.info("Guest cart retrieved", {
      token: guestToken.substring(0, 8),
      itemCount: cartSnapshot.itemCount,
    });

    return res.json({
      items: cartSnapshot.items,
      total: cartSnapshot.total,
      itemCount: cartSnapshot.itemCount,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Failed to get guest cart", {
      error: error.message,
    });

    return res.status(500).json({
      error: "Failed to load cart",
    });
  }
};

/**
 * POST /api/v1/guest/cart/add
 * Add product to guest cart
 * Requires: guest token
 *
 * Body: {
 *   productVariantId,
 *   quantity,
 *   price,
 *   name,
 *   sku,
 *   weight (optional)
 * }
 *
 * Returns: { item, cartTotal, itemCount }
 */
exports.addToGuestCart = async (req, res) => {
  try {
    const guestToken = req.guest?.token;
    const { productVariantId, quantity, price, name, sku, weight } = req.body;

    if (!guestToken) {
      return res.status(400).json({
        error: "Missing guest token",
      });
    }

    // Validate input
    if (
      !productVariantId
      || quantity === undefined
      || quantity === null
      || price === undefined
      || price === null
      || !name
    ) {
      return res.status(400).json({
        error: "productVariantId, quantity, price, and name are required",
      });
    }

    if (quantity < 1 || quantity > 999) {
      return res.status(400).json({
        error: "Quantity must be between 1 and 999",
      });
    }

    if (price < 0) {
      return res.status(400).json({
        error: "Price cannot be negative",
      });
    }

    // Add to cart
    const itemData = {
      productVariantId,
      quantity: parseInt(quantity),
      price: parseFloat(price),
      name,
      sku,
      weight: weight ? parseFloat(weight) : null,
    };

    await guestCartService.addToGuestCart(guestToken, itemData);
    const cartSnapshot =
      await guestCartService.getGuestCartSnapshot(guestToken);

    // Find the added item in cart
    const addedItem = cartSnapshot.items.find(
      (item) => item.productVariantId === productVariantId,
    );

    logger.info("Item added to guest cart", {
      token: guestToken.substring(0, 8),
      productVariantId,
      quantity,
    });

    return res.status(201).json({
      success: true,
      item: addedItem,
      cartTotal: cartSnapshot.total,
      itemCount: cartSnapshot.itemCount,
      message: "Item added to cart",
    });
  } catch (error) {
    logger.error("Failed to add item to guest cart", {
      error: error.message,
    });

    return res.status(500).json({
      error: "Failed to add item to cart",
    });
  }
};

/**
 * PATCH /api/v1/guest/cart/:productVariantId
 * Update quantity of item in guest cart
 *
 * Body: { quantity }
 *
 * Returns: { item, cartTotal, itemCount }
 */
exports.updateGuestCartItem = async (req, res) => {
  try {
    const guestToken = req.guest?.token;
    const productVariantId = parseInt(req.params.productVariantId);
    const { quantity } = req.body;

    if (!guestToken) {
      return res.status(400).json({
        error: "Missing guest token",
      });
    }

    if (!quantity || quantity < 0 || quantity > 999) {
      return res.status(400).json({
        error: "Quantity must be between 0 and 999",
      });
    }

    if (quantity === 0) {
      // Delete item if quantity is 0
      await guestCartService.deleteGuestCartItem(guestToken, productVariantId);
    } else {
      // Update quantity
      await guestCartService.updateGuestCartItem(
        guestToken,
        productVariantId,
        parseInt(quantity),
      );
    }

    const cartSnapshot =
      await guestCartService.getGuestCartSnapshot(guestToken);
    const updatedItem = cartSnapshot.items.find(
      (item) => item.productVariantId === productVariantId,
    );

    logger.info("Guest cart item updated", {
      token: guestToken.substring(0, 8),
      productVariantId,
      quantity,
    });

    return res.json({
      success: true,
      item: updatedItem || null,
      cartTotal: cartSnapshot.total,
      itemCount: cartSnapshot.itemCount,
      message: quantity === 0 ? "Item removed from cart" : "Cart updated",
    });
  } catch (error) {
    logger.error("Failed to update guest cart item", {
      error: error.message,
    });

    return res.status(500).json({
      error: "Failed to update cart",
    });
  }
};

/**
 * DELETE /api/v1/guest/cart/:productVariantId
 * Remove item from guest cart
 */
exports.deleteGuestCartItem = async (req, res) => {
  try {
    const guestToken = req.guest?.token;
    const productVariantId = parseInt(req.params.productVariantId);

    if (!guestToken) {
      return res.status(400).json({
        error: "Missing guest token",
      });
    }

    await guestCartService.deleteGuestCartItem(guestToken, productVariantId);
    const cartSnapshot =
      await guestCartService.getGuestCartSnapshot(guestToken);

    logger.info("Item removed from guest cart", {
      token: guestToken.substring(0, 8),
      productVariantId,
    });

    return res.json({
      success: true,
      cartTotal: cartSnapshot.total,
      itemCount: cartSnapshot.itemCount,
      message: "Item removed from cart",
    });
  } catch (error) {
    logger.error("Failed to delete guest cart item", {
      error: error.message,
    });

    return res.status(500).json({
      error: "Failed to remove item from cart",
    });
  }
};

/**
 * DELETE /api/v1/guest/cart
 * Clear entire guest cart
 */
exports.clearGuestCart = async (req, res) => {
  try {
    const guestToken = req.guest?.token;

    if (!guestToken) {
      return res.status(400).json({
        error: "Missing guest token",
      });
    }

    await guestCartService.clearGuestCart(guestToken);

    logger.info("Guest cart cleared", {
      token: guestToken.substring(0, 8),
    });

    return res.json({
      success: true,
      itemCount: 0,
      cartTotal: 0,
      message: "Cart cleared",
    });
  } catch (error) {
    logger.error("Failed to clear guest cart", {
      error: error.message,
    });

    return res.status(500).json({
      error: "Failed to clear cart",
    });
  }
};

/**
 * POST /api/v1/guest/cart/validate
 * Validate guest cart (check for out-of-stock, price changes, etc)
 * Could be expanded to sync with current product prices/availability
 */
exports.validateGuestCart = async (req, res) => {
  try {
    const guestToken = req.guest?.token;

    if (!guestToken) {
      return res.status(400).json({
        error: "Missing guest token",
      });
    }

    const validation = await guestCartService.validateGuestCart(guestToken);

    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error,
        details: validation.details,
      });
    }

    return res.json({
      valid: true,
      message: "Cart is valid",
    });
  } catch (error) {
    logger.error("Failed to validate guest cart", {
      error: error.message,
    });

    return res.status(500).json({
      error: "Failed to validate cart",
    });
  }
};
