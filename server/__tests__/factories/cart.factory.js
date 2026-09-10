const {
  addToCart,
  createTestVariant,
  DatabaseHelper,
  getOrCreateCart,
} = require("../helpers/testHelpers");

class CartFactory {
  static async create(user_id) {
    if (!user_id) {
      throw new Error('user_id is required for CartFactory.create()');
    }

    return {
      id: await getOrCreateCart(user_id),
      user_id,
    };
  }

  static async addItem(cart_id, product_id, quantity = 1, _price = null) {
    if (!cart_id || !product_id) {
      throw new Error("cart_id and product_id are required");
    }

    const ownerResult = await DatabaseHelper.query(
      "SELECT user_id FROM carts WHERE id = $1",
      [cart_id],
    );
    const variant = await createTestVariant(product_id);
    const cartItem = await addToCart(ownerResult.rows[0].user_id, variant.id, quantity);

    return { ...cartItem, cart_id, product_id };
  }

  static async createWithItems(user_id, items = []) {
    const cart = await this.create(user_id);
    const cartItems = [];

    for (const item of items) {
      const cartItem = await this.addItem(
        cart.id,
        item.product_id,
        item.quantity || 1,
        item.price
      );
      cartItems.push(cartItem);
    }

    return {
      ...cart,
      items: cartItems,
    };
  }
}

module.exports = CartFactory;
