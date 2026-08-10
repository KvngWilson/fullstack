class OrderPlaced {
  constructor({ orderId, userId, totalAmount, currency = "USD", occurredAt = new Date() } = {}) {
    this.type = "ordering.order.placed";
    this.orderId = orderId;
    this.userId = userId;
    this.totalAmount = Number(totalAmount) || 0;
    this.currency = currency;
    this.occurredAt = occurredAt;
  }
}

module.exports = OrderPlaced;
