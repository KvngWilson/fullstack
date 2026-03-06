const crypto = require("crypto");
const { redisClient } = require("../../../config/redis");
const { pool } = require("../../../config/db");
const logger = require("../../../shared/utils/logger");

/**
 * Guest Cart Service
 * Manages shopping carts for non-authenticated users
 * Uses Redis for temporary storage with automatic expiry (24h)
 */
class GuestCartService {
  constructor() {
    this.EXPIRY_SECONDS = 24 * 60 * 60; // 24 hours
    this.GUEST_CART_PREFIX = "guest_cart:";
    this.GUEST_SESSION_PREFIX = "guest_session:";
  }

  /**
   * Generate guest session token
   * Used to identify guest across requests
   *
   * @returns {string} Guest session token (32 bytes, hex encoded)
   */
  generateGuestToken() {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Create new guest cart with session token
   *
   * @param {string} guestToken - Optional existing token (for resuming session)
   * @returns {Promise<{token: string, cartId: string}>}
   */
  async createGuestCart(guestToken = null) {
    try {
      const token = guestToken || this.generateGuestToken();
      const cartId = `${this.GUEST_CART_PREFIX}${token}`;

      // Initialize empty cart
      const now = new Date().toISOString();
      const cartData = {
        token,
        items: [],
        createdAt: now,
        updatedAt: now,
      };

      // Create companion guest session so guestOnly/guestOrAuth middleware validates token
      const sessionId = `${this.GUEST_SESSION_PREFIX}${token}`;
      const sessionData = {
        token,
        createdAt: now,
      };

      // Store in Redis with expiry
      await redisClient.setEx(
        cartId,
        this.EXPIRY_SECONDS,
        JSON.stringify(cartData),
      );

      await redisClient.setEx(
        sessionId,
        this.EXPIRY_SECONDS,
        JSON.stringify(sessionData),
      );

      logger.info("Guest cart created", { token: token.substring(0, 8) });
      return { token, cartId };
    } catch (error) {
      logger.error("Failed to create guest cart", { error: error.message });
      throw error;
    }
  }

  /**
   * Get guest cart items
   *
   * @param {string} guestToken - Guest session token
   * @returns {Promise<{items: Array, total: number, itemCount: number}>}
   */
  async getGuestCartSnapshot(guestToken) {
    try {
      const cartId = `${this.GUEST_CART_PREFIX}${guestToken}`;
      const cartData = await redisClient.get(cartId);

      if (!cartData) {
        logger.warn("Guest cart not found or expired", {
          token: guestToken.substring(0, 8),
        });
        return { items: [], total: 0, itemCount: 0 };
      }

      const cart = JSON.parse(cartData);
      const itemCount = cart.items.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );
      const total = cart.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );

      return {
        items: cart.items,
        total: parseFloat(total.toFixed(2)),
        itemCount,
      };
    } catch (error) {
      logger.error("Failed to get guest cart", { error: error.message });
      throw error;
    }
  }

  /**
   * Add item to guest cart
   *
   * @param {string} guestToken - Guest session token
   * @param {object} itemData - {productVariantId, productId, name, price, quantity, sku, ...}
   * @returns {Promise<{items: Array, total: number}>}
   */
  async addToGuestCart(guestToken, itemData) {
    try {
      const cartId = `${this.GUEST_CART_PREFIX}${guestToken}`;
      const cartData = await redisClient.get(cartId);

      if (!cartData) {
        throw new Error(
          "Guest cart not found or expired. Please create a new session.",
        );
      }

      const cart = JSON.parse(cartData);

      // Check if item already exists
      const existingItem = cart.items.find(
        (item) => item.productVariantId === itemData.productVariantId,
      );

      if (existingItem) {
        // Update quantity
        existingItem.quantity += itemData.quantity;
      } else {
        // Add new item
        cart.items.push({
          productVariantId: itemData.productVariantId,
          productId: itemData.productId,
          name: itemData.name,
          price: itemData.price,
          quantity: itemData.quantity,
          sku: itemData.sku,
          description: itemData.description,
          attributes: itemData.attributes,
        });
      }

      cart.updatedAt = new Date().toISOString();

      // Refresh expiry
      await redisClient.setEx(
        cartId,
        this.EXPIRY_SECONDS,
        JSON.stringify(cart),
      );

      logger.info("Item added to guest cart", {
        token: guestToken.substring(0, 8),
        itemCount: cart.items.length,
      });

      const total = cart.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );

      return {
        items: cart.items,
        total: parseFloat(total.toFixed(2)),
      };
    } catch (error) {
      logger.error("Failed to add item to guest cart", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update guest cart item quantity
   *
   * @param {string} guestToken - Guest session token
   * @param {string} productVariantId - Product variant ID
   * @param {number} quantity - New quantity
   * @returns {Promise<{items: Array, total: number}>}
   */
  async updateGuestCartItem(guestToken, productVariantId, quantity) {
    try {
      const cartId = `${this.GUEST_CART_PREFIX}${guestToken}`;
      const cartData = await redisClient.get(cartId);

      if (!cartData) {
        throw new Error("Guest cart not found or expired");
      }

      const cart = JSON.parse(cartData);

      if (quantity <= 0) {
        // Remove item if quantity is 0 or negative
        cart.items = cart.items.filter(
          (item) => item.productVariantId !== productVariantId,
        );
      } else {
        // Update quantity
        const item = cart.items.find(
          (item) => item.productVariantId === productVariantId,
        );
        if (item) {
          item.quantity = quantity;
        }
      }

      cart.updatedAt = new Date().toISOString();

      // Refresh expiry
      await redisClient.setEx(
        cartId,
        this.EXPIRY_SECONDS,
        JSON.stringify(cart),
      );

      const total = cart.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );

      return {
        items: cart.items,
        total: parseFloat(total.toFixed(2)),
      };
    } catch (error) {
      logger.error("Failed to update guest cart item", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete item from guest cart
   *
   * @param {string} guestToken - Guest session token
   * @param {string} productVariantId - Product variant ID
   * @returns {Promise<{items: Array, total: number}>}
   */
  async deleteGuestCartItem(guestToken, productVariantId) {
    try {
      const cartId = `${this.GUEST_CART_PREFIX}${guestToken}`;
      const cartData = await redisClient.get(cartId);

      if (!cartData) {
        throw new Error("Guest cart not found or expired");
      }

      const cart = JSON.parse(cartData);
      cart.items = cart.items.filter(
        (item) => item.productVariantId !== productVariantId,
      );
      cart.updatedAt = new Date().toISOString();

      // Refresh expiry
      await redisClient.setEx(
        cartId,
        this.EXPIRY_SECONDS,
        JSON.stringify(cart),
      );

      const total = cart.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );

      return {
        items: cart.items,
        total: parseFloat(total.toFixed(2)),
      };
    } catch (error) {
      logger.error("Failed to delete guest cart item", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Clear entire guest cart
   *
   * @param {string} guestToken - Guest session token
   * @returns {Promise<void>}
   */
  async clearGuestCart(guestToken) {
    try {
      const cartId = `${this.GUEST_CART_PREFIX}${guestToken}`;
      await redisClient.del(cartId);
      logger.info("Guest cart cleared", { token: guestToken.substring(0, 8) });
    } catch (error) {
      logger.error("Failed to clear guest cart", { error: error.message });
      throw error;
    }
  }

  /**
   * Save guest session (email + basic info)
   * For tracking and order confirmation
   *
   * @param {string} guestToken - Guest session token
   * @param {object} sessionData - {email, firstName, lastName, phone, ...}
   * @returns {Promise<void>}
   */
  async saveGuestSession(guestToken, sessionData) {
    try {
      const sessionId = `${this.GUEST_SESSION_PREFIX}${guestToken}`;
      const session = {
        token: guestToken,
        email: sessionData.email,
        firstName: sessionData.firstName,
        lastName: sessionData.lastName,
        phone: sessionData.phone,
        createdAt: new Date().toISOString(),
      };

      await redisClient.setEx(
        sessionId,
        this.EXPIRY_SECONDS,
        JSON.stringify(session),
      );

      logger.info("Guest session saved", {
        token: guestToken.substring(0, 8),
        email: sessionData.email,
      });
    } catch (error) {
      logger.error("Failed to save guest session", { error: error.message });
      throw error;
    }
  }

  /**
   * Get guest session data
   *
   * @param {string} guestToken - Guest session token
   * @returns {Promise<object|null>}
   */
  async getGuestSession(guestToken) {
    try {
      const sessionId = `${this.GUEST_SESSION_PREFIX}${guestToken}`;
      const sessionData = await redisClient.get(sessionId);

      if (!sessionData) {
        return null;
      }

      return JSON.parse(sessionData);
    } catch (error) {
      logger.error("Failed to get guest session", { error: error.message });
      return null;
    }
  }

  /**
   * Get guest cart items from Redis for order creation
   * Extract product info for order
   *
   * @param {string} guestToken - Guest session token
   * @returns {Promise<Array>} Cart items array
   */
  async getGuestCartItemsForOrder(guestToken) {
    try {
      const snapshot = await this.getGuestCartSnapshot(guestToken);
      return snapshot.items;
    } catch (error) {
      logger.error("Failed to get guest cart items for order", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Validate guest cart before checkout
   * Check for empty cart, valid items, etc.
   *
   * @param {string} guestToken - Guest session token
   * @returns {Promise<{valid: boolean, error?: string}>}
   */
  async validateGuestCart(guestToken) {
    try {
      if (!guestToken || typeof guestToken !== "string" || guestToken.trim().length < 16) {
        return {
          valid: false,
          error: "Invalid guest session",
        };
      }

      const snapshot = await this.getGuestCartSnapshot(guestToken);

      if (snapshot.items.length === 0) {
        return {
          valid: false,
          error: "Cart is empty",
        };
      }

      const details = [];
      const seenVariantIds = new Set();
      const normalizedItems = [];

      for (const item of snapshot.items) {
        const variantId = Number.parseInt(item.productVariantId, 10);
        const quantity = Number.parseInt(item.quantity, 10);
        const price = Number(item.price);

        if (!Number.isInteger(variantId) || variantId <= 0) {
          details.push({
            type: "invalid_item",
            message: "Cart contains item with invalid variant id",
            item,
          });
          continue;
        }

        if (seenVariantIds.has(variantId)) {
          details.push({
            type: "duplicate_item",
            variantId,
            message: "Cart contains duplicate variant entries",
          });
        }
        seenVariantIds.add(variantId);

        if (!Number.isInteger(quantity) || quantity <= 0) {
          details.push({
            type: "invalid_quantity",
            variantId,
            quantity: item.quantity,
            message: "Item quantity must be a positive integer",
          });
        }

        if (!Number.isFinite(price) || price < 0) {
          details.push({
            type: "invalid_price",
            variantId,
            price: item.price,
            message: "Item price is invalid",
          });
        }

        normalizedItems.push({
          ...item,
          productVariantId: variantId,
          quantity,
          price,
        });
      }

      if (details.length > 0) {
        return {
          valid: false,
          error: "Cart contains invalid items",
          details,
        };
      }

      const variantIds = normalizedItems.map((item) => item.productVariantId);
      const variantsResult = await pool.query(
        `SELECT
          pv.id,
          pv.product_id,
          pv.price_minor_units,
          pv.stock,
          pv.sku,
          p.name
         FROM product_variants pv
         JOIN products p ON p.id = pv.product_id
         WHERE pv.id = ANY($1::int[])
           AND pv.deleted_at IS NULL`,
        [variantIds],
      );

      const variantsById = new Map(
        variantsResult.rows.map((row) => [Number(row.id), row]),
      );

      for (const item of normalizedItems) {
        const current = variantsById.get(item.productVariantId);

        if (!current) {
          details.push({
            type: "variant_missing",
            variantId: item.productVariantId,
            message: "One or more items are no longer available",
          });
          continue;
        }

        if (
          Number.isInteger(item.productId)
          && Number(item.productId) > 0
          && Number(current.product_id) !== Number(item.productId)
        ) {
          details.push({
            type: "product_mismatch",
            variantId: item.productVariantId,
            message: "Cart item product mapping is invalid",
          });
        }

        if (Number(current.stock) < item.quantity) {
          details.push({
            type: "insufficient_stock",
            variantId: item.productVariantId,
            requested: item.quantity,
            available: Number(current.stock),
            message: `Insufficient stock for ${current.name || "item"}`,
          });
        }

        const cartPriceMinor = Math.round(Number(item.price) * 100);
        const hasMinorUnits = Number.isFinite(Number(current.price_minor_units));
        const currentPriceMinor = hasMinorUnits
          ? Number(current.price_minor_units)
          : Math.round(Number(current.price || 0) * 100);
        if (cartPriceMinor !== currentPriceMinor) {
          details.push({
            type: "price_changed",
            variantId: item.productVariantId,
            previousPrice: Number(item.price),
            currentPrice: Number((currentPriceMinor / 100).toFixed(2)),
            message: `Price changed for ${current.name || "item"}`,
          });
        }
      }

      if (details.length > 0) {
        return {
          valid: false,
          error: "Cart validation failed",
          details,
        };
      }

      return { valid: true };
    } catch (error) {
      logger.error("Guest cart validation failed", { error: error.message });
      return {
        valid: false,
        error: "Cart validation failed",
      };
    }
  }
}

module.exports = GuestCartService;
