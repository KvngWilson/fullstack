class Cart {
  constructor({ id = null, userId = null, guestToken = null, items = [] } = {}) {
    if (!userId && !guestToken) {
      throw new Error("Either userId or guestToken is required");
    }

    this.id = id;
    this.userId = userId;
    this.guestToken = guestToken;
    this.items = Array.isArray(items) ? [...items] : [];
  }

  addItem(item) {
    const { productVariantId, quantity = 1, unitPrice = 0 } = item || {};

    if (!productVariantId) {
      throw new Error("productVariantId is required");
    }

    const normalizedQuantity = Number(quantity) || 0;
    if (normalizedQuantity <= 0) {
      throw new Error("quantity must be greater than 0");
    }

    const existing = this.items.find((entry) => entry.productVariantId === productVariantId);
    if (existing) {
      existing.quantity += normalizedQuantity;
      return this;
    }

    this.items.push({
      productVariantId,
      quantity: normalizedQuantity,
      unitPrice: Number(unitPrice) || 0,
    });

    return this;
  }

  removeItem(productVariantId) {
    this.items = this.items.filter((item) => item.productVariantId !== productVariantId);
    return this;
  }

  getSubtotal() {
    return this.items.reduce(
      (acc, item) => acc + (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0),
      0,
    );
  }
}

module.exports = Cart;
