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

  getNormalizedStatus() {
    if (this.newStatus === "fulfilled") {
      return "shipped";
    }

    return this.newStatus;
  }

  /**
   * Returns human-readable status message
   */
  getStatusMessage() {
    const normalizedStatus = this.getNormalizedStatus();
    const messages = {
      pending: "Order received. Processing...",
      processing: "Processing your order",
      paid: "Payment confirmed",
      shipped: "Order shipped",
      delivered: "Order delivered",
      fulfilled: "Order shipped",
      refunded: "Order refunded",
      cancelled: "Order cancelled",
    };
    return messages[normalizedStatus] || `Status updated to ${normalizedStatus}`;
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
      "shipped",
      "delivered",
      "refunded",
      "cancelled",
      "fulfilled",
    ];
    return adminNotifiableTransitions.includes(this.getNormalizedStatus());
  }

  /**
   * Priority for notification (high/medium/low)
   */
  getNotificationPriority() {
    const normalizedStatus = this.getNormalizedStatus();
    const priorities = {
      pending: "low",
      processing: "low",
      paid: "high",
      shipped: "medium",
      delivered: "medium",
      fulfilled: "medium",
      refunded: "high",
      cancelled: "high",
    };
    return priorities[normalizedStatus] || "medium";
  }
}

module.exports = OrderStatusChanged;
