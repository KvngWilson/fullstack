const { createTestProduct } = require("../helpers/testHelpers");

class ProductFactory {
  static counter = 0;

  static async create(overrides = {}) {
    this.counter++;

    return createTestProduct({
      name: overrides.name || `Test Product ${this.counter}`,
      sku: overrides.sku || `TEST-SKU-${this.counter}`,
      description: overrides.description || 'Test product description',
      base_price: overrides.base_price !== undefined ? overrides.base_price : 99.99,
      is_active: overrides.is_active !== undefined ? overrides.is_active : true,
    });
  }

  static async createMany(count = 5, overrides = {}) {
    const products = [];
    for (let i = 0; i < count; i++) {
      const product = await this.create({
        ...overrides,
        sku: overrides.sku ? `${overrides.sku}-${i}` : undefined,
      });
      products.push(product);
    }
    return products;
  }

  static resetCounter() {
    this.counter = 0;
  }
}

module.exports = ProductFactory;
