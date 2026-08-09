class PaymentValidationPolicy {
  static isSupportedCurrency(currency) {
    const supported = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "NGN"];
    return supported.includes(String(currency || "").toUpperCase());
  }

  static isSupportedProcessor(processor) {
    const supported = ["stripe", "paystack", "paypal"];
    return supported.includes(String(processor || "").toLowerCase());
  }

  static validateCreatePayment({ orderId, amount, currency, processor } = {}) {
    const errors = [];

    if (!Number.isInteger(Number(orderId)) || Number(orderId) <= 0) {
      errors.push("orderId must be a positive integer");
    }

    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      errors.push("amount must be greater than 0");
    }

    if (currency && !this.isSupportedCurrency(currency)) {
      errors.push("currency is not supported");
    }

    if (processor && !this.isSupportedProcessor(processor)) {
      errors.push("processor is not supported");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static validateRefundAmount(paymentAmount, alreadyRefunded, requestedAmount) {
    const paid = Number(paymentAmount) || 0;
    const refunded = Number(alreadyRefunded) || 0;
    const requested = Number(requestedAmount) || 0;

    if (!Number.isFinite(requested) || requested <= 0) {
      return {
        valid: false,
        message: "requested refund amount must be greater than 0",
      };
    }

    const remaining = Math.max(0, paid - refunded);
    if (requested > remaining) {
      return {
        valid: false,
        message: `requested refund exceeds remaining balance (${remaining})`,
      };
    }

    return { valid: true, remaining };
  }
}

module.exports = PaymentValidationPolicy;
