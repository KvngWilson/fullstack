const { pool } = require("../../../config/db");
const { orderRepository } = require("../repositories");
const {
  InvalidOrderError,
  InsufficientStockError,
  AuthorizationError,
} = require("../../../shared/utils/errors");
const logger = require("../../../shared/utils/logger");

/**
 * Order Service.
 * Coordinates checkout, stock reservation, and order creation transactions.
 */
class OrderService {
  constructor(emailQueue = null) {
    this.emailQueue = emailQueue;
  }

  async createOrder(userId, shippingAddressId, billingAddressId) {
    const cart = await orderRepository.getCartByUserId(userId);

    if (!cart || cart.items.length === 0) {
      throw new InvalidOrderError("Cart is empty");
    }

    const hasValidAddresses = await orderRepository.addressesBelongToUser(
      userId,
      shippingAddressId,
      billingAddressId,
    );
    if (!hasValidAddresses) {
      throw new InvalidOrderError("Invalid address: Address does not belong to user");
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const pricedItems = await this._priceCartItems(client, cart.items);

      const subtotal = this._calculateSubtotal(pricedItems);
      const tax = this._calculateTax(subtotal, { userId });
      const discount = this._calculateDiscount(subtotal, { userId, itemCount: pricedItems.length });
      const shippingCost = this._calculateShippingCost(pricedItems, {
        shippingAddressId,
        billingAddressId,
      });

      const total = this._calculateTotal({ subtotal, tax, discount, shippingCost });

      const order = await orderRepository.createOrderRecord(client, {
        userId,
        status: "pending",
        total,
      });

      for (const item of pricedItems) {
        const reserved = await orderRepository.reserveVariantStock(client, {
          variantId: item.product_variant_id,
          quantity: item.quantity,
        });

        if (!reserved) {
          throw new InsufficientStockError(
            `Insufficient stock for variant ${item.product_variant_id}`,
          );
        }

        await orderRepository.addOrderItem(client, {
          orderId: order.id,
          productVariantId: item.product_variant_id,
          quantity: item.quantity,
          unitPrice: item.unit_price,
        });
      }

      if (shippingAddressId) {
        await orderRepository.snapshotOrderAddress(
          client,
          order.id,
          shippingAddressId,
          "shipping",
        );
      }

      if (billingAddressId) {
        await orderRepository.snapshotOrderAddress(
          client,
          order.id,
          billingAddressId,
          "billing",
        );
      }

      await orderRepository.clearUserCart(client, userId);
      await client.query("COMMIT");

      const fullOrder = await orderRepository.findByIdWithItems(order.id);

      this._publishOrderCreatedEvent({
        orderId: order.id,
        userId,
        total,
        subtotal,
        tax,
        discount,
        shippingCost,
      }).catch((err) => {
        logger.error("Order event publish failed", {
          error: err,
          orderId: order.id,
        });
      });

      this._queueOrderConfirmationEmail(fullOrder, this.emailQueue).catch((err) => {
        logger.error("Failed to queue order confirmation email", {
          error: err,
          orderId: fullOrder.id,
        });
      });

      return fullOrder;
    } catch (error) {
      await client.query("ROLLBACK");

      if (error.message && error.message.includes("Insufficient stock")) {
        throw new InsufficientStockError(error.message);
      }

      throw error;
    } finally {
      client.release();
    }
  }

  async _priceCartItems(client, cartItems) {
    const pricedItems = [];

    for (const item of cartItems) {
      const variant = await orderRepository.getVariantById(
        client,
        item.product_variant_id,
      );

      if (!variant) {
        throw new InvalidOrderError(
          `Variant ${item.product_variant_id} not found`,
        );
      }

      pricedItems.push({
        ...item,
        unit_price: Number.parseFloat(variant.price),
      });
    }

    return pricedItems;
  }

  _calculateSubtotal(pricedItems) {
    const subtotal = pricedItems.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0,
    );
    return Number.parseFloat(subtotal.toFixed(2));
  }

  _calculateTax(subtotal, _context = {}) {
    const taxRate = 0;
    return Number.parseFloat((subtotal * taxRate).toFixed(2));
  }

  _calculateDiscount(subtotal, _context = {}) {
    const discountRate = 0;
    return Number.parseFloat((subtotal * discountRate).toFixed(2));
  }

  _calculateShippingCost(_pricedItems, _context = {}) {
    return 0;
  }

  _calculateTotal({ subtotal, tax, discount, shippingCost }) {
    const total = subtotal + tax + shippingCost - discount;
    return Number.parseFloat(total.toFixed(2));
  }

  async _publishOrderCreatedEvent(eventPayload) {
    logger.info("Order created event", {
      type: "order.created",
      ...eventPayload,
    });
  }

  async _queueOrderConfirmationEmail(order, emailQueue) {
    if (!emailQueue) {
      logger.warn("Email queue not initialized, skipping order confirmation email");
      return;
    }

    try {
      const { user_id, id: orderId, total, items = [] } = order;
      const user = await orderRepository.getUserById(user_id);

      if (!user || !user.email) {
        logger.warn("Cannot send order confirmation: user email not found", {
          orderId,
          userId: user_id,
        });
        return;
      }

      const formattedItems = items.map((item) => ({
        name: item.product_name || "Unknown Product",
        quantity: item.quantity,
        price: item.unit_price,
        subtotal: (item.unit_price * item.quantity).toFixed(2),
      }));

      await require("../../../infrastructure/jobs/initializeEmailQueue").queueEmail(
        emailQueue,
        user.email,
        "orderConfirmation",
        {
          orderId,
          items: formattedItems,
          total: total.toFixed(2),
          orderUrl: `${process.env.APP_URL || "http://localhost:3000"}/orders/${orderId}`,
        },
        {
          attempts: 3,
          backoffDelay: 2000,
        }
      );

      logger.info("Order confirmation email queued", {
        orderId,
        email: user.email,
      });
    } catch (error) {
      logger.error("Failed to queue order confirmation email", {
        orderId: order.id,
        error: error.message,
      });
    }
  }

  async getOrder(orderId, userId, isAdmin) {
    const order = await orderRepository.findByIdWithItems(orderId);

    if (!order) {
      return null;
    }

    if (!isAdmin && order.user_id !== userId) {
      throw new AuthorizationError("Unauthorized: Cannot access this order");
    }

    return order;
  }

  async getUserOrders(userId, options) {
    return await orderRepository.findByUserId(userId, options);
  }

  async updateOrderStatus(orderId, newStatus, userId, isAdmin) {
    if (!isAdmin) {
      throw new AuthorizationError("Unauthorized: Only admins can update order status");
    }

    const order = await orderRepository.updateStatus(orderId, newStatus);

    if (!order) {
      return null;
    }

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

  async cancelOrder(orderId, userId, isAdmin) {
    const order = await orderRepository.findById(orderId);

    if (!order) {
      return null;
    }

    if (!isAdmin && order.user_id !== userId) {
      throw new AuthorizationError("Unauthorized: Cannot cancel this order");
    }

    if (!["pending", "paid"].includes(order.status)) {
      throw new InvalidOrderError(
        `Cannot cancel order with status: ${order.status}`,
      );
    }

    const updatedOrder = await orderRepository.updateStatus(
      orderId,
      "cancelled",
    );

    await this._restoreInventory(orderId);

    return updatedOrder;
  }

  async _restoreInventory(orderId) {
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
    return order;
  }

  async _sendDeliveryNotification(order) {
    return order;
  }
}

module.exports = OrderService;