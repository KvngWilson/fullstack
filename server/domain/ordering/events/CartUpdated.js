class CartUpdated {
  constructor({
    cartId,
    userId = null,
    guestToken = null,
    itemCount = 0,
    occurredAt = new Date(),
  } = {}) {
    this.type = "ordering.cart.updated";
    this.cartId = cartId;
    this.userId = userId;
    this.guestToken = guestToken;
    this.itemCount = Number(itemCount) || 0;
    this.occurredAt = occurredAt;
  }
}

module.exports = CartUpdated;
