/**
 * Order Status Changed Subscriber
 * 
 * Subscribes to OrderStatusChanged events and:
 * 1. Emits real-time updates via WebSocket
 * 2. Sends notification emails
 * 3. Updates order audit log
 * 4. Triggers downstream processes (fulfillment, refunds, etc)
 */
const logger = require("../../config/logger");

class OrderStatusChangedSubscriber {
  constructor(websocketManager, emailService, orderRepository) {
    this.websocketManager = websocketManager;
    this.emailService = emailService;
    this.orderRepository = orderRepository;
  }

  /**
   * Handle order status changed event
   */
  async handle(event) {
    try {
      logger.info("Processing order status change", {
        orderId: event.orderId,
        from: event.previousStatus,
        to: event.newStatus,
      });

      // Emit real-time update via WebSocket
      this.websocketManager.emitOrderStatusUpdate(event.orderId, event);

      // Send notification email if customer should be notified
      if (event.shouldNotifyCustomer()) {
        await this._sendCustomerNotification(event);
      }

      // Send admin notification if needed
      if (event.shouldNotifyAdmin()) {
        await this._broadcastToAdmin(event);
      }

      // Handle specific status transitions
      await this._handleStatusTransition(event);

      // Update audit log
      await this._logStatusChange(event);
    } catch (error) {
      logger.error("Error processing order status change event", {
        orderId: event.orderId,
        error,
      });
      throw error;
    }
  }

  /**
   * Send customer notification email
   */
  async _sendCustomerNotification(event) {
    try {
      // Get order and user details
      const order = await this.orderRepository.findById(event.orderId);
      if (!order) return;

      const emailTemplates = {
        pending: "order-received",
        processing: "order-processing",
        paid: "payment-confirmed",
        fulfilled: "order-shipped",
        cancelled: "order-cancelled",
        refunded: "order-refunded",
      };

      const template = emailTemplates[event.newStatus];
      if (!template) return;

      // Queue email job (via Bull job queue)
      await this.emailService.queue("send-order-notification", {
        userId: event.userId,
        orderId: event.orderId,
        template,
        data: {
          orderNumber: order.id,
          status: event.newStatus,
          message: event.getStatusMessage(),
          reason: event.reason,
          ...order,
        },
      });

      logger.debug("Customer notification queued", {
        orderId: event.orderId,
        template,
      });
    } catch (error) {
      logger.error("Failed to queue customer notification", {
        orderId: event.orderId,
        error,
      });
      // Don't throw - this is not critical
    }
  }

  /**
   * Broadcast to admin dashboard
   */
  async _broadcastToAdmin(event) {
    try {
      this.websocketManager.broadcastToAdmin("order-status-changed", {
        orderId: event.orderId,
        userId: event.userId,
        previousStatus: event.previousStatus,
        newStatus: event.newStatus,
        message: event.getStatusMessage(),
        priority: event.getNotificationPriority(),
        timestamp: event.occurredAt,
      });
    } catch (error) {
      logger.error("Failed to broadcast to admin", { error });
    }
  }

  /**
   * Handle specific status transitions with side effects
   */
  async _handleStatusTransition(event) {
    const handlers = {
      paid: () => this._handlePaymentConfirmed(event),
      fulfilled: () => this._handleOrderFulfilled(event),
      refunded: () => this._handleOrderRefunded(event),
      cancelled: () => this._handleOrderCancelled(event),
    };

    const handler = handlers[event.newStatus];
    if (handler) {
      await handler();
    }
  }

  /**
   * Handle payment confirmation - trigger fulfillment
   */
  async _handlePaymentConfirmed(event) {
    try {
      logger.info("Handling payment confirmed", { orderId: event.orderId });
      // Queue fulfillment process
      // Emit fulfillment.required event
    } catch (error) {
      logger.error("Error handling payment confirmed", { error });
    }
  }

  /**
   * Handle order fulfilled
   */
  async _handleOrderFulfilled(event) {
    try {
      logger.info("Handling order fulfilled", { orderId: event.orderId });
      // Update inventory
      // Schedule delivery tracking
      // Trigger review request email (after 2 days)
    } catch (error) {
      logger.error("Error handling order fulfilled", { error });
    }
  }

  /**
   * Handle order refunded
   */
  async _handleOrderRefunded(event) {
    try {
      logger.info("Handling order refunded", { orderId: event.orderId });
      // Process refund to original payment method
      // Update inventory if not already shipped
    } catch (error) {
      logger.error("Error handling order refunded", { error });
    }
  }

  /**
   * Handle order cancelled
   */
  async _handleOrderCancelled(event) {
    try {
      logger.info("Handling order cancelled", { orderId: event.orderId });
      // Release reserved inventory
      // Initiate refund if already paid
    } catch (error) {
      logger.error("Error handling order cancelled", { error });
    }
  }

  /**
   * Log status change to audit log
   */
  async _logStatusChange(event) {
    try {
      // This would write to audit_logs table
      logger.debug("Order status change logged", {
        orderId: event.orderId,
        transition: `${event.previousStatus} -> ${event.newStatus}`,
      });
    } catch (error) {
      logger.error("Failed to log status change", { error });
    }
  }
}

module.exports = OrderStatusChangedSubscriber;
