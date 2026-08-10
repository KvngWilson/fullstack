/**
 * OrderStatusChanged Event
 * 
 * Emitted when an order's status transitions to a new state.
 * This event triggers real-time updates via WebSocket to customers and admin.
 */
class OrderStatusChanged {
  constructor({
    orderId,
    userId,
    previousStatus,
    newStatus,
    reason = null,
    metadata = {},
    occurredAt = new Date(),
  } = {}) {
    this.type = "ordering.order.status.changed";
    this.orderId = orderId;
    this.userId = userId;
    this.previousStatus = previousStatus;
    this.newStatus = newStatus;
    this.reason = reason;
    this.metadata = metadata;
    this.occurredAt = occurredAt;
  }

  /**
   * Returns human-readable status message
   */
  getStatusMessage() {
    const messages = {
      pending: "Order received. Processing...",
      processing: "Processing your order",
      paid: "Payment confirmed",
      fulfilled: "Order shipped",
      refunded: "Order refunded",
      cancelled: "Order cancelled",
    };
    return messages[this.newStatus] || `Status updated to ${this.newStatus}`;
  }

  /**
   * Determines if customer should be notified
   */
  shouldNotifyCustomer() {
    // All status changes notify customer, but with different urgency
    return true;
  }

  /**
   * Determines if admin should be notified
   */
  shouldNotifyAdmin() {
    // Admin notified on certain transitions
    const adminNotifiableTransitions = [
      "paid",
      "refunded",
      "cancelled",
      "fulfilled",
    ];
    return adminNotifiableTransitions.includes(this.newStatus);
  }

  /**
   * Priority for notification (high/medium/low)
   */
  getNotificationPriority() {
    const priorities = {
      pending: "low",
      processing: "low",
      paid: "high",
      fulfilled: "medium",
      refunded: "high",
      cancelled: "high",
    };
    return priorities[this.newStatus] || "medium";
  }
}

module.exports = OrderStatusChanged;
