const {
  createTestAddress,
  createTestOrder,
} = require("../helpers/testHelpers");

class OrderFactory {
  static counter = 0;

  static async create(overrides = {}) {
    this.counter++;
    const user_id = overrides.user_id;

    if (!user_id) {
      throw new Error('user_id is required for OrderFactory.create()');
    }

    const address = await createTestAddress(user_id, overrides.address || {});

    return createTestOrder(user_id, address.id, {
      status: overrides.status || "pending",
      subtotal: overrides.subtotal !== undefined ? overrides.subtotal : 100.0,
      tax: overrides.tax !== undefined ? overrides.tax : 10.0,
      shipping_cost:
        overrides.shipping_cost !== undefined ? overrides.shipping_cost : 5.0,
      total: overrides.total !== undefined ? overrides.total : 115.0,
    });
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
