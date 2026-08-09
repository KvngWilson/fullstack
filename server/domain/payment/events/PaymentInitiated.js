class PaymentInitiated {
  constructor({
    paymentId,
    orderId,
    userId,
    amount,
    currency = "USD",
    processor,
    occurredAt = new Date(),
  } = {}) {
    this.type = "payment.initiated";
    this.paymentId = paymentId;
    this.orderId = orderId;
    this.userId = userId;
    this.amount = Number(amount) || 0;
    this.currency = currency;
    this.processor = processor;
    this.occurredAt = occurredAt;
  }
}

module.exports = PaymentInitiated;
