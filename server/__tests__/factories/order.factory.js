const DatabaseHelper = require('../helpers/db.helper.js');

class OrderFactory {
  static counter = 0;

  static async create(overrides = {}) {
    this.counter++;
    const timestamp = Date.now();
    const user_id = overrides.user_id;

    if (!user_id) {
      throw new Error('user_id is required for OrderFactory.create()');
    }

    const orderNumber = `ORD-${timestamp}-${this.counter}`;
    const orderData = {
      user_id,
      order_number: orderNumber,
      status: overrides.status || 'pending',
      subtotal: overrides.subtotal !== undefined ? overrides.subtotal : 100.00,
      tax: overrides.tax !== undefined ? overrides.tax : 10.00,
      shipping_cost: overrides.shipping_cost !== undefined ? overrides.shipping_cost : 5.00,
      total: overrides.total !== undefined ? overrides.total : 115.00,
      created_at: new Date(),
    };

    const result = await DatabaseHelper.query(
      `INSERT INTO orders (user_id, order_number, status, subtotal, tax, shipping_cost, total, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [orderData.user_id, orderData.order_number, orderData.status, orderData.subtotal, orderData.tax, orderData.shipping_cost, orderData.total, orderData.created_at]
    );

    return {
      id: result.rows[0].id,
      user_id: orderData.user_id,
      order_number: orderData.order_number,
      status: orderData.status,
      subtotal: orderData.subtotal,
      tax: orderData.tax,
      shipping_cost: orderData.shipping_cost,
      total: orderData.total,
    };
  }

  static async createMany(user_id, count = 5, overrides = {}) {
    const orders = [];
    for (let i = 0; i < count; i++) {
      const order = await this.create({
        user_id,
        ...overrides,
      });
      orders.push(order);
    }
    return orders;
  }

  static resetCounter() {
    this.counter = 0;
  }
}

module.exports = OrderFactory;
