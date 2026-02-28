const { orderRepository } = require("../data/repositories");
const {
  InvalidOrderError,
  InsufficientStockError,
} = require("../utils/errors");
const logger = require("../utils/logger");

class OrderService {
  /**
   * Create order from cart
   */
  async createOrder(userId, shippingAddressId, billingAddressId) {
    // 1. Get cart items
    const cart = await this._getCartWithItems(userId);

    if (!cart || cart.items.length === 0) {
      throw new InvalidOrderError("Cart is empty");
    }

    // 2. Validate addresses belong to user
    await this._validateAddresses(userId, shippingAddressId, billingAddressId);

    // 3. Create order (repository handles validation, calculation, and stock reservation)
    try {
      const order = await orderRepository.createWithItems(
        userId,
        shippingAddressId,
        billingAddressId,
        cart.items,
      );

      // 4. Send order confirmation email (async, don't wait)
      this._sendOrderConfirmationEmail(order).catch((err) => {
        logger.error("Failed to send order confirmation", {
          error: err,
          orderId: order.id,
        });
      });

      return order;
    } catch (error) {
      if (error.message.includes("Insufficient stock")) {
        throw new InsufficientStockError(error.message);
      }
      throw error;
    }
  }

  /**
   * Get cart with items
   * @private
   */
  async _getCartWithItems(userId) {
    const { pool } = require("../config/db");

    const cartResult = await pool.query(
      "SELECT id FROM carts WHERE user_id = $1",
      [userId],
    );

    if (cartResult.rows.length === 0) {
      return null;
    }

    const cartId = cartResult.rows[0].id;

    const itemsResult = await pool.query(
      `SELECT
        ci.id as cart_item_id,
        ci.product_variant_id,
        ci.quantity
      FROM cart_items ci
      WHERE ci.cart_id = $1`,
      [cartId],
    );

    return {
      id: cartId,
      items: itemsResult.rows,
    };
  }

  /**
   * Validate addresses belong to user
   * @private
   */
  async _validateAddresses(userId, shippingAddressId, billingAddressId) {
    const { pool } = require("../config/db");

    const result = await pool.query(
      "SELECT id FROM addresses WHERE id = ANY($1) AND user_id = $2",
      [[shippingAddressId, billingAddressId], userId],
    );

    if (result.rows.length !== 2) {
      throw new InvalidOrderError(
        "Invalid address: Address does not belong to user",
      );
    }
  }

  /**
   * Send order confirmation email
   * @private
   */
  async _sendOrderConfirmationEmail(order) {
    const { sendOrderConfirmationEmail } = require(
      "../infrastructure/email/email"
    );
    await sendOrderConfirmationEmail(order);
  }

  /**
   * Get order by ID with authorization check
   */
  async getOrder(orderId, userId, isAdmin) {
    const order = await orderRepository.findByIdWithItems(orderId);

    if (!order) {
      return null;
    }

    // Authorization check
    if (!isAdmin && order.user_id !== userId) {
      throw new Error("Unauthorized: Cannot access this order");
    }

    return order;
  }

  /**
   * Get user orders
   */
  async getUserOrders(userId, options) {
    return await orderRepository.findByUserId(userId, options);
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId, newStatus, userId, isAdmin) {
    // Only admins can update order status
    if (!isAdmin) {
      throw new Error("Unauthorized: Only admins can update order status");
    }

    const order = await orderRepository.updateStatus(orderId, newStatus);

    if (!order) {
      return null;
    }

    // Send email notifications based on status
    if (newStatus === "shipped") {
      this._sendShippingNotification(order).catch((err) =>
        logger.error("Failed to send shipping notification", {
          error: err,
          orderId: order.id,
        }),
      );
    } else if (newStatus === "delivered") {
      this._sendDeliveryNotification(order).catch((err) =>
        logger.error("Failed to send delivery notification", {
          error: err,
          orderId: order.id,
        }),
      );
    }

    return order;
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId, userId, isAdmin) {
    const order = await orderRepository.findById(orderId);

    if (!order) {
      return null;
    }

    // Authorization check
    if (!isAdmin && order.user_id !== userId) {
      throw new Error("Unauthorized: Cannot cancel this order");
    }

    // Can only cancel pending/processing orders
    if (!["pending", "paid"].includes(order.status)) {
      throw new InvalidOrderError(
        `Cannot cancel order with status: ${order.status}`,
      );
    }

    // Update status
    const updatedOrder = await orderRepository.updateStatus(
      orderId,
      "cancelled",
    );

    // Restore inventory
    await this._restoreInventory(orderId);

    return updatedOrder;
  }

  /**
   * Restore inventory when order is cancelled
   * @private
   */
  async _restoreInventory(orderId) {
    const { pool } = require("../config/db");

    const itemsResult = await pool.query(
      "SELECT product_variant_id, quantity FROM order_items WHERE order_id = $1",
      [orderId],
    );

    for (const item of itemsResult.rows) {
      await pool.query(
        "UPDATE product_variants SET stock = stock + $1 WHERE id = $2",
        [item.quantity, item.product_variant_id],
      );
    }
  }

  async _sendShippingNotification(order) {
    // Implementation
  }

  async _sendDeliveryNotification(order) {
    // Implementation
  }
}

module.exports = new OrderService();
