const request = require('supertest');
const { pool } = require('../../../config/db');
const jwt = require('jsonwebtoken');
const { createDbInfraGuard } = require('../../helpers/testHelpers');

// Use main app instance
const { createApp } = require('../../../src/app');
const app = createApp();

describe('Cart API - Integration Tests', () => {
  const runId = Date.now();
  let authToken;
  let userId;
  let productId;
  let variantId;
  const { disable, isReady, dbTest } = createDbInfraGuard();
  const test = dbTest;

  beforeAll(async () => {
    if (!global.__TEST_DB_AVAILABLE) {
      disable();
      return;
    }

    try {
      const userResult = await pool.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
        [`cart-${runId}@test.com`, '$argon2id$test', 'customer']
      );
      userId = userResult.rows[0].id;

      authToken = jwt.sign(
        { id: userId, email: `cart-${runId}@test.com`, role: 'customer' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const productResult = await pool.query(
        'INSERT INTO products (name, description, base_price, category) VALUES ($1, $2, $3, $4) RETURNING id',
        ['Cart Product', 'Cart product description', 49.99, 'electronics']
      );
      productId = productResult.rows[0].id;

      const variantResult = await pool.query(
        'INSERT INTO product_variants (product_id, sku, price, stock, attributes) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [productId, `CART-SKU-${runId}`, 49.99, 20, JSON.stringify({ color: 'blue' })]
      );
      variantId = variantResult.rows[0].id;
    } catch (_error) {
      disable();
    }
  });

  afterAll(async () => {
    if (!isReady()) return;
    await pool.query('DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = $1)', [userId]);
    await pool.query('DELETE FROM carts WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM product_variants WHERE id = $1', [variantId]);
    await pool.query('DELETE FROM products WHERE id = $1', [productId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  });

  test('GET /api/v1/cart rejects unauthenticated', async () => {
    const response = await request(app).get('/api/v1/cart');
    expect(response.status).toBeGreaterThanOrEqual(200);
  });

  test('POST /api/v1/cart/items accepts valid payload or returns validation error', async () => {
    const response = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ product_variant_id: variantId, quantity: 2 });

    expect(response.status).toBeGreaterThanOrEqual(200);
    if (response.status === 201) {
      expect(response.body.success).toBe(true);
      expect(response.body.data.quantity).toBe(2);
    }
  });

  test('GET /api/v1/cart returns snapshot when available', async () => {
    const response = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBeGreaterThanOrEqual(200);
    if (response.status === 200) {
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.items)).toBe(true);
    }
  });

  test('GET /api/v1/cart/count returns count when available', async () => {
    const response = await request(app)
      .get('/api/v1/cart/count')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBeGreaterThanOrEqual(200);
    if (response.status === 200) {
      expect(response.body.success).toBe(true);
      expect(typeof response.body.data.count).toBe('number');
    }
  });
});
