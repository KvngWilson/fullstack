class PaymentSucceeded {
  constructor({
    paymentId,
    orderId,
    userId,
    amount,
    currency = "USD",
    transactionId = null,
    occurredAt = new Date(),
  } = {}) {
    this.type = "payment.succeeded";
    this.paymentId = paymentId;
    this.orderId = orderId;
    this.userId = userId;
    this.amount = Number(amount) || 0;
    this.currency = currency;
    this.transactionId = transactionId;
    this.occurredAt = occurredAt;
  }
}

module.exports = PaymentSucceeded;
