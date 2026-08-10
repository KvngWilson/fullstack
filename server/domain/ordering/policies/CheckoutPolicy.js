class CheckoutPolicy {
  static validate({ items, shippingAddress, paymentMethod } = {}) {
    const errors = [];

    if (!Array.isArray(items) || items.length === 0) {
      errors.push("Cart must contain at least one item");
    }

    if (!shippingAddress || !shippingAddress.country) {
      errors.push("Shipping address is required");
    }

    if (!paymentMethod) {
      errors.push("Payment method is required");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

module.exports = CheckoutPolicy;
