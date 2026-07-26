const { pool } = require("../../../config/db");
const BaseService = require("../../base/BaseService");
const { orderRepository } = require("../repositories");
const { InventoryRepository: inventoryRepository } = require("../../catalog/repositories");
const {
  InvalidOrderError,
  InsufficientStockError,
  AuthorizationError,
  ConflictError,
} = require("../../../shared/utils/errors");
const logger = require("../../../shared/utils/logger");
const PERMISSIONS = require("../../../shared/constants/permissions");
const taxService = require("./TaxService");
const EmailQueueProvider = require("../../../infrastructure/jobs/EmailQueueProvider");
const eventDispatcher = require("../../shared/events/dispatcher");
const { fireAndForgetWithErrorLog } = require("../../../shared/utils/asyncErrorHandler");

/**
 * Order Service.
 * Coordinates checkout, stock reservation, and order creation transactions.
 * Extends BaseService for permission validation and cross-tenant isolation.
 */
class OrderService extends BaseService {
  constructor() {
    super();
  }

  /**
   * Create a new order from user's cart.
   * For customer orders: userId required, employeeId optional (for admin override)
   * For admin orders: employeeId required with 'order:create' permission
   */
  async createOrder(userId, shippingAddressId, billingAddressId, employeeId = null) {
    // If called by employee, validate permission
    if (employeeId) {
      await this.validatePermission(employeeId, PERMISSIONS.ORDER.CREATE);
      await this.auditLog(employeeId, 'create', 'order', null, { userId, shippingAddressId });
    }

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
        const reservation = await inventoryRepository.reserveStockWithOptimisticLock(
          client,
          {
            variantId: item.product_variant_id,
            quantity: item.quantity,
          },
        );

        if (!reservation.reserved) {
          if (reservation.reason === "version_conflict") {
            throw new ConflictError(
              `Stock reservation conflict for variant ${item.product_variant_id}, please retry`,
            );
          }
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

      // Capture exchange rate snapshot for audit trail
      await this._captureExchangeRateSnapshot(client, {
        orderId: order.id,
        customerCurrency: user?.currency_preference ?? process.env.DEFAULT_CURRENCY ?? 'USD',
        baseCurrency: process.env.BASE_CURRENCY ?? 'USD',
        total,
      });

      await client.query("COMMIT");

      const fullOrder = await orderRepository.findByIdWithItems(order.id);

      fireAndForgetWithErrorLog(
        () => this._publishOrderCreatedEvent({
          orderId: order.id,
          userId,
          total,
          subtotal,
          tax,
          discount,
          shippingCost,
          items: pricedItems,
        }),
        { operation: 'publishOrderCreatedEvent', orderId: order.id }
      );

      fireAndForgetWithErrorLog(
        () => this._queueOrderConfirmationEmail(fullOrder),
        { operation: 'queueOrderConfirmationEmail', orderId: fullOrder.id }
      );

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
    if (!cartItems || cartItems.length === 0) {
      return [];
    }

    // Batch load all variants in single query (prevents N+1)
    const variantIds = cartItems.map(item => item.product_variant_id);
    const variants = await orderRepository.getVariantsByIds(client, variantIds);

    // Create lookup map for O(1) access
    const variantMap = new Map(variants.map(v => [v.id, v]));

    // Match cart items with variants
    const pricedItems = cartItems.map(item => {
      const variant = variantMap.get(item.product_variant_id);
      if (!variant) {
        throw new InvalidOrderError(
          `Variant ${item.product_variant_id} not found`,
        );
      }

      return {
        ...item,
        unit_price: Number.parseFloat(variant.price_minor_units) / 100,
      };
    });

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
    return taxService.calculateFromMajor(subtotal, _context);
  }

  _calculateDiscount(subtotal, _context = {}) {
    const discountRate = 0;
    return Number.parseFloat((subtotal * discountRate).toFixed(2));
  }

  _calculateShippingCost(pricedItems, _context = {}) {
    // Future: Integrate with ShippingService.calculateCost(pricedItems, context)
    // For now: No shipping cost applied
    return 0;
  }

  _calculateTotal({ subtotal, tax, discount, shippingCost }) {
    const total = subtotal + tax + shippingCost - discount;
    return Number.parseFloat(total.toFixed(2));
  }

  async _publishOrderCreatedEvent(eventPayload) {
    const events = [
      {
        type: "order.created",
        occurredAt: new Date(),
        ...eventPayload,
      },
      {
        type: "payment.initiated",
        occurredAt: new Date(),
        orderId: eventPayload.orderId,
        userId: eventPayload.userId,
        amount: eventPayload.total,
        currency: "USD",
        processor: "pending",
      },
      {
        type: "inventory.reserved",
        occurredAt: new Date(),
        orderId: eventPayload.orderId,
        userId: eventPayload.userId,
        items: eventPayload.items || [],
      },
    ];

    await eventDispatcher.publishAll(events);

    logger.info("Order lifecycle events emitted", {
      orderId: eventPayload.orderId,
      eventTypes: events.map((event) => event.type),
    });
  }

  async _queueOrderConfirmationEmail(order) {
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

      await EmailQueueProvider.queueEmail(
        user.email,
        "orderConfirmation",
        {
          orderId,
          items: formattedItems,
          total: total.toFixed(2),
          orderUrl: `${process.env.APP_URL || "http://localhost:5000"}/orders/${orderId}`,
        },
        {
          attempts: 3,
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

  async updateOrderStatus(orderId, newStatus, userId, isAdmin, employeeId = null) {
    // Service-layer RBAC: Always validate permission if called by employee
    if (employeeId) {
      await this.validatePermission(employeeId, PERMISSIONS.ORDER.UPDATE);
      await this.auditLog(employeeId, 'update', 'order', orderId, { newStatus });
    } else if (!isAdmin) {
      throw new AuthorizationError("Unauthorized: Only admins/employees can update order status");
    }

    const order = await orderRepository.updateStatus(orderId, newStatus);

    if (!order) {
      return null;
    }

    if (newStatus === "shipped") {
      fireAndForgetWithErrorLog(
        () => this._sendShippingNotification(order),
        { operation: 'sendShippingNotification', orderId: order.id }
      );
    } else if (newStatus === "delivered") {
      fireAndForgetWithErrorLog(
        () => this._sendDeliveryNotification(order),
        { operation: 'sendDeliveryNotification', orderId: order.id }
      );
    }

    return order;
  }

  async cancelOrder(orderId, userId, isAdmin, employeeId = null) {
    // Service-layer RBAC: Validate permission if called by employee
    if (employeeId) {
      await this.validatePermission(employeeId, PERMISSIONS.ORDER.CANCEL);
      await this.auditLog(employeeId, 'cancel', 'order', orderId, {});
    } else if (!isAdmin) {
      throw new AuthorizationError("Unauthorized: Cannot cancel this order");
    }

    const order = await orderRepository.findById(orderId);

    if (!order) {
      return null;
    }

    if (!isAdmin && !employeeId && order.user_id !== userId) {
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
      await inventoryRepository.releaseStock(pool, {
        variantId: item.product_variant_id,
        quantity: item.quantity,
      });
    }
  }

  async _sendShippingNotification(order) {
    try {
      const event = {
        type: 'order.shipped',
        occurredAt: new Date(),
        orderId: order.id,
        userId: order.user_id,
      };
      await eventDispatcher.publish(event);
      logger.info('Shipping notification queued', { orderId: order.id });
    } catch (error) {
      logger.error('Failed to queue shipping notification', {
        orderId: order.id,
        error: error.message,
      });
    }
  }

  async _sendDeliveryNotification(order) {
    try {
      const event = {
        type: 'order.delivered',
        occurredAt: new Date(),
        orderId: order.id,
        userId: order.user_id,
      };
      await eventDispatcher.publish(event);
      logger.info('Delivery notification queued', { orderId: order.id });
    } catch (error) {
      logger.error('Failed to queue delivery notification', {
        orderId: order.id,
        error: error.message,
      });
    }
  }

  /**
   * Get latest exchange rate from database.
   * @param {Pool.Client} client - Database client
   * @param {string} fromCurrency - Currency to convert from
   * @param {string} toCurrency - Currency to convert to
   * @returns {Promise<{rate: number, isStale: boolean}>}
   */
  async _getLatestExchangeRate(client, fromCurrency, toCurrency) {
    // If currencies are the same, return 1.0
    if (fromCurrency === toCurrency) {
      return { rate: 1.0, isStale: false };
    }

    const result = await client.query(
      `SELECT rate, expires_at, created_at
       FROM exchange_rates
       WHERE from_currency = $1 AND to_currency = $2
       ORDER BY effective_date DESC, created_at DESC
       LIMIT 1`,
      [fromCurrency, toCurrency]
    );

    if (result.rows.length === 0) {
      // No rate found - return 1.0 as fallback
      logger.warn('No exchange rate found', { fromCurrency, toCurrency });
      return { rate: 1.0, isStale: true };
    }

    const { rate, expires_at, created_at } = result.rows[0];
    const now = new Date();
    const expiresAt = new Date(expires_at);
    const createdAt = new Date(created_at);
    
    // Check if rate is stale (expired or >24 hours old)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const age = now - createdAt;
    const isStale = expiresAt < now || age > maxAge;

    if (isStale) {
      logger.warn('Exchange rate is stale', {
        fromCurrency,
        toCurrency,
        rate,
        age: `${Math.round(age / 1000 / 60 / 60)} hours`,
      });
    }

    return { rate: parseFloat(rate), isStale };
  }

  /**
   * Capture exchange rate snapshot for order (immutable audit trail).
   * @param {Pool.Client} client - Database client
   * @param {Object} params - Snapshot parameters
   * @param {number} params.orderId - Order ID
   * @param {string} params.customerCurrency - Customer's currency
   * @param {string} params.baseCurrency - Base currency (system default)
   * @param {number} params.total - Total amount in base currency
   */
  async _captureExchangeRateSnapshot(client, { orderId, customerCurrency, baseCurrency, total }) {
    const { rate, isStale } = await this._getLatestExchangeRate(
      client,
      customerCurrency,
      baseCurrency
    );

    // Reject order if rate is stale (security measure)
    if (isStale && customerCurrency !== baseCurrency) {
      throw new InvalidOrderError(
        `Exchange rate for ${customerCurrency} to ${baseCurrency} is stale or expired. Please try again.`
      );
    }

    // Convert total to cents (minor units)
    const totalCents = Math.round(total * 100);
    const customerTotalCents = customerCurrency === baseCurrency 
      ? totalCents 
      : Math.round(totalCents / rate);

    // Insert immutable snapshot
    await client.query(
      `INSERT INTO order_currency_snapshots (
        order_id, 
        customer_currency, 
        base_currency, 
        exchange_rate,
        customer_total_cents, 
        base_total_cents,
        locked_at,
        locked_by,
        rate_source,
        reason
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9)`,
      [
        orderId,
        customerCurrency,
        baseCurrency,
        rate,
        customerTotalCents,
        totalCents,
        'OrderService', // locked_by
        isStale ? 'cached' : 'live', // rate_source
        'Order creation' // reason
      ]
    );

    logger.info('Exchange rate snapshot captured', {
      orderId,
      customerCurrency,
      baseCurrency,
      rate,
      customerTotal: customerTotalCents / 100,
      baseTotal: totalCents / 100,
    });
  }
}

module.exports = OrderService;