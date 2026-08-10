const { DatabaseHelper } = require('../helpers/testHelpers');

class ProductFactory {
  static counter = 0;

  static async create(overrides = {}) {
    this.counter++;
    
    const productData = {
      name: overrides.name || `Test Product ${this.counter}`,
      sku: overrides.sku || `TEST-SKU-${this.counter}`,
      description: overrides.description || 'Test product description',
      base_price: overrides.base_price !== undefined ? overrides.base_price : 99.99,
      cost_price: overrides.cost_price !== undefined ? overrides.cost_price : 49.99,
      quantity_in_stock: overrides.quantity_in_stock !== undefined ? overrides.quantity_in_stock : 100,
      is_active: overrides.is_active !== undefined ? overrides.is_active : true,
      created_at: new Date(),
    };

    const result = await DatabaseHelper.query(
      `INSERT INTO products (name, sku, description, base_price, cost_price, quantity_in_stock, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [productData.name, productData.sku, productData.description, productData.base_price, productData.cost_price, productData.quantity_in_stock, productData.is_active, productData.created_at]
    );

    return {
      id: result.rows[0].id,
      name: productData.name,
      sku: productData.sku,
      description: productData.description,
      base_price: productData.base_price,
      cost_price: productData.cost_price,
      quantity_in_stock: productData.quantity_in_stock,
      is_active: productData.is_active,
    };
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
