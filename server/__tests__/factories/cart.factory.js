const { DatabaseHelper } = require('../helpers/testHelpers');

class CartFactory {
  static async create(user_id) {
    if (!user_id) {
      throw new Error('user_id is required for CartFactory.create()');
    }

    const result = await DatabaseHelper.query(
      `INSERT INTO carts (user_id, created_at)
       VALUES ($1, $2)
       RETURNING id`,
      [user_id, new Date()]
    );

    return {
      id: result.rows[0].id,
      user_id,
    };
  }

  static async addItem(cart_id, product_id, quantity = 1, price = null) {
    if (!cart_id || !product_id) {
      throw new Error('cart_id and product_id are required');
    }

    let itemPrice = price;
    if (!itemPrice) {
      const productResult = await DatabaseHelper.query(
        'SELECT base_price FROM products WHERE id = $1',
        [product_id]
      );
      if (productResult.rows.length === 0) {
        throw new Error(`Product ${product_id} not found`);
      }
      itemPrice = productResult.rows[0].base_price;
    }

    const result = await DatabaseHelper.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity, price, created_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [cart_id, product_id, quantity, itemPrice, new Date()]
    );

    return {
      id: result.rows[0].id,
      cart_id,
      product_id,
      quantity,
      price: itemPrice,
    };
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
