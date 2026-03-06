class RefundProcessed {
	constructor({
		refundId,
		paymentId,
		orderId = null,
		userId,
		amount,
		status = "completed",
		occurredAt = new Date(),
	} = {}) {
		this.type = "payment.refund.processed";
		this.refundId = refundId;
		this.paymentId = paymentId;
		this.orderId = orderId;
		this.userId = userId;
		this.amount = Number(amount) || 0;
		this.status = status;
		this.occurredAt = occurredAt;
	}
}

module.exports = RefundProcessed;
