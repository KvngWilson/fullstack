class Order {
  constructor({
    id = null,
    userId,
    status = "pending",
    subtotal = 0,
    tax = 0,
    shipping = 0,
    totalAmount,
    currency = "USD",
    items = [],
  } = {}) {
    if (!userId) {
      throw new Error("userId is required");
    }

    this.id = id;
    this.userId = userId;
    this.status = status;
    this.currency = currency;
    this.items = Array.isArray(items) ? items : [];

    this.subtotal = Number(subtotal) || 0;
    this.tax = Number(tax) || 0;
    this.shipping = Number(shipping) || 0;
    this.totalAmount =
      totalAmount !== undefined ? Number(totalAmount) || 0 : this.subtotal + this.tax + this.shipping;
  }

  updateTotals({ subtotal = this.subtotal, tax = this.tax, shipping = this.shipping } = {}) {
    this.subtotal = Number(subtotal) || 0;
    this.tax = Number(tax) || 0;
    this.shipping = Number(shipping) || 0;
    this.totalAmount = this.subtotal + this.tax + this.shipping;
    return this;
  }

  canTransitionTo(nextStatus) {
    const transitions = {
      pending: ["processing", "cancelled"],
      processing: ["paid", "cancelled"],
      paid: ["shipped", "refunded"],
      shipped: ["delivered", "refunded"],
      fulfilled: ["refunded"],
      delivered: ["refunded"],
      cancelled: [],
      refunded: [],
    };

    return (transitions[this.status] || []).includes(nextStatus);
  }
}

module.exports = Order;
