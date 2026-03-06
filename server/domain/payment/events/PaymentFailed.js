class PaymentFailed {
	constructor({
		paymentId,
		orderId,
		userId,
		amount,
		currency = "USD",
		reason = "unknown_error",
		occurredAt = new Date(),
	} = {}) {
		this.type = "payment.failed";
		this.paymentId = paymentId;
		this.orderId = orderId;
		this.userId = userId;
		this.amount = Number(amount) || 0;
		this.currency = currency;
		this.reason = reason;
		this.occurredAt = occurredAt;
	}
}

module.exports = PaymentFailed;
